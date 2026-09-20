import { z } from 'zod';
import { activitySyncSchema, claimSchema, consentSchema, appealSchema, type ActivitySyncInput } from '@healthloop/domain';

export class CoreApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly requestId?: string) {
    super(code); this.name = 'CoreApiError';
  }
}
const profileSchema = z.object({ id: z.string(), status: z.string(), adultConfirmed: z.boolean(), localRead: z.boolean(), cloudSync: z.boolean(), marketing: z.boolean(), consentVersion: z.string().nullable() });
const consentsSchema = z.object({ profile: profileSchema.nullable() });
const missionSchema = z.object({ id: z.string(), kind: z.enum(['daily_steps', 'weekly_consistency']), periodStart: z.string(), ruleVersion: z.string(), selectedGoal: z.number(), awardedPoints: z.number(), eligibleSteps: z.number().nullable(), cutoffAt: z.string(), tiers: z.array(z.object({ steps: z.number(), points: z.number() })), weeklyDaysRequired: z.number(), weeklyBonusPoints: z.number() });
const pointsSchema = z.object({ availablePoints: z.number(), pendingEvaluations: z.number(), earnedPoints: z.number(), spentPoints: z.number(), reversedPoints: z.number() });
const ledgerSchema = z.object({ items: z.array(z.object({ id: z.string(), kind: z.enum(['daily_award', 'weekly_award', 'redemption', 'refund']), points: z.number(), createdAt: z.string(), instanceId: z.string().nullable() })), nextCursor: z.string().nullable() });
const claimResultSchema = z.object({ instanceId: z.string(), addedPoints: z.number(), dailyAwardedPoints: z.number(), weeklyAwardedPoints: z.number(), balance: z.number() });
const healthSummarySchema = z.object({ items: z.array(z.object({ taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), eligibleSteps: z.number().int().nonnegative(), sourceCategory: z.enum(['apple_phone', 'apple_watch']), revision: z.number().int().positive(), observedAt: z.string(), receivedAt: z.string(), timezone: z.literal('Asia/Hong_Kong') })) });
export type HealthSummary = z.infer<typeof healthSummarySchema>;
export type ConsentInput = z.infer<typeof consentSchema>;
export type ConsentState = z.infer<typeof consentsSchema>;
export type Mission = z.infer<typeof missionSchema>;
export type PointsSummary = z.infer<typeof pointsSchema>;
export type LedgerPage = z.infer<typeof ledgerSchema>;
export type ClaimResult = z.infer<typeof claimResultSchema>;
export type AccountExport = { exportedAt: string; profile: unknown; consentEvents: unknown[]; activitySummaries: unknown[]; activityRevisions: unknown[]; missions: unknown[]; ledger: unknown[]; appeals: unknown[]; redemptions: unknown[] };

