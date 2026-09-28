import { describe, expect, it, vi } from 'vitest';
import { CoreApiError, createCoreClient } from './index';
const baseUrl = 'http://127.0.0.1:54321/functions/v1/core';
const points = { balance: 10, availablePoints: 10, pendingEvaluations: 0, earnedPoints: 10, spentPoints: 0, reversedPoints: 0, correctionPoints: 0 };
describe('authenticated core transport', () => {
  it('fails before sending without identity', async () => {
    const send = vi.fn();
    const client = createCoreClient({ baseUrl, accessToken: async () => null, fetch: send });
    await expect(client.getPointsSummary()).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
    expect(send).not.toHaveBeenCalled();
  });
  it('sends bearer header and no ambient browser cookies', async () => {
    const send = vi.fn(async () => Response.json({ data: points, requestId: 'safe-id' }));
    const client = createCoreClient({ baseUrl, accessToken: async () => 'local-test-token', fetch: send });
    expect(await client.getPointsSummary()).toEqual(points);
    expect(send).toHaveBeenCalledWith(`${baseUrl}/points/summary`, expect.objectContaining({ credentials: 'omit', headers: { Authorization: 'Bearer local-test-token', 'Content-Type': 'application/json' } }));
  });
  it('rejects malformed canonical state without substituting zero', async () => {
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: async () => Response.json({ availablePoints: '10' }) });
    await expect(client.getPointsSummary()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('returns stable errors/request id without echoing sensitive backend detail', async () => {
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: async () => Response.json({ error: { code: 'CONSENT_REQUIRED', detail: 'private-health-value' } }, { status: 403, headers: { 'x-request-id': 'safe-id' } }) });
    try { await client.getPointsSummary(); throw new Error('expected failure'); } catch (error) {
      expect(error).toBeInstanceOf(CoreApiError);
      expect(error).toMatchObject({ code: 'CONSENT_REQUIRED', requestId: 'safe-id', status: 403 });
      expect(String(error)).not.toContain('private-health');
    }
  });
  it('cancels a queued request while token lookup is pending', async () => {
    const abort = new AbortController();
    const send = vi.fn();
    const client = createCoreClient({ baseUrl, accessToken: async () => { abort.abort(); return 'test'; }, fetch: send });
    await expect(client.getPointsSummary(abort.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(send).not.toHaveBeenCalled();
  });
  it('rejects unsafe URLs and arbitrary record identifiers', () => {
    expect(() => createCoreClient({ baseUrl: 'http://remote.invalid', accessToken: async () => null })).toThrow('INVALID_API_URL');
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test' });
    expect(() => client.claimMission('../other-user', 'anything')).toThrow();
    expect(() => client.getLedger({ cursor: '0&user_id=other' })).toThrow();
    expect(() => client.getLedger({ limit: 10000 })).toThrow();
  });
  it('allows only explicitly enabled private LAN development hosts', () => {
    expect(() => createCoreClient({ baseUrl: 'http://192.168.1.5:54321/functions/v1/core', accessToken: async () => null })).toThrow();
    expect(() => createCoreClient({ baseUrl: 'http://192.168.1.5:54321/functions/v1/core', accessToken: async () => null, allowLocalDevelopment: true })).not.toThrow();
    expect(() => createCoreClient({ baseUrl: 'http://localhost.evil.invalid', accessToken: async () => null, allowLocalDevelopment: true })).toThrow();
    expect(() => createCoreClient({ baseUrl: 'http://10.evil.invalid', accessToken: async () => null, allowLocalDevelopment: true })).toThrow();
  });
  it('preserves submitted revision history in account exports', async () => {
    const exported = { exportedAt: '2026-09-18T01:00:00Z', profile: {}, consentEvents: [], activitySummaries: [], activityRevisions: [{ revision: 2, status: 'pending_review' }], missions: [], ledger: [], appeals: [], appealAdjustments: [], redemptions: [], notificationPreferences: { enabled: false, reminderTime: '19:00', quietStart: '22:00', quietEnd: '08:00', timezone: 'Asia/Hong_Kong', revision: 0, updatedAt: null } };
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: async () => Response.json({ data: exported, requestId: 'export-test' }) });
    expect(await client.exportAccount()).toEqual(exported);
  });
  it('does not retry writes automatically when network delivery is ambiguous', async () => {
    const send = vi.fn(async () => { throw new Error('socket closed'); });
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: send });
    await expect(client.claimMission('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('bounded requests and summary reconciliation', () => {
  it('reads the server summary used to resume monotonic revisions', async () => {
    const data = { items: [{ taskDate: '2026-09-18', eligibleSteps: 5000, sourceCategory: 'apple_phone', revision: 3, observedAt: '2026-09-18T01:00:00Z', receivedAt: '2026-09-18T01:00:02Z', timezone: 'Asia/Hong_Kong' }] };
    const send = vi.fn(async () => Response.json({ data, requestId: 'summary-test' }));
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: send });
    expect(await client.getHealthSummary()).toEqual(data);
    expect(send.mock.calls[0]).toEqual([`${baseUrl}/health/summary`, expect.objectContaining({ method: 'GET' })]);
  });
  it('rejects a demo summary returned to the real core client', async () => {
    const data = { items: [{ taskDate: '2026-09-18', eligibleSteps: 5000, sourceCategory: 'synthetic_demo', revision: 3, observedAt: '2026-09-18T01:00:00Z', receivedAt: '2026-09-18T01:00:02Z', timezone: 'Asia/Hong_Kong' }] };
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: async () => Response.json({ data, requestId: 'wrong-mode' }) });
    await expect(client.getHealthSummary()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('normalizes identity storage failure without reporting it as a network outage', async () => {
    const send = vi.fn();
    const client = createCoreClient({ baseUrl, accessToken: async () => { throw new Error('sensitive keychain detail'); }, fetch: send });
    await expect(client.getConsents()).rejects.toMatchObject({ code: 'SESSION_UNAVAILABLE', message: 'SESSION_UNAVAILABLE' });
    expect(send).not.toHaveBeenCalled();
  });
  it('bounds stalled identity lookup and prevents later dispatch', async () => {
    vi.useFakeTimers();
    try {
      let resolveToken!: (token: string) => void;
      const token = new Promise<string>(resolve => { resolveToken = resolve; });
      const send = vi.fn();
      const client = createCoreClient({ baseUrl, accessToken: () => token, fetch: send, timeoutMs: 25 });
      const result = expect(client.getConsents()).rejects.toMatchObject({ code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(25);
      await result;
      resolveToken('late-token');
      await vi.advanceTimersByTimeAsync(0);
      expect(send).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('settles and aborts a stalled transport without retrying an ambiguous write', async () => {
    vi.useFakeTimers();
    try {
      let transportSignal: AbortSignal | undefined;
      const send = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
        transportSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      });
      const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: send, timeoutMs: 25 });
      const result = expect(client.claimMission('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')).rejects.toMatchObject({ code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(25);
      await result;
      expect(transportSignal?.aborted).toBe(true);
      expect(send).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
  it('includes response decoding in the request deadline', async () => {
    vi.useFakeTimers();
    try {
      const response = Response.json({});
      response.json = () => new Promise(() => {});
      const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: async () => response, timeoutMs: 25 });
      const result = expect(client.getPointsSummary()).rejects.toMatchObject({ code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(25);
      await result;
    } finally { vi.useRealTimers(); }
  });
  it('settles caller cancellation even when identity lookup ignores cancellation', async () => {
    const abort = new AbortController();
    const send = vi.fn();
    const client = createCoreClient({ baseUrl, accessToken: () => new Promise(() => {}), fetch: send });
    const result = expect(client.getPointsSummary(abort.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
    abort.abort();
    await result;
    expect(send).not.toHaveBeenCalled();
  });
  it('removes its deadline after success and validates bounds', async () => {
    vi.useFakeTimers();
    try {
      const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: async () => Response.json({ data: points, requestId: 'ok' }) });
      await expect(client.getPointsSummary()).resolves.toEqual(points);
      expect(vi.getTimerCount()).toBe(0);
      for (const timeoutMs of [0, -1, NaN, 0.5, 120001]) expect(() => createCoreClient({ baseUrl, accessToken: async () => null, timeoutMs })).toThrow('INVALID_TIMEOUT');
    } finally { vi.useRealTimers(); }
  });
});

describe('demonstration rewards contract', () => {
  const rewardId = '00000000-0000-4000-8000-000000000011';
  const id = '00000000-0000-4000-8000-000000000012';
  const idempotencyKey = '00000000-0000-4000-8000-000000000013';
  const demoCode = '00000000-0000-4000-8000-000000000014';
  const createdAt = '2026-09-20T01:00:00Z';
  it('reads bounded canonical catalog/history and retains cancelled demonstrations', async () => {
    const reward = { id: rewardId, titleKey: 'demo_badge', pointsCost: 10, stock: 2, isDemo: true };
    const redemption = { id, rewardId, status: 'cancelled', demoCode, pointsCost: 10, createdAt };
    const send = vi.fn()
      .mockResolvedValueOnce(Response.json({ data: { items: [reward] }, requestId: 'catalog' }))
      .mockResolvedValueOnce(Response.json({ data: { items: [redemption], nextCursor: '1' }, requestId: 'history' }));
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: send });
    expect(await client.getRewards()).toEqual({ items: [reward] });
    expect(await client.getRedemptions({ limit: 1, cursor: '9007199254740993' })).toEqual({ items: [redemption], nextCursor: '1' });
    expect(send.mock.calls[1]?.[0]).toBe(`${baseUrl}/redemptions?limit=1&cursor=9007199254740993`);
  });
  it('rejects merchant-like or malformed reward responses instead of treating them as redeemable', async () => {
    for (const item of [
      { id: rewardId, titleKey: 'demo_badge', pointsCost: 10, stock: 2, isDemo: false },
      { id: rewardId, titleKey: 'demo_badge', pointsCost: 10, stock: -1, isDemo: true },
      { id: rewardId, titleKey: 'demo_badge', pointsCost: 10, stock: 2, isDemo: true, merchantSecret: 'not-for-client' },
    ]) {
      const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: async () => Response.json({ data: { items: [item] }, requestId: 'invalid' }) });
      await expect(client.getRewards()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });
  it('reuses only the caller-supplied redemption key after ambiguous delivery, then cancels by owned record ID', async () => {
    const body = { rewardId, idempotencyKey };
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('lost response after commit'))
      .mockResolvedValueOnce(Response.json({ data: { id, status: 'demonstration', demoCode, pointsCost: 10 }, requestId: 'retry' }))
      .mockResolvedValueOnce(Response.json({ data: { id, status: 'cancelled' }, requestId: 'cancel' }));
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: send });
    await expect(client.redeemReward(body)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(send).toHaveBeenCalledTimes(1);
    await expect(client.redeemReward(body)).resolves.toMatchObject({ id, status: 'demonstration' });
    expect(send.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(body));
    expect(send.mock.calls[1]?.[1]?.body).toBe(JSON.stringify(body));
    await expect(client.cancelRedemption(id)).resolves.toEqual({ id, status: 'cancelled' });
    expect(send.mock.calls[2]?.[0]).toBe(`${baseUrl}/redemptions/${id}/cancel`);
    expect(send.mock.calls[2]?.[1]?.body).toBe('{}');
  });
  it('rejects client amounts/identities and invalid pagination before dispatch', () => {
    const send = vi.fn();
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: send });
    for (const extra of [{ pointsCost: 1 }, { userId: id }, { amount: 999 }]) {
      expect(() => client.redeemReward({ rewardId, idempotencyKey, ...extra })).toThrow();
    }
    expect(() => client.getRedemptions({ cursor: '0' })).toThrow();
    expect(() => client.getRedemptions({ cursor: '1&userId=other' })).toThrow();
    expect(() => client.cancelRedemption('../other-account')).toThrow();
    expect(send).not.toHaveBeenCalled();
  });
  it('cancels all reward calls before identity lookup and does not dispatch a queued redemption after withdrawal', async () => {
    const abort = new AbortController(); abort.abort();
    const token = vi.fn(async () => 'test'); const send = vi.fn();
    const client = createCoreClient({ baseUrl, accessToken: token, fetch: send });
    for (const promise of [client.getRewards(abort.signal), client.getRedemptions({}, abort.signal), client.redeemReward({ rewardId, idempotencyKey }, abort.signal), client.cancelRedemption(id, abort.signal)]) {
      await expect(promise).rejects.toMatchObject({ code: 'CANCELLED' });
    }
    expect(token).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });
});
