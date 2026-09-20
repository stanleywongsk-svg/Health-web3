import { activitySyncSchema, epochMilliseconds, taskDayBounds, type ActivitySyncInput } from '@healthloop/domain';
import { CoreApiError, type ClaimResult, type CoreClient, type LedgerPage, type Mission, type PointsSummary } from '@healthloop/api-client';
import type { SourcePin, StepAggregation, StepSample } from '@healthloop/health-provider';

/** Derive observation time from eligible samples for the pinned source, never fetch time. */
export function latestEligibleObservation(input: { taskDate: string; samples: readonly StepSample[]; pin: SourcePin | null }): string | null {
  if (!input.pin) return null;
  const bounds = taskDayBounds(input.taskDate);
  const lower = epochMilliseconds(bounds.startAt); const upper = epochMilliseconds(bounds.endAt);
  let latest: number | null = null;
  for (const sample of input.samples) {
    if (sample.source.id !== input.pin.sourceId || sample.source.category !== input.pin.sourceCategory || sample.source.isManual) continue;
    try {
      const start = epochMilliseconds(sample.startAt); const end = epochMilliseconds(sample.endAt);
      if (start >= lower && end <= upper && end > start && Number.isSafeInteger(sample.count) && sample.count >= 0 && sample.count <= 100_000) {
        latest = latest === null ? end : Math.max(latest, end);
      }
    } catch { /* The aggregate rejects malformed inputs; they cannot supply observation time. */ }
  }
  return latest === null ? null : new Date(latest).toISOString();
}

/** Extract the minimum permitted summary. Raw samples and the local sourceId are not retained. */
export function prepareActivitySummary(input: { taskDate: string; steps: StepAggregation; observedAt: string | null; revision: number }): ActivitySyncInput {
  if (input.steps.eligible.status !== 'present' || !input.steps.pin || !input.observedAt) throw new CoreApiError('NO_DATA', 0);
  const parsed = activitySyncSchema.safeParse({
    taskDate: input.taskDate, eligibleSteps: input.steps.eligible.value,
    sourceCategory: input.steps.pin.sourceCategory, sourcePolicy: input.steps.pin.sourcePolicy,
    sourcePinToken: input.steps.pin.pinToken, revision: input.revision, observedAt: input.observedAt, timezone: 'Asia/Hong_Kong',
  });
  if (!parsed.success) throw new CoreApiError('INVALID_INPUT', 0);
  const bounds = taskDayBounds(parsed.data.taskDate); const observed = epochMilliseconds(parsed.data.observedAt);
  if (observed < epochMilliseconds(bounds.startAt) || observed > epochMilliseconds(bounds.endAt)) throw new CoreApiError('INVALID_INPUT', 0);
  return parsed.data;
}

type SyncResponse = Awaited<ReturnType<CoreClient['syncActivity']>>;
type SyncApi = Pick<CoreClient, 'syncActivity' | 'claimMission' | 'getMissions' | 'getPointsSummary' | 'getLedger'>;
export type SyncStage = 'sync' | 'claim' | 'refresh';
export interface ActivitySyncResult {
  status: SyncResponse['status']; sync: SyncResponse; claim: ClaimResult | null;
  missions: Mission[]; points: PointsSummary; ledger: LedgerPage;
}
export interface PendingActivitySync { taskDate: string; revision: number; stage: SyncStage }
interface Pending {
  accountId: string; generation: number; input: Readonly<ActivitySyncInput>; key: string;
  stage: SyncStage; sync: SyncResponse | null; claim: ClaimResult | null;
  running?: Promise<ActivitySyncResult>; controller?: AbortController;
}
const terminalErrors = new Set(['INVALID_INPUT', 'SOURCE_REJECTED', 'SOURCE_PINNED', 'REVISION_CONFLICT', 'CUTOFF_PASSED', 'NOT_FOUND']);
const consentErrors = new Set(['CONSENT_REQUIRED', 'ACCOUNT_INACTIVE']);
const cancelled = () => new CoreApiError('CANCELLED', 0);

/**
 * An account-scoped, memory-only queue. No background retries or optimistic points.
 * Persist only a revision counter outside this coordinator; after process restart,
 * reconcile its next value with the server's accepted revision before submitting.
 */
