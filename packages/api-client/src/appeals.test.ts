import { describe, expect, it, vi } from 'vitest';
import { createCoreClient } from './index';

const baseUrl = 'http://127.0.0.1:54321/functions/v1/core';
const appealId = '00000000-0000-4000-8000-000000000021';
const proposalId = '00000000-0000-4000-8000-000000000022';
const idempotencyKey = '00000000-0000-4000-8000-000000000023';
const subjectId = '00000000-0000-4000-8000-000000000024';
const reason = '核实已保存的修订与申诉说明';
const createdAt = '2026-09-20T01:00:00Z';
const pending = { id: proposalId, revision: 2, status: 'pending', proposalReason: reason, decisionReason: null, createdAt, decidedAt: null };
const appeal = { id: appealId, sequenceId: '1', taskDate: '2026-09-18', reason, status: 'open', createdAt, proposals: [pending] };
const proposal = { id: proposalId, appealId, revision: 2, status: 'pending', createdAt };
const decision = { id: proposalId, appealId, status: 'approved', decision: 'approve', addedPoints: -50, dailyDelta: -30, weeklyDelta: -20, balance: -40, availablePoints: 0, decidedAt: createdAt };
const points = { balance: -40, availablePoints: 0, pendingEvaluations: 0, earnedPoints: 50, spentPoints: 40, reversedPoints: 0, correctionPoints: -50 };
const response = (data: unknown) => Response.json({ data, requestId: 'review-test' });
const clientWith = (data: unknown) => createCoreClient({ baseUrl, accessToken: async () => 'verified-test-token', fetch: async () => response(data) });

