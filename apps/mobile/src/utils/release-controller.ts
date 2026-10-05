import { CoreApiError, type CoreClient } from '@healthloop/api-client';

type Api = Pick<CoreClient, 'getCapabilities' | 'getBadges'>;
type Badges = Awaited<ReturnType<Api['getBadges']>>;
export interface ReleaseState {
  accountId: string | null;
  policy: 'unverified' | 'loading' | 'verified' | 'unavailable' | 'mismatch';
  badgeStatus: 'unverified' | 'loading' | 'ready' | 'unavailable';
  badges: Badges | null;
}
const expectedFeatures = {
  healthActivity: true, points: true, platformBadges: true,
  walletConnection: false, nftPurchases: false, cryptoRewards: false,
  rewardedAds: false, inAppPurchases: false, demoRedemptions: false,
} as const;

/** Fixed shipping policy. A server response never remotely enables a purchase or reward path. */
export function acceptsReleasePolicy(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const policy = value as Record<string, unknown>;
  if (Object.keys(policy).length !== 3 || policy.policyVersion !== 'ios-hk-health-points-v1' || policy.storefront !== 'HK'
    || !policy.features || typeof policy.features !== 'object') return false;
  const features = policy.features as Record<string, unknown>;
  return Object.keys(features).length === Object.keys(expectedFeatures).length
    && Object.entries(expectedFeatures).every(([key, expected]) => features[key] === expected);
}

/** Release availability failures are local to earning; only this account's auth failure affects consent. */
export async function handleCurrentReleaseFailure(error: unknown, isCurrent: () => boolean, handleAuthenticationFailure: (error: unknown) => Promise<void>): Promise<void> {
  if (!isCurrent()) return;
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (['UNAUTHENTICATED', 'ACCOUNT_INACTIVE', 'ACCOUNT_DELETED', 'SESSION_UNAVAILABLE'].includes(code)) await handleAuthenticationFailure(error);
}

/** No disk cache or optimistic badge awards; invalidation hides old badges immediately. */
export class ReleaseController {
  private state: ReleaseState = { accountId: null, policy: 'unverified', badgeStatus: 'unverified', badges: null };
  private verifiedAccount = false;
  private generation = 0;
  private request: AbortController | null = null;
  private listeners = new Set<() => void>();
  constructor(private readonly api: Api) {}
  readonly getSnapshot = () => this.state;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(update: Partial<ReleaseState>) { this.state = { ...this.state, ...update }; for (const listener of this.listeners) listener(); }
  setContext(accountId: string | null, verified: boolean) {
    const nextVerified = accountId !== null && verified;
    if (accountId !== this.state.accountId || this.verifiedAccount !== nextVerified) {
      this.generation++; this.request?.abort(); this.request = null;
      this.publish({ accountId, policy: 'unverified', badgeStatus: 'unverified', badges: null });
    }
    this.verifiedAccount = nextVerified;
  }
  assertEarningAllowed() {
    if (!this.verifiedAccount || !this.state.accountId || this.state.policy !== 'verified') throw new CoreApiError('RELEASE_POLICY_REQUIRED', 0);
  }
  invalidateBadges() {
    this.generation++; this.request?.abort(); this.request = null;
    this.publish({ badgeStatus: 'unverified', badges: null });
  }
  async refresh(signal?: AbortSignal): Promise<void> {
    if (!this.state.accountId || !this.verifiedAccount) throw new CoreApiError('RECONNECT_REQUIRED', 0);
    this.request?.abort(); const request = new AbortController(); this.request = request;
    const generation = ++this.generation;
    const abort = () => request.abort(); signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) request.abort();
    const current = () => generation === this.generation && this.verifiedAccount && !request.signal.aborted;
    const assertCurrent = () => { if (!current()) throw new CoreApiError('CANCELLED', 0); };
    this.publish({ policy: 'loading', badgeStatus: 'loading', badges: null });
    try {
      assertCurrent(); const policy = await this.api.getCapabilities(request.signal); assertCurrent();
      if (!acceptsReleasePolicy(policy)) { this.publish({ policy: 'mismatch', badgeStatus: 'unavailable' }); throw new CoreApiError('RELEASE_POLICY_REQUIRED', 0); }
      this.publish({ policy: 'verified' });
      const badges = await this.api.getBadges(request.signal); assertCurrent();
      this.publish({ badges, badgeStatus: 'ready' });
    } catch (error) {
      if (generation === this.generation && this.verifiedAccount) this.publish({ policy: this.state.policy === 'loading' ? 'unavailable' : this.state.policy, badgeStatus: 'unavailable', badges: null });
      // A stale rejection is as account-sensitive as a stale successful response.
      if (!current()) throw new CoreApiError('CANCELLED', 0);
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
      if (this.request === request) this.request = null;
    }
  }
}
