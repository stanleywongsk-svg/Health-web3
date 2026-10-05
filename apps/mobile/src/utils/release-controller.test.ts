import { describe, expect, it, vi } from 'vitest';
import { CoreApiError, type CoreClient } from '@healthloop/api-client';
import { acceptsReleasePolicy, handleCurrentReleaseFailure, ReleaseController } from './release-controller';

const policy = { policyVersion: 'ios-hk-health-points-v1', storefront: 'HK', features: {
  healthActivity: true, points: true, platformBadges: true, walletConnection: false, nftPurchases: false,
  cryptoRewards: false, rewardedAds: false, inAppPurchases: false, demoRedemptions: false,
} } as const;
const badges = { items: [
  { id: 'first_steps', earned: true, earnedOn: '2026-10-05' },
  { id: 'consistent_week', earned: false, earnedOn: null },
], evaluatedAt: '2026-10-05T05:00:00Z' } as Awaited<ReturnType<CoreClient['getBadges']>>;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; };
function fixture() {
  const api = {
    getCapabilities: vi.fn<CoreClient['getCapabilities']>().mockResolvedValue(policy),
    getBadges: vi.fn<CoreClient['getBadges']>().mockResolvedValue(badges),
  };
  const controller = new ReleaseController(api); controller.setContext('a', true);
  return { api, controller };
}