describe('scoped appeal and review contracts', () => {
  it('lists own appeals without subject identity and returns the minimal separately authorized review queue', async () => {
    const review = { ...appeal, subjectId, canonicalSummary: { eligibleSteps: 7000, revision: 1 }, pendingSubmissions: [{ revision: 2, eligibleSteps: 1000, sourceCategory: 'apple_watch', observedAt: createdAt, reason: 'downward_revision' }] };
    const send = vi.fn()
      .mockResolvedValueOnce(response({ items: [appeal], nextCursor: null }))
      .mockResolvedValueOnce(response({ items: [review], nextCursor: '1' }));
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: send });
    expect(await client.getAppeals()).toEqual({ items: [appeal], nextCursor: null });
    expect(await client.getAdminReviews({ limit: 5, cursor: '9007199254740993' })).toEqual({ items: [review], nextCursor: '1' });
    expect(send.mock.calls[0]?.[0]).toBe(`${baseUrl}/appeals?limit=20`);
    expect(send.mock.calls[1]?.[0]).toBe(`${baseUrl}/admin/reviews?limit=5&cursor=9007199254740993`);
  });
  it('cannot accept subject IDs on own appeals or raw health samples in an admin response', async () => {
    await expect(clientWith({ items: [{ ...appeal, subjectId }], nextCursor: null }).getAppeals()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    const review = { ...appeal, subjectId, canonicalSummary: null, pendingSubmissions: [{ revision: 2, eligibleSteps: 1000, sourceCategory: 'apple_watch', observedAt: createdAt, reason: 'downward_revision', rawSamples: [{ count: 1000 }] }] };
    await expect(clientWith({ items: [review], nextCursor: null }).getAdminReviews()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    delete (review.pendingSubmissions[0] as { rawSamples?: unknown }).rawSamples;
    review.pendingSubmissions[0]!.sourceCategory = 'synthetic_demo';
    await expect(clientWith({ items: [review], nextCursor: null }).getAdminReviews()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('requires complete pending/final decision state instead of showing unverified approvals', async () => {
    for (const invalid of [
      { ...pending, status: 'approved' },
      { ...pending, status: 'pending', decidedAt: createdAt },
      { ...pending, status: 'rejected', decidedAt: createdAt, decisionReason: '' },
    ]) {
      await expect(clientWith({ items: [{ ...appeal, proposals: [invalid] }], nextCursor: null }).getAppeals()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });
  it('exports reviewed corrections without admin identity or health-source credentials', async () => {
    const adjustment = { ...pending, appealId, taskDate: '2026-09-18' };
    const exported = { exportedAt: createdAt, profile: {}, consentEvents: [], activitySummaries: [], activityRevisions: [], missions: [], ledger: [], appeals: [], appealAdjustments: [adjustment], redemptions: [], notificationPreferences: { enabled: false, reminderTime: '19:00', quietStart: '22:00', quietEnd: '08:00', timezone: 'Asia/Hong_Kong', revision: 0, updatedAt: null } };
    expect(await clientWith(exported).exportAccount()).toEqual(exported);
    for (const extra of [{ operatorId: subjectId }, { reviewerId: subjectId }, { sourcePinToken: idempotencyKey }]) {
      await expect(clientWith({ ...exported, appealAdjustments: [{ ...adjustment, ...extra }] }).exportAccount()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });
  it('rejects arbitrary subject/points/health inputs before dispatching any proposal or decision', () => {
    const send = vi.fn(); const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: send });
    for (const extra of [{ userId: subjectId }, { points: -30 }, { amount: 50 }, { eligibleSteps: 3000 }, { approvedBy: subjectId }, { user_id: subjectId }]) {
      expect(() => client.proposeAppeal({ appealId, revision: 2, reason, idempotencyKey, ...extra })).toThrow();
      expect(() => client.decideAppeal(proposalId, { decision: 'approve', reason, idempotencyKey, ...extra })).toThrow();
    }
    expect(() => client.proposeAppeal({ appealId, revision: 2.5, reason, idempotencyKey })).toThrow();
    expect(() => client.decideAppeal('../another-account', { decision: 'approve', reason, idempotencyKey })).toThrow();
    expect(() => client.getAdminReviews({ limit: 101 })).toThrow();
    expect(send).not.toHaveBeenCalled();
  });
  it('requires caller-owned stable operation keys and never automatically retries an ambiguous approval', async () => {
    const proposalInput = { appealId, revision: 2, reason, idempotencyKey };
    const decisionInput = { decision: 'approve' as const, reason, idempotencyKey };
    const send = vi.fn()
      .mockResolvedValueOnce(response(proposal))
      .mockRejectedValueOnce(new Error('response lost after SQL commit'))
      .mockResolvedValueOnce(response(decision));
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: send });
    expect(await client.proposeAppeal(proposalInput)).toEqual(proposal);
    expect(send.mock.calls[0]?.[0]).toBe(`${baseUrl}/admin/adjustments`);
    expect(send.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(proposalInput));
    await expect(client.decideAppeal(proposalId, decisionInput)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(send).toHaveBeenCalledTimes(2);
    expect(await client.decideAppeal(proposalId, decisionInput)).toEqual(decision);
    expect(send.mock.calls[1]?.[1]?.body).toBe(send.mock.calls[2]?.[1]?.body);
    expect(send.mock.calls[2]?.[0]).toBe(`${baseUrl}/admin/adjustments/${proposalId}/decision`);
  });
  it('preserves explicit permission, stale-state and replay conflicts without sensitive error details', async () => {
    for (const [code, status] of [['FORBIDDEN', 403], ['SELF_REVIEW', 403], ['STALE_PROPOSAL', 409], ['PROPOSAL_DECIDED', 409], ['IDEMPOTENCY_CONFLICT', 409]] as const) {
      const send = vi.fn(async () => Response.json({ error: { code, detail: 'private subject record' } }, { status }));
      const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: send });
      await expect(client.decideAppeal(proposalId, { decision: 'approve', reason, idempotencyKey })).rejects.toMatchObject({ code, status, message: code });
      expect(send).toHaveBeenCalledTimes(1);
    }
  });
  it('cancels every review operation while session lookup is pending', async () => {
    for (const operation of [
      (client: ReturnType<typeof createCoreClient>, signal: AbortSignal) => client.getAppeals({}, signal),
      (client: ReturnType<typeof createCoreClient>, signal: AbortSignal) => client.getAdminReviews({}, signal),
      (client: ReturnType<typeof createCoreClient>, signal: AbortSignal) => client.proposeAppeal({ appealId, revision: 2, reason, idempotencyKey }, signal),
      (client: ReturnType<typeof createCoreClient>, signal: AbortSignal) => client.decideAppeal(proposalId, { decision: 'approve', reason, idempotencyKey }, signal),
    ]) {
      const abort = new AbortController(); let tokenReady!: (value: string) => void;
      const token = new Promise<string>(resolve => { tokenReady = resolve; }); const send = vi.fn();
      const client = createCoreClient({ baseUrl, accessToken: () => token, fetch: send });
      const rejected = expect(operation(client, abort.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
      abort.abort(); await rejected; tokenReady('late-old-account-token'); await Promise.resolve(); await Promise.resolve();
      expect(send).not.toHaveBeenCalled();
    }
  });
});

describe('canonical compensating accounting responses', () => {
  it('retains signed debt and corrections while forbidding negative spendable credit', async () => {
    expect(await clientWith(points).getPointsSummary()).toEqual(points);
    for (const invalid of [
      { ...points, availablePoints: -40 }, { ...points, availablePoints: 1 },
      { ...points, balance: 0 }, { ...points, correctionPoints: -49 }, { ...points, earnedPoints: 50.5 },
    ]) await expect(clientWith(invalid).getPointsSummary()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('rejects an incomplete older summary rather than silently dropping the corrections', async () => {
    const { balance: _balance, correctionPoints: _correction, ...old } = points;
    await expect(clientWith(old).getPointsSummary()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('returns positive and negative compensation entries with their original posting references', async () => {
    const entry = { id: '9007199254740993', kind: 'daily_correction', points: -30, createdAt, instanceId: appealId, adjustmentId: proposalId, relatedEntryId: '10' };
    const items = [entry, { ...entry, id: '9007199254740994', kind: 'weekly_correction', points: 20, relatedEntryId: null }];
    expect(await clientWith({ items, nextCursor: null }).getLedger()).toEqual({ items, nextCursor: null });
    for (const invalid of [{ ...entry, adjustmentId: null }, { ...entry, points: 0 }, { ...entry, kind: 'daily_award' }]) {
      await expect(clientWith({ items: [invalid], nextCursor: null }).getLedger()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });
  it('rejects decision totals, caps, status or spendable credit inconsistent with the committed correction', async () => {
    const input = { decision: 'approve' as const, reason, idempotencyKey };
    expect(await clientWith(decision).decideAppeal(proposalId, input)).toEqual(decision);
    for (const invalid of [
      { ...decision, addedPoints: 0 }, { ...decision, dailyDelta: -31, addedPoints: -51 },
      { ...decision, status: 'rejected' }, { ...decision, decision: 'reject', status: 'rejected' },
      { ...decision, availablePoints: 20 },
    ]) await expect(clientWith(invalid).decideAppeal(proposalId, input)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('does not accept a valid-looking outcome for a different appeal or decision request', async () => {
    await expect(clientWith({ ...proposal, appealId: subjectId }).proposeAppeal({ appealId, revision: 2, reason, idempotencyKey })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(clientWith({ ...decision, id: subjectId }).decideAppeal(proposalId, { decision: 'approve', reason, idempotencyKey })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(clientWith(decision).decideAppeal(proposalId, { decision: 'reject', reason, idempotencyKey })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