export function createCoreClient(options: { baseUrl: string; accessToken: () => Promise<string | null>; fetch?: typeof fetch; allowLocalDevelopment?: boolean; timeoutMs?: number }) {
  const url = new URL(options.baseUrl);
  const parts = url.hostname.split('.').map(Number);
  const privateV4 = parts.length === 4 && parts.every(p => Number.isInteger(p) && p >= 0 && p <= 255) && (parts[0] === 10 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && (parts[1] ?? -1) >= 16 && (parts[1] ?? -1) <= 31));
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || (options.allowLocalDevelopment === true && privateV4);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHost))) throw new CoreApiError('INVALID_API_URL', 0);
  const base = options.baseUrl.replace(/\/$/, '');
  const transport = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new CoreApiError('INVALID_TIMEOUT', 0);
  async function request<T>(path: string, method: string, schema: z.ZodType<T>, body?: unknown, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw new CoreApiError('CANCELLED', 0);
    const controller = new AbortController();
    let stopped: CoreApiError | undefined;
    let rejectAbort!: (error: CoreApiError) => void;
    const interrupted = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const stop = (code: 'CANCELLED' | 'TIMEOUT') => {
      if (stopped) return;
      stopped = new CoreApiError(code, 0);
      rejectAbort(stopped);
      controller.abort();
    };
    const onAbort = () => stop('CANCELLED');
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => stop('TIMEOUT'), timeoutMs);
    if (signal?.aborted) onAbort();
    const assertActive = () => { if (stopped) throw stopped; };
    async function execute(): Promise<T> {
      assertActive();
      let token: string | null;
      try { token = await options.accessToken(); } catch {
        assertActive();
        throw new CoreApiError('SESSION_UNAVAILABLE', 0);
      }
      assertActive();
      if (!token) throw new CoreApiError('UNAUTHENTICATED', 401);
      let response: Response;
      try {
        response = await transport(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, credentials: 'omit', body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      } catch {
        assertActive();
        throw new CoreApiError('NETWORK_ERROR', 0);
      }
      assertActive();
      const requestId = response.headers.get('x-request-id') ?? undefined;
      let payload: unknown;
      try { payload = await response.json(); } catch {
        assertActive();
        throw new CoreApiError('INVALID_RESPONSE', response.status, requestId);
      }
      assertActive();
      if (!response.ok) {
        const error = z.object({ error: z.object({ code: z.string() }) }).safeParse(payload);
        throw new CoreApiError(error.success ? error.data.error.code : 'SERVICE_ERROR', response.status, requestId);
      }
      const parsed = z.object({ data: schema, requestId: z.string() }).safeParse(payload);
      if (!parsed.success) throw new CoreApiError('INVALID_RESPONSE', response.status, requestId);
      return parsed.data.data;
    }
    // Bound identity lookup and body decoding too, including transports that ignore abort.
    // A timed-out write may have committed: reconciliation belongs to the caller, never an automatic retry.
    try { return await Promise.race([interrupted, execute()]); } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  return {
    getConsents: (signal?: AbortSignal) => request('/account/consents', 'GET', consentsSchema, undefined, signal),
    setConsents: (input: ConsentInput, signal?: AbortSignal) => request('/account/consents', 'POST', consentsSchema, consentSchema.parse(input), signal),
    syncActivity: (input: ActivitySyncInput, signal?: AbortSignal) => request('/activity/sync', 'POST', z.object({ instanceId: z.string(), taskDate: z.string(), eligibleSteps: z.number().nullable(), status: z.enum(['accepted', 'pending_review']), revision: z.number(), sourceCategory: z.string(), ruleVersion: z.string() }), activitySyncSchema.parse(input), signal),
    getHealthSummary: (signal?: AbortSignal) => request('/health/summary', 'GET', healthSummarySchema, undefined, signal),
    getMissions: (signal?: AbortSignal) => request('/missions', 'GET', z.object({ items: z.array(missionSchema) }), undefined, signal),
    claimMission: (instanceId: string, idempotencyKey: string, signal?: AbortSignal) => request(`/missions/${z.uuid().parse(instanceId)}/claim`, 'POST', claimResultSchema, claimSchema.parse({ idempotencyKey }), signal),
    getPointsSummary: (signal?: AbortSignal) => request('/points/summary', 'GET', pointsSchema, undefined, signal),
    getLedger: (page: { limit?: number; cursor?: string } = {}, signal?: AbortSignal) => {
      const limit = z.number().int().min(1).max(100).parse(page.limit ?? 20);
      const cursor = page.cursor === undefined ? '' : `&cursor=${z.string().regex(/^\d+$/).parse(page.cursor)}`;
      return request(`/points/ledger?limit=${limit}${cursor}`, 'GET', ledgerSchema, undefined, signal);
    },
    exportAccount: (signal?: AbortSignal) => request('/account/export', 'POST', z.object({ exportedAt: z.string(), profile: z.unknown(), consentEvents: z.array(z.unknown()), activitySummaries: z.array(z.unknown()), activityRevisions: z.array(z.unknown()), missions: z.array(z.unknown()), ledger: z.array(z.unknown()), appeals: z.array(z.unknown()), redemptions: z.array(z.unknown()) }), {}, signal),
    deleteAccount: (signal?: AbortSignal) => request('/account', 'DELETE', z.object({ jobId: z.string(), status: z.literal('deletion_requested') }), {}, signal),
    createAppeal: (input: z.infer<typeof appealSchema>, signal?: AbortSignal) => request('/appeals', 'POST', z.object({ id: z.string(), status: z.literal('open') }), appealSchema.parse(input), signal),
  };
}
export type CoreClient = ReturnType<typeof createCoreClient>;