describe('fixed shipping policy and canonical badge state', () => {
  it('accepts only the fixed storefront, version and complete flag set', () => {
    expect(acceptsReleasePolicy(policy)).toBe(true);
    expect(acceptsReleasePolicy({ ...policy, storefront: 'US' })).toBe(false);
    expect(acceptsReleasePolicy({ ...policy, policyVersion: 'new-policy' })).toBe(false);
    expect(acceptsReleasePolicy({ ...policy, provider: 'unexpected' })).toBe(false);
    for (const feature of Object.keys(policy.features)) {
      const features = { ...policy.features, [feature]: !policy.features[feature as keyof typeof policy.features] };
      expect(acceptsReleasePolicy({ ...policy, features })).toBe(false);
      const partial: Record<string, boolean> = { ...policy.features }; delete partial[feature];
      expect(acceptsReleasePolicy({ ...policy, features: partial })).toBe(false);
    }
    expect(acceptsReleasePolicy({ ...policy, features: { ...policy.features, extraPurchases: true } })).toBe(false);
    expect(acceptsReleasePolicy(null)).toBe(false);
  });
  it('requires verified policy and renders only server returned badge eligibility', async () => {
    const { controller, api } = fixture(); expect(() => controller.assertEarningAllowed()).toThrow('RELEASE_POLICY_REQUIRED');
    await controller.refresh(); expect(controller.getSnapshot()).toMatchObject({ policy: 'verified', badgeStatus: 'ready', badges });
    expect(() => controller.assertEarningAllowed()).not.toThrow();
    expect(api.getCapabilities).toHaveBeenCalledOnce(); expect(api.getBadges).toHaveBeenCalledOnce();
  });
  it('rejects unsupported capabilities before fetching badges without touching account actions', async () => {
    const { controller, api } = fixture();
    api.getCapabilities.mockResolvedValue({ ...policy, features: { ...policy.features, walletConnection: true } } as unknown as typeof policy);
    await expect(controller.refresh()).rejects.toMatchObject({ code: 'RELEASE_POLICY_REQUIRED' });
    expect(controller.getSnapshot()).toMatchObject({ accountId: 'a', policy: 'mismatch', badges: null });
    expect(() => controller.assertEarningAllowed()).toThrow(); expect(api.getBadges).not.toHaveBeenCalled();
  });
  it('clears previous badges on refresh and does not show them after a failed query', async () => {
    const { controller, api } = fixture(); await controller.refresh();
    api.getBadges.mockRejectedValue(new CoreApiError('NETWORK_ERROR', 0));
    const refresh = controller.refresh(); expect(controller.getSnapshot().badges).toBeNull();
    await expect(refresh).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(controller.getSnapshot()).toMatchObject({ policy: 'verified', badgeStatus: 'unavailable', badges: null });
  });
  it('fails closed when capability refresh fails after a previous success', async () => {
    const { controller, api } = fixture(); await controller.refresh(); api.getCapabilities.mockRejectedValue(new CoreApiError('TIMEOUT', 0));
    await expect(controller.refresh()).rejects.toThrow('TIMEOUT');
    expect(controller.getSnapshot()).toMatchObject({ policy: 'unavailable', badges: null });
    expect(() => controller.assertEarningAllowed()).toThrow();
  });
  it('never displays a late badge response belonging to a previous account', async () => {
    const { controller, api } = fixture(); const response = deferred<typeof badges>();
    api.getBadges.mockReturnValueOnce(response.promise); const pending = controller.refresh();
    while (api.getBadges.mock.calls.length === 0) await Promise.resolve();
    controller.setContext('b', true); response.resolve(badges);
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(controller.getSnapshot()).toMatchObject({ accountId: 'b', policy: 'unverified', badges: null });
  });
  it.each(['UNAUTHENTICATED','ACCOUNT_INACTIVE'])('turns stale rejected badge reads into cancellation instead of forwarding %s to the new account',async code=>{
    const {controller,api}=fixture();let reject!:(error:unknown)=>void;
    api.getBadges.mockReturnValueOnce(new Promise((_resolve,fail)=>{reject=fail}));
    const pending=controller.refresh();while(api.getBadges.mock.calls.length===0)await Promise.resolve();
    controller.setContext('b',true);reject(new CoreApiError(code,401));
    await expect(pending).rejects.toMatchObject({code:'CANCELLED'});
    expect(controller.getSnapshot()).toMatchObject({accountId:'b',policy:'unverified',badges:null});
  });
  it('checks account ownership again before forwarding a completed authentication failure',async()=>{
    const forwarded=vi.fn(async()=>{});let epoch=1;const error=new CoreApiError('UNAUTHENTICATED',401);
    const completion=Promise.reject(error).catch(failure=>handleCurrentReleaseFailure(failure,()=>epoch===1,forwarded));
    epoch=2;await completion;expect(forwarded).not.toHaveBeenCalled();
    await handleCurrentReleaseFailure(error,()=>true,forwarded);expect(forwarded).toHaveBeenCalledExactlyOnceWith(error);
  });
  it.each(['INVALID_RESPONSE','NOT_SUPPORTED','TIMEOUT','RELEASE_POLICY_REQUIRED'])('does not deny privacy or account actions for release failure %s',async code=>{
    const forwarded=vi.fn(async()=>{});await handleCurrentReleaseFailure(new CoreApiError(code,503),()=>true,forwarded);
    expect(forwarded).not.toHaveBeenCalled();
  });
  it('clears badges and permission to earn when offline or signed out', async () => {
    const { controller } = fixture(); await controller.refresh(); controller.setContext('a', false);
    expect(controller.getSnapshot()).toMatchObject({ policy: 'unverified', badges: null });
    expect(() => controller.assertEarningAllowed()).toThrow();
    await expect(controller.refresh()).rejects.toMatchObject({ code: 'RECONNECT_REQUIRED' });
    controller.setContext(null, false); expect(controller.getSnapshot().accountId).toBeNull();
  });
  it('invalidates old badge reads before an activity mutation and accepts corrected results only on refresh', async () => {
    const { controller, api } = fixture(); await controller.refresh();
    const response = deferred<typeof badges>(); api.getBadges.mockReturnValueOnce(response.promise);
    const old = controller.refresh(); while (api.getBadges.mock.calls.length < 2) await Promise.resolve();
    controller.invalidateBadges(); expect(controller.getSnapshot().badges).toBeNull(); response.resolve(badges);
    await expect(old).rejects.toMatchObject({ code: 'CANCELLED' });
    const corrected = { ...badges, items: badges.items.map(item => ({ ...item, earned: false, earnedOn: null })) };
    api.getBadges.mockResolvedValue(corrected); await controller.refresh();
    expect(controller.getSnapshot().badges).toEqual(corrected);
  });
  it('rejects a superseded response instead of overwriting a newer badge refresh', async () => {
    const { controller, api } = fixture(); const response = deferred<typeof badges>(); api.getBadges.mockReturnValueOnce(response.promise);
    const old = controller.refresh(); while (api.getBadges.mock.calls.length === 0) await Promise.resolve();
    const latest = { ...badges, evaluatedAt: '2026-10-05T06:00:00Z' }; api.getBadges.mockResolvedValue(latest);
    await controller.refresh(); response.resolve(badges); await expect(old).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(controller.getSnapshot().badges).toEqual(latest);
  });
  it('leaves an interrupted refresh retryable without stale earned badges', async () => {
    const { controller, api } = fixture(); const response = deferred<typeof badges>(); api.getBadges.mockReturnValueOnce(response.promise);
    const signal = new AbortController(); const pending = controller.refresh(signal.signal);
    while (api.getBadges.mock.calls.length === 0) await Promise.resolve(); signal.abort(); response.resolve(badges);
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(controller.getSnapshot()).toMatchObject({ badgeStatus: 'unavailable', badges: null });
    await controller.refresh(); expect(controller.getSnapshot().badgeStatus).toBe('ready');
  });
});
