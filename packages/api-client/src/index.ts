import { z } from 'zod';
import {
  activitySyncSchema, claimSchema, consentSchema, appealSchema, recordPageSchema,
  rewardsResultSchema, redeemRewardSchema, redeemResultSchema, redemptionPageSchema, cancelRedemptionResultSchema,
  pointsSummarySchema, ledgerPageSchema, appealPageSchema, adminReviewPageSchema, appealAdjustmentExportSchema,
  proposeAppealSchema, decideAppealSchema, proposeAppealResultSchema, decideAppealResultSchema,
  notificationPreferencesSchema, setNotificationPreferencesSchema,
  missionsResultSchema, releasePolicySchema, badgesResultSchema,
  type ActivitySyncInput, type RecordPageInput, type RedeemRewardInput, type ProposeAppealInput, type DecideAppealInput, type AppealAdjustmentExport,
  type NotificationPreferences, type NotificationPreferencesInput,
} from '@healthloop/domain';
export type {
  Reward, Redemption, RedemptionPage, RedeemResult, CancelRedemptionResult, RecordPageInput, RedeemRewardInput,
  PointsSummary, LedgerEntry, LedgerPage, Appeal, AppealPage, AppealProposal, AppealAdjustmentExport, AdminReview, AdminReviewPage,
  ProposeAppealInput, DecideAppealInput, ProposeAppealResult, DecideAppealResult,
  NotificationPreferences, NotificationPreferencesInput,
  Mission, MissionsResult, ReleasePolicy, PlatformBadge, BadgesResult,
} from '@healthloop/domain';

export class CoreApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly requestId?: string) {
    super(code); this.name = 'CoreApiError';
  }
}
const profileSchema = z.object({ id: z.string(), status: z.string(), adultConfirmed: z.boolean(), localRead: z.boolean(), cloudSync: z.boolean(), marketing: z.boolean(), consentVersion: z.string().nullable() });
const consentsSchema = z.object({ profile: profileSchema.nullable() });
const claimResultSchema = z.object({ instanceId: z.string(), addedPoints: z.number(), dailyAwardedPoints: z.number(), weeklyAwardedPoints: z.number(), balance: z.number() });
const healthSummarySchema = z.object({ items: z.array(z.object({ taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), eligibleSteps: z.number().int().nonnegative(), sourceCategory: z.enum(['apple_phone', 'apple_watch']), revision: z.number().int().positive(), observedAt: z.string(), receivedAt: z.string(), timezone: z.literal('Asia/Hong_Kong') })) });
export type HealthSummary = z.infer<typeof healthSummarySchema>;
export type ConsentInput = z.infer<typeof consentSchema>;
export type ConsentState = z.infer<typeof consentsSchema>;
export type ClaimResult = z.infer<typeof claimResultSchema>;
export type AccountExport = { exportedAt: string; profile: unknown; consentEvents: unknown[]; activitySummaries: unknown[]; activityRevisions: unknown[]; missions: unknown[]; ledger: unknown[]; appeals: unknown[]; appealAdjustments: AppealAdjustmentExport[]; redemptions: unknown[]; notificationPreferences: NotificationPreferences };

