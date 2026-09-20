import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { CoreApiError } from '@healthloop/api-client';
import { aggregateSteps, type SourcePin, type StepSample } from '@healthloop/health-provider';
import type { ActivitySyncInput } from '@healthloop/domain';
import { createActivitySyncCoordinator, latestEligibleObservation, prepareActivitySummary } from './activity-sync';

const taskDate = '2026-09-18';
const pin: SourcePin = { sourceId: 'local-private-phone-id', sourceCategory: 'apple_phone', sourcePolicy: 'single-approved-source-v1', pinToken: '5db51717-5b8d-4a6a-b0ae-7479cffd4c0d' };
const input = (): ActivitySyncInput => ({ taskDate, eligibleSteps: 3000, sourceCategory: pin.sourceCategory, sourcePolicy: pin.sourcePolicy, sourcePinToken: pin.pinToken, revision: 1, observedAt: '2026-09-18T01:00:00Z', timezone: 'Asia/Hong_Kong' });
const syncResponse = { instanceId: 'd8fd5540-d384-4a8e-bf63-71eae45b94aa', taskDate, eligibleSteps: 3000, status: 'accepted' as 'accepted' | 'pending_review', revision: 1, sourceCategory: 'apple_phone', ruleVersion: 'steps-v1' };
const claimResponse = { instanceId: syncResponse.instanceId, addedPoints: 10, dailyAwardedPoints: 10, weeklyAwardedPoints: 0, balance: 99 };
function api() {
  return {
    syncActivity: vi.fn(async (_input: ActivitySyncInput, _signal?: AbortSignal) => ({ ...syncResponse })),
    claimMission: vi.fn(async (_instance: string, _key: string, _signal?: AbortSignal) => ({ ...claimResponse })),
    getMissions: vi.fn(async (_signal?: AbortSignal) => ({ items: [] })),
    getPointsSummary: vi.fn(async (_signal?: AbortSignal) => ({ availablePoints: 10, pendingEvaluations: 0, earnedPoints: 10, spentPoints: 0, reversedPoints: 0 })),
    getLedger: vi.fn(async (_page: { limit?: number; cursor?: string } = {}, _signal?: AbortSignal) => ({ items: [{ id: '1', kind: 'daily_award' as const, points: 10, createdAt: '2026-09-18T01:01:00Z', instanceId: syncResponse.instanceId }], nextCursor: null })),
  };
}
function fixture() { const client = api(); const flow = createActivitySyncCoordinator({ api: client, randomUUID }); flow.setContext({ accountId: 'account-a', cloudSync: true }); return { client, flow }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const sample = (extra: Partial<StepSample> = {}): StepSample => ({ id: 'sample-a', startAt: '2026-09-18T00:00:00Z', endAt: '2026-09-18T01:00:00Z', count: 3000, source: { id: pin.sourceId, category: pin.sourceCategory, isManual: false }, ...extra });

describe('minimum activity summary preparation', () => {
  it('uses the pinned eligible total and selected day sample time, never raw source IDs or fetch time', () => {
    const yesterday = '2026-09-17';
    const samples = [sample({ startAt: '2026-09-17T00:00:00Z', endAt: '2026-09-17T01:00:00Z' }), sample({ id: 'other', startAt: '2026-09-17T02:00:00Z', endAt: '2026-09-17T03:00:00Z', count: 9000, source: { id: 'watch', category: 'apple_watch', isManual: false } }), sample({ id: 'manual', startAt: '2026-09-17T04:00:00Z', endAt: '2026-09-17T05:00:00Z', count: 10000, source: { ...sample().source, isManual: true } })];
    const steps = aggregateSteps({ taskDate: yesterday, samples, pinnedSource: pin });
    const observedAt = latestEligibleObservation({ taskDate: yesterday, samples, pin });
    const prepared = prepareActivitySummary({ taskDate: yesterday, steps, observedAt, revision: 4 });
    expect(prepared).toMatchObject({ eligibleSteps: 3000, observedAt: '2026-09-17T01:00:00.000Z', revision: 4, sourcePinToken: pin.pinToken });
    expect(JSON.stringify(prepared)).not.toContain(pin.sourceId);
    expect(Object.keys(prepared).sort()).toEqual(['taskDate', 'eligibleSteps', 'sourceCategory', 'sourcePolicy', 'sourcePinToken', 'revision', 'observedAt', 'timezone'].sort());
    expect(() => prepareActivitySummary({ taskDate: yesterday, steps, observedAt: '2026-09-18T01:00:00Z', revision: 4 })).toThrow('INVALID_INPUT');
  });
  it('keeps zero distinct from no data and excludes cross-day or manual observation timestamps', () => {
    const zero = aggregateSteps({ taskDate, samples: [sample({ count: 0 })], pinnedSource: pin });
    expect(prepareActivitySummary({ taskDate, steps: zero, observedAt: sample().endAt, revision: 1 }).eligibleSteps).toBe(0);
    const missing = aggregateSteps({ taskDate, samples: [], pinnedSource: pin });
    expect(() => prepareActivitySummary({ taskDate, steps: missing, observedAt: null, revision: 1 })).toThrow('NO_DATA');
    expect(latestEligibleObservation({ taskDate, samples: [sample({ startAt: '2026-09-17T00:00:00Z' })], pin })).toBeNull();
  });
});

describe('activity sync coordinator', () => {
  it('returns only canonical refreshed points and ledger, not the claim balance', async () => {
    const { client, flow } = fixture(); const result = await flow.submit(input());
    expect(result.points.availablePoints).toBe(10); expect(result.claim?.balance).toBe(99);
    expect(result.ledger.items.reduce((total, row) => total + row.points, 0)).toBe(result.points.availablePoints);
    expect(client.claimMission).toHaveBeenCalledOnce(); expect(flow.pending(taskDate)).toBeNull();
  });
  it('replays the exact frozen summary and revision after a lost successful sync response', async () => {
    const { client, flow } = fixture(); client.syncActivity.mockRejectedValueOnce(new CoreApiError('NETWORK_ERROR', 0));
    const body = input(); await expect(flow.submit(body)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    body.eligibleSteps = 7000; body.revision = 2;
    expect(client.claimMission).not.toHaveBeenCalled(); expect(flow.pending(taskDate)).toEqual({ taskDate, revision: 1, stage: 'sync' });
    await flow.retry(taskDate); expect(client.syncActivity.mock.calls[0]?.[0]).toEqual(client.syncActivity.mock.calls[1]?.[0]);
    expect(client.syncActivity.mock.calls[1]?.[0].eligibleSteps).toBe(3000);
  });
  it('uses the same claim key after a committed claim response was lost', async () => {
    const { client, flow } = fixture(); client.claimMission.mockRejectedValueOnce(new CoreApiError('TIMEOUT', 0));
    await expect(flow.submit(input())).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(flow.pending(taskDate)?.stage).toBe('claim'); await flow.retry(taskDate);
    expect(client.syncActivity).toHaveBeenCalledOnce(); expect(client.claimMission).toHaveBeenCalledTimes(2);
    expect(client.claimMission.mock.calls[0]?.[1]).toBe(client.claimMission.mock.calls[1]?.[1]);
  });
  it('does not repeat successful sync or claim when canonical refresh needs retry', async () => {
    const { client, flow } = fixture(); client.getLedger.mockRejectedValueOnce(new CoreApiError('NETWORK_ERROR', 0));
    await expect(flow.submit(input())).rejects.toMatchObject({ code: 'NETWORK_ERROR' }); expect(flow.pending(taskDate)?.stage).toBe('refresh');
    await flow.retry(taskDate); expect(client.syncActivity).toHaveBeenCalledOnce(); expect(client.claimMission).toHaveBeenCalledOnce(); expect(client.getLedger).toHaveBeenCalledTimes(2);
  });
  it('serializes identical submissions and rejects replacement until pending work finishes', async () => {
    const { client, flow } = fixture(); const wait = deferred<typeof syncResponse>(); client.syncActivity.mockImplementationOnce(() => wait.promise);
    const first = flow.submit(input()); const second = flow.submit(input());
    await expect(flow.submit({ ...input(), revision: 2, eligibleSteps: 5000 })).rejects.toMatchObject({ code: 'PENDING_SYNC' });
    wait.resolve(syncResponse); const results = await Promise.all([first, second]); expect(results[0]).toEqual(results[1]); expect(client.syncActivity).toHaveBeenCalledOnce(); expect(client.claimMission).toHaveBeenCalledOnce();
  });
  it('pauses immediately and retries its exact pending body only after confirmed resume', async () => {
    const { client, flow } = fixture(); const wait = deferred<typeof syncResponse>(); client.syncActivity.mockImplementationOnce(() => wait.promise);
    const attempt = flow.submit(input()); const cancelledAttempt = expect(attempt).rejects.toMatchObject({ code: 'CANCELLED' });
    await Promise.resolve(); flow.pause(); expect(client.syncActivity.mock.calls[0]?.[1]?.aborted).toBe(true);
    await expect(flow.retry(taskDate)).rejects.toMatchObject({ code: 'SYNC_PAUSED' });
    flow.setContext({ accountId: 'account-a', cloudSync: true }); const retry = flow.retry(taskDate);
    wait.resolve(syncResponse); await cancelledAttempt; await retry;
    expect(client.syncActivity).toHaveBeenCalledTimes(2); expect(client.syncActivity.mock.calls[0]?.[0]).toEqual(client.syncActivity.mock.calls[1]?.[0]); expect(client.claimMission).toHaveBeenCalledOnce();
  });
  it('withdrawal after sync response clears queued work before any claim', async () => {
    const { client, flow } = fixture(); client.syncActivity.mockImplementationOnce(async () => { flow.setContext({ accountId: 'account-a', cloudSync: false }); return syncResponse; });
    await expect(flow.submit(input())).rejects.toMatchObject({ code: 'CANCELLED' }); expect(client.claimMission).not.toHaveBeenCalled(); expect(flow.pending(taskDate)).toBeNull();
    flow.setContext({ accountId: 'account-a', cloudSync: true }); await expect(flow.retry(taskDate)).rejects.toMatchObject({ code: 'NO_PENDING_SYNC' });
  });
  it('account switch discards in-flight identity and can never retry it under a new account', async () => {
    const { client, flow } = fixture(); const wait = deferred<typeof syncResponse>(); client.syncActivity.mockImplementationOnce(() => wait.promise);
    const old = flow.submit(input()); const rejected = expect(old).rejects.toMatchObject({ code: 'CANCELLED' }); await Promise.resolve();
    flow.setContext({ accountId: 'account-b', cloudSync: true }); wait.resolve(syncResponse); await rejected;
    expect(client.claimMission).not.toHaveBeenCalled(); expect(flow.pending(taskDate)).toBeNull();
    await expect(flow.retry(taskDate)).rejects.toMatchObject({ code: 'NO_PENDING_SYNC' });
    await flow.submit({ ...input(), sourcePinToken: randomUUID() }); expect(client.claimMission).toHaveBeenCalledOnce();
  });
  it('pending review refreshes canonical state and never attempts a claim', async () => {
    const { client, flow } = fixture(); client.syncActivity.mockResolvedValueOnce({ ...syncResponse, status: 'pending_review' });
    const result = await flow.submit(input()); expect(result.status).toBe('pending_review'); expect(result.claim).toBeNull(); expect(client.claimMission).not.toHaveBeenCalled();
  });
  it('server consent denial clears pending and malformed or expired submissions are not queued', async () => {
    const { client, flow } = fixture(); client.syncActivity.mockRejectedValueOnce(new CoreApiError('CONSENT_REQUIRED', 403));
    await expect(flow.submit(input())).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' }); expect(flow.pending(taskDate)).toBeNull();
    flow.setContext({ accountId: 'account-a', cloudSync: true }); client.syncActivity.mockRejectedValueOnce(new CoreApiError('CUTOFF_PASSED', 409));
    await expect(flow.submit(input())).rejects.toMatchObject({ code: 'CUTOFF_PASSED' }); expect(flow.pending(taskDate)).toBeNull();
    await expect(flow.submit({ ...input(), eligibleSteps: -1 })).rejects.toMatchObject({ code: 'INVALID_INPUT' }); expect(flow.pending(taskDate)).toBeNull();
  });
  it('caller cancellation blocks advancing and remains retryable without reporting success', async () => {
    const { client, flow } = fixture(); const controller = new AbortController(); const wait = deferred<typeof syncResponse>(); client.syncActivity.mockImplementationOnce(() => wait.promise);
    const result = flow.submit(input(), { signal: controller.signal }); const rejected = expect(result).rejects.toMatchObject({ code: 'CANCELLED' }); await Promise.resolve(); controller.abort(); wait.resolve(syncResponse); await rejected;
    expect(client.claimMission).not.toHaveBeenCalled(); expect(flow.pending(taskDate)).not.toBeNull(); await flow.retry(taskDate); expect(client.claimMission).toHaveBeenCalledOnce();
  });
});