export function createActivitySyncCoordinator(dependencies: { api: SyncApi; randomUUID: () => string }) {
  let accountId: string | null = null; let cloudSync = false; let paused = false; let generation = 0;
  const pendingByDay = new Map<string, Pending>();

  function clear() {
    generation++;
    for (const pending of pendingByDay.values()) pending.controller?.abort();
    pendingByDay.clear();
  }
  function setContext(next: { accountId: string | null; cloudSync: boolean }) {
    const allowed = next.accountId !== null && next.cloudSync;
    if (next.accountId !== accountId || !allowed) clear();
    accountId = next.accountId; cloudSync = allowed; paused = false;
  }
  function pause() {
    paused = true;
    for (const pending of pendingByDay.values()) pending.controller?.abort();
  }
  function ensureReady(signal?: AbortSignal) {
    if (signal?.aborted) throw cancelled();
    if (!accountId || !cloudSync) throw new CoreApiError('CONSENT_REQUIRED', 0);
    if (paused) throw new CoreApiError('SYNC_PAUSED', 0);
  }
  function current(pending: Pending, controller: AbortController) {
    if (controller.signal.aborted || pending.generation !== generation || pending.accountId !== accountId
      || pendingByDay.get(pending.input.taskDate) !== pending || !cloudSync || paused) throw cancelled();
  }
  function run(pending: Pending, signal?: AbortSignal): Promise<ActivitySyncResult> {
    ensureReady(signal);
    if (pending.running && pending.controller?.signal.aborted) {
      // Reconnection can finish before an aborted transport settles. Wait for it,
      // then start exactly one fresh attempt with the same body and claim key.
      return pending.running.then(() => run(pending, signal), () => run(pending, signal));
    }
    if (!pending.running) {
      const controller = new AbortController(); pending.controller = controller;
      const operation = Promise.resolve().then(async (): Promise<ActivitySyncResult> => {
        current(pending, controller);
        if (pending.stage === 'sync') {
          const response = await dependencies.api.syncActivity({ ...pending.input }, controller.signal);
          current(pending, controller);
          pending.sync = response; pending.stage = response.status === 'accepted' ? 'claim' : 'refresh';
        }
        if (!pending.sync) throw new CoreApiError('INVALID_RESPONSE', 0);
        if (pending.stage === 'claim') {
          const response = await dependencies.api.claimMission(pending.sync.instanceId, pending.key, controller.signal);
          current(pending, controller);
          pending.claim = response; pending.stage = 'refresh';
        }
        current(pending, controller);
        const [missions, points, ledger] = await Promise.all([
          dependencies.api.getMissions(controller.signal), dependencies.api.getPointsSummary(controller.signal), dependencies.api.getLedger({}, controller.signal),
        ]);
        current(pending, controller);
        const result: ActivitySyncResult = { status: pending.sync.status, sync: pending.sync, claim: pending.claim, missions: missions.items, points, ledger };
        pendingByDay.delete(pending.input.taskDate);
        return result;
      }).catch((error: unknown) => {
        // Never let a finishing request from an earlier account modify the current queue.
        if (!controller.signal.aborted && pending.generation === generation && pending.accountId === accountId) {
          if (error instanceof CoreApiError && consentErrors.has(error.code)) setContext({ accountId, cloudSync: false });
          else if (error instanceof CoreApiError && terminalErrors.has(error.code)) pendingByDay.delete(pending.input.taskDate);
        }
        throw error;
      }).finally(() => {
        if (pending.running === operation) { pending.running = undefined; pending.controller = undefined; }
      });
      pending.running = operation;
    }
    const operation = pending.running;
    const controller = pending.controller!;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    return operation.finally(() => signal?.removeEventListener('abort', abort));
  }
  function pending(taskDate: string): PendingActivitySync | null {
    const value = pendingByDay.get(taskDate);
    return value ? { taskDate, revision: value.input.revision, stage: value.stage } : null;
  }
  function submit(input: ActivitySyncInput, options: { signal?: AbortSignal } = {}): Promise<ActivitySyncResult> {
    try {
      ensureReady(options.signal);
      const parsed = activitySyncSchema.safeParse(input);
      if (!parsed.success) throw new CoreApiError('INVALID_INPUT', 0);
      const existing = pendingByDay.get(parsed.data.taskDate);
      if (existing) {
        if (JSON.stringify(existing.input) !== JSON.stringify(parsed.data)) throw new CoreApiError('PENDING_SYNC', 0);
        return run(existing, options.signal);
      }
      const item: Pending = { accountId: accountId!, generation, input: Object.freeze(parsed.data), key: dependencies.randomUUID(), stage: 'sync', sync: null, claim: null };
      pendingByDay.set(item.input.taskDate, item);
      return run(item, options.signal);
    } catch (error) { return Promise.reject(error); }
  }
  function retry(taskDate: string, options: { signal?: AbortSignal } = {}): Promise<ActivitySyncResult> {
    try {
      ensureReady(options.signal);
      const item = pendingByDay.get(taskDate);
      if (!item) throw new CoreApiError('NO_PENDING_SYNC', 0);
      return run(item, options.signal);
    } catch (error) { return Promise.reject(error); }
  }
  return { setContext, pause, submit, retry, pending };
}
export type ActivitySyncCoordinator = ReturnType<typeof createActivitySyncCoordinator>;