function pageQuery(page: RecordPageInput): string {
  const { limit, cursor } = recordPageSchema.parse(page);
  return `?limit=${limit}${cursor === undefined ? '' : `&cursor=${cursor}`}`;
}

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
    getCapabilities: (signal?: AbortSignal) => request('/app/capabilities', 'GET', releasePolicySchema, undefined, signal),
    getBadges: (signal?: AbortSignal) => request('/badges', 'GET', badgesResultSchema, undefined, signal),
    getConsents: (signal?: AbortSignal) => request('/account/consents', 'GET', consentsSchema, undefined, signal),
    setConsents: (input: ConsentInput, signal?: AbortSignal) => request('/account/consents', 'POST', consentsSchema, consentSchema.parse(input), signal),
    getNotificationPreferences: (signal?: AbortSignal) => request('/account/notification-preferences', 'GET', notificationPreferencesSchema, undefined, signal),
    setNotificationPreferences: (input: NotificationPreferencesInput, signal?: AbortSignal) => {
      const body = setNotificationPreferencesSchema.parse(input);
      const resultSchema = notificationPreferencesSchema.refine(p => p.enabled === body.enabled && p.reminderTime === body.reminderTime
        && p.quietStart === body.quietStart && p.quietEnd === body.quietEnd && p.timezone === body.timezone);
      return request('/account/notification-preferences', 'POST', resultSchema, body, signal);
    },
    syncActivity: (input: ActivitySyncInput, signal?: AbortSignal) => request('/activity/sync', 'POST', z.object({ instanceId: z.string(), taskDate: z.string(), eligibleSteps: z.number().nullable(), status: z.enum(['accepted', 'pending_review']), revision: z.number(), sourceCategory: z.string(), ruleVersion: z.string() }), activitySyncSchema.parse(input), signal),
    getHealthSummary: (signal?: AbortSignal) => request('/health/summary', 'GET', healthSummarySchema, undefined, signal),
    getMissions: (signal?: AbortSignal) => request('/missions', 'GET', missionsResultSchema, undefined, signal),
    claimMission: (instanceId: string, idempotencyKey: string, signal?: AbortSignal) => request(`/missions/${z.uuid().parse(instanceId)}/claim`, 'POST', claimResultSchema, claimSchema.parse({ idempotencyKey }), signal),
    getPointsSummary: (signal?: AbortSignal) => request('/points/summary', 'GET', pointsSummarySchema, undefined, signal),
    getLedger: (page: RecordPageInput = {}, signal?: AbortSignal) => request(`/points/ledger${pageQuery(page)}`, 'GET', ledgerPageSchema, undefined, signal),
    getRewards: (signal?: AbortSignal) => request('/rewards', 'GET', rewardsResultSchema, undefined, signal),
    getRedemptions: (page: RecordPageInput = {}, signal?: AbortSignal) => request(`/redemptions${pageQuery(page)}`, 'GET', redemptionPageSchema, undefined, signal),
    redeemReward: (input: RedeemRewardInput, signal?: AbortSignal) => request('/redemptions', 'POST', redeemResultSchema, redeemRewardSchema.parse(input), signal),
    cancelRedemption: (id: string, signal?: AbortSignal) => request(`/redemptions/${z.uuid().parse(id)}/cancel`, 'POST', cancelRedemptionResultSchema, {}, signal),
    exportAccount: (signal?: AbortSignal) => request('/account/export', 'POST', z.object({ exportedAt: z.string(), profile: z.unknown(), consentEvents: z.array(z.unknown()), activitySummaries: z.array(z.unknown()), activityRevisions: z.array(z.unknown()), missions: z.array(z.unknown()), ledger: z.array(z.unknown()), appeals: z.array(z.unknown()), appealAdjustments: z.array(appealAdjustmentExportSchema), redemptions: z.array(z.unknown()), notificationPreferences: notificationPreferencesSchema }), {}, signal),
    deleteAccount: (signal?: AbortSignal) => request('/account', 'DELETE', z.object({ jobId: z.string(), status: z.literal('deletion_requested') }), {}, signal),
    createAppeal: (input: z.infer<typeof appealSchema>, signal?: AbortSignal) => request('/appeals', 'POST', z.object({ id: z.string(), status: z.literal('open') }), appealSchema.parse(input), signal),
    getAppeals: (page: RecordPageInput = {}, signal?: AbortSignal) => request(`/appeals${pageQuery(page)}`, 'GET', appealPageSchema, undefined, signal),
    getAdminReviews: (page: RecordPageInput = {}, signal?: AbortSignal) => request(`/admin/reviews${pageQuery(page)}`, 'GET', adminReviewPageSchema, undefined, signal),
    proposeAppeal: (input: ProposeAppealInput, signal?: AbortSignal) => {
      const body = proposeAppealSchema.parse(input);
      return request('/admin/adjustments', 'POST', proposeAppealResultSchema.refine((r) => r.appealId.toLowerCase() === body.appealId.toLowerCase() && r.revision === body.revision), body, signal);
    },
    decideAppeal: (id: string, input: DecideAppealInput, signal?: AbortSignal) => {
      const proposalId = z.uuid().parse(id); const body = decideAppealSchema.parse(input);
      return request(`/admin/adjustments/${proposalId}/decision`, 'POST', decideAppealResultSchema.refine((r) => r.id.toLowerCase() === proposalId.toLowerCase() && r.decision === body.decision), body, signal);
    },
  };
}
export type CoreClient = ReturnType<typeof createCoreClient>;
