/**
 * Synthetic API/Edge/PostgreSQL integration — NOT Supabase Auth/OTP evidence.
 * The production handler and typed client run unchanged. Only authentication and
 * PostgREST transport are injected; RPC functions, roles, RLS and accounting use
 * the real disposable local PostgreSQL database initialized by supabase/tests/run.mjs.
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCoreClient } from '../packages/api-client/src/index.ts';
import { createCoreHandler } from '../supabase/functions/core/handler.ts';
import { SyntheticHealthProvider } from '../packages/health-provider/src/synthetic.ts';
import { aggregateSteps } from '../packages/health-provider/src/aggregation.ts';
import { createActivitySyncCoordinator, latestEligibleObservation, prepareActivitySummary } from '../apps/mobile/src/utils/activity-sync.ts';
import { RewardController } from '../apps/mobile/src/utils/reward-controller.ts';
import { ReminderController } from '../apps/mobile/src/utils/reminder-controller.ts';

const target = process.env.HEALTHLOOP_TEST_DATABASE_URL;
if (!target) throw new Error('Set HEALTHLOOP_TEST_DATABASE_URL; initialize the disposable database with supabase/tests/run.mjs first.');
const targetUrl = new URL(target);
if (!['postgres:', 'postgresql:'].includes(targetUrl.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(targetUrl.hostname)
    || !/^\/healthloop_test_[a-z0-9_]+$/.test(targetUrl.pathname)
    || targetUrl.search || targetUrl.hash
    || process.env.HEALTHLOOP_ALLOW_DB_RESET !== 'local-only') {
  throw new Error('Refusing non-disposable DB: requires loopback healthloop_test_* and HEALTHLOOP_ALLOW_DB_RESET=local-only.');
}
const pool = new pg.Pool({ connectionString: target, max: 4 });
const simulatedSessions = new Map();
const simulatedAssurance = new Map();
const fixedTime = '2026-09-18T01:00:00Z';
const consent = { adultConfirmed: true, localRead: true, cloudSync: true, marketing: false, version: '2026-09-18' };
// This explicit list prevents the injected transport from invoking arbitrary SQL identifiers.
const rpcArguments = Object.freeze({
  hl_consents: [],
  hl_set_consents: ['p_adult_confirmed', 'p_local_read', 'p_cloud_sync', 'p_marketing', 'p_version'],
  hl_notification_preferences: [],
  hl_set_notification_preferences: ['p_enabled', 'p_reminder_time', 'p_quiet_start', 'p_quiet_end', 'p_timezone', 'p_expected_revision'],
  hl_sync_activity: ['p_task_date', 'p_eligible_steps', 'p_source_category', 'p_source_policy', 'p_source_pin_token', 'p_revision', 'p_observed_at', 'p_timezone'],
  hl_claim: ['p_instance_id', 'p_idempotency_key'],
  hl_missions: [],
  hl_health_summary: [],
  hl_points_summary: [],
  hl_ledger: ['p_limit', 'p_cursor'],
  hl_export: [],
  hl_rewards: [],
  hl_redemptions: ['p_limit', 'p_cursor'],
  hl_redeem: ['p_reward_id', 'p_idempotency_key'],
  hl_cancel_redemption: ['p_redemption_id'],
  hl_create_appeal: ['p_task_date', 'p_reason'],
  hl_appeals: ['p_limit', 'p_cursor'],
  hl_admin_appeals: ['p_limit', 'p_cursor'],
  hl_propose_appeal: ['p_appeal_id', 'p_revision', 'p_reason', 'p_idempotency_key'],
  hl_decide_appeal: ['p_proposal_id', 'p_decision', 'p_reason', 'p_idempotency_key'],
});

function requestClient(boundToken) {
  return {
    auth: {
      async getUser(token) {
        const id = token === boundToken ? simulatedSessions.get(token) : undefined;
        return { data: { user: id ? { id } : null }, error: id ? null : new Error('SIMULATED_SESSION_REJECTED') };
      },
    },
    async rpc(name, args = {}) {
      const id = simulatedSessions.get(boundToken);
      const argumentNames = rpcArguments[name];
      if (!id) return { data: null, error: { message: 'UNAUTHENTICATED' } };
      if (!argumentNames || Object.keys(args).some(key => !argumentNames.includes(key))) {
        throw new Error('Test transport received an unlisted RPC or argument');
      }
      const connection = await pool.connect();
      try {
        await connection.query('begin');
        await connection.query('set local role authenticated');
        const claims = { sub: id, role: 'authenticated', is_anonymous: false, aal: simulatedAssurance.get(boundToken) ?? 'aal1', amr: [{ method: 'otp', timestamp: Date.parse(fixedTime) / 1000 }] };
        // Test owner injects synthetic identity claims, exactly as the DB fixture runner does.
        await connection.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
        const parameters = argumentNames.map(key => args[key] ?? null);
        const namedPlaceholders = argumentNames.map((key, index) => `${key} => $${index + 1}`).join(', ');
        const result = await connection.query(`select public.${name}(${namedPlaceholders}) as result`, parameters);
        await connection.query('commit');
        return { data: result.rows[0].result, error: null };
      } catch (error) {
        await connection.query('rollback');
        return { data: null, error: { message: error.message, code: error.code } };
      } finally { connection.release(); }
    },
  };
}
const handler = createCoreHandler({
  url: 'http://127.0.0.1:54321', anonKey: 'synthetic-test-placeholder',
  environment: 'test', buildMode: 'real', projectLabel: 'healthloop-real-local-integration', allowedOrigins: [],
}, { client: requestClient, requestId: randomUUID });
function apiFor(token, options = {}) {
  return createCoreClient({
    baseUrl: 'http://127.0.0.1:54321/functions/v1/core', accessToken: async () => token,
    // In-process HTTP boundary still exercises real Request parsing, route mapping,
    // schemas, error mapping, response envelope and client decoding.
    fetch: async (url, init) => {
      const request = new Request(url, init);
      const path = new URL(request.url).pathname;
      if (options.requests) options.requests.push({ path, body: init.body ? JSON.parse(init.body) : null });
      const response = await handler(request);
      options.afterResponse?.(path, response);
      // The database has committed before this injected network loss. It is not
      // a fake backend response: retry must reconcile the actual posted ledger.
      if (response.ok && options.dropSuccessfulResponse?.(path, request.method)) throw new TypeError('SIMULATED_NETWORK_RESPONSE_LOSS');
      return response;
    },
  });
}
async function user() {
  const id = randomUUID();
  await pool.query('insert into auth.users(id) values($1)', [id]);
  const token = `synthetic-local-test-session.${randomUUID()}`;
  simulatedSessions.set(token, id);
  return { id, token, api: apiFor(token) };
}
function summary(steps = 3000, revision = 1, pin = randomUUID()) {
  return {
    taskDate: '2026-09-18', eligibleSteps: steps, sourceCategory: 'apple_phone',
    sourcePolicy: 'single-approved-source-v1', sourcePinToken: pin, revision,
    observedAt: fixedTime, timezone: 'Asia/Hong_Kong',
  };
}
const defaultNotificationPreferences = {
  enabled: false, reminderTime: '19:00', quietStart: '22:00', quietEnd: '08:00',
  timezone: 'Asia/Hong_Kong', revision: 0, updatedAt: null,
};
function notificationInput(overrides = {}) {
  return { enabled: true, reminderTime: '19:00', quietStart: '22:00', quietEnd: '08:00', timezone: 'Asia/Hong_Kong', expectedRevision: 0, ...overrides };
}
function rawNotificationRequest(token, body, query = '') {
  return handler(new Request(`http://127.0.0.1:54321/functions/v1/core/account/notification-preferences${query}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}
let originalClock;
let originalSettings;
beforeAll(async () => {
  // Refuse an uninitialized DB rather than building a replacement schema here.
  const clock = await pool.query("select pg_get_functiondef('private.server_now()'::regprocedure) as definition");
  originalClock = clock.rows[0].definition;
  originalSettings = (await pool.query('select demo_mode, rewards_paused, project_label from private.system_settings')).rows[0];
  if (!originalSettings) throw new Error('Initialize the disposable database using supabase/tests/run.mjs first.');
  await pool.query("create or replace function private.server_now() returns timestamptz language sql volatile set search_path='' as $$ select '2026-09-18T01:00:00Z'::timestamptz $$");
  await pool.query("update private.system_settings set demo_mode=false, rewards_paused=false, project_label='healthloop-real-local-integration'");
});
afterAll(async () => {
  try {
    if (originalClock) await pool.query(originalClock);
    if (originalSettings) await pool.query('update private.system_settings set demo_mode=$1,rewards_paused=$2,project_label=$3', [originalSettings.demo_mode, originalSettings.rewards_paused, originalSettings.project_label]);
  } finally { simulatedSessions.clear(); simulatedAssurance.clear(); await pool.end(); }
});

describe('synthetic client → real Edge handler → real PostgreSQL RPC', () => {
  it('completes onboarding, summary sync, daily claim and reconciled typed ledger', async () => {
    const { id, api } = await user();
    expect(await api.getConsents()).toEqual({ profile: null });
    expect((await api.setConsents(consent)).profile).toMatchObject({ id, localRead: true, cloudSync: true });
    const accepted = await api.syncActivity(summary());
    expect(accepted).toMatchObject({ status: 'accepted', eligibleSteps: 3000, revision: 1 });
    const claim = await api.claimMission(accepted.instanceId, randomUUID());
    expect(claim).toMatchObject({ addedPoints: 10, dailyAwardedPoints: 10, balance: 10 });
    const missions = await api.getMissions();
    expect(missions.items.find(item => item.id === accepted.instanceId)).toMatchObject({ kind: 'daily_steps', awardedPoints: 10, selectedGoal: 3000 });
    const ledger = await api.getLedger();
    expect(ledger.items).toHaveLength(1);
    expect(ledger.items[0]).toMatchObject({ kind: 'daily_award', points: 10, instanceId: accepted.instanceId });
    expect((await api.getPointsSummary()).availablePoints).toBe(ledger.items.reduce((sum, entry) => sum + entry.points, 0));
  });

  it('awards only highest-tier differences and preserves claim idempotency across HTTP envelopes', async () => {
    const { api } = await user(); await api.setConsents(consent);
    const pin = randomUUID(); const first = await api.syncActivity(summary(3000, 1, pin));
    const key = randomUUID(); const initial = await api.claimMission(first.instanceId, key);
    expect(await api.claimMission(first.instanceId, key)).toEqual(initial);
    await api.syncActivity(summary(5000, 2, pin));
    expect((await api.claimMission(first.instanceId, randomUUID())).addedPoints).toBe(10);
    await api.syncActivity(summary(7000, 3, pin));
    expect((await api.claimMission(first.instanceId, randomUUID())).addedPoints).toBe(10);
    expect((await api.claimMission(first.instanceId, randomUUID())).addedPoints).toBe(0);
    expect((await api.getPointsSummary()).availablePoints).toBe(30);
    const firstPage = await api.getLedger({ limit: 2 });
    expect(firstPage.items).toHaveLength(2); expect(firstPage.nextCursor).not.toBeNull();
    const secondPage = await api.getLedger({ cursor: firstPage.nextCursor });
    const entries = [...firstPage.items, ...secondPage.items];
    expect(new Set(entries.map(entry => entry.id)).size).toBe(3);
    expect(entries.reduce((sum, entry) => sum + entry.points, 0)).toBe(30);
  });

  it('isolates user B ledger and rejects user A mission IDs via real ownership checks', async () => {
    const a = await user(); const b = await user();
    await a.api.setConsents(consent); await b.api.setConsents(consent);
    const accepted = await a.api.syncActivity(summary());
    await a.api.claimMission(accepted.instanceId, randomUUID());
    await expect(b.api.claimMission(accepted.instanceId, randomUUID())).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect((await b.api.getLedger()).items).toEqual([]);
    expect((await b.api.getPointsSummary()).availablePoints).toBe(0);
    expect((await b.api.exportAccount()).profile.id).toBe(b.id);
  });

  it('withdraws cloud consent and blocks both a prepared claim and a queued summary', async () => {
    const { api } = await user(); await api.setConsents(consent);
    const input = summary(); const accepted = await api.syncActivity(input);
    expect((await api.setConsents({ ...consent, cloudSync: false })).profile.cloudSync).toBe(false);
    await expect(api.claimMission(accepted.instanceId, randomUUID())).rejects.toMatchObject({ code: 'CONSENT_REQUIRED', status: 403 });
    await expect(api.syncActivity({ ...input, revision: 2, eligibleSteps: 5000 })).rejects.toMatchObject({ code: 'CONSENT_REQUIRED', status: 403 });
    expect((await api.getPointsSummary()).availablePoints).toBe(0);
    expect((await api.getLedger()).items).toEqual([]);
  });

  it('rejects unknown synthetic tokens rather than trusting a client-supplied identity', async () => {
    await expect(apiFor(`not-a-registered-test-session.${randomUUID()}`).getConsents()).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
  });
});


async function readPreparedSummary(day = '2026-09-18') {
  const pin = { sourceId: 'synthetic-private-source-id', sourceCategory: 'apple_phone', sourcePolicy: 'single-approved-source-v1', pinToken: randomUUID() };
  const samples = [
    { id: 'synthetic-phone-1', startAt: `${day}T00:00:00Z`, endAt: `${day}T01:00:00Z`, count: 3000, source: { id: pin.sourceId, category: 'apple_phone', isManual: false } },
    { id: 'synthetic-watch-overlap', startAt: `${day}T00:00:00Z`, endAt: `${day}T01:00:00Z`, count: 9000, source: { id: 'synthetic-watch-id', category: 'apple_watch', isManual: false } },
    { id: 'synthetic-manual', startAt: `${day}T01:00:00Z`, endAt: `${day}T02:00:00Z`, count: 8000, source: { id: pin.sourceId, category: 'apple_phone', isManual: true } },
  ];
  const provider = new SyntheticHealthProvider({ steps: { [day]: samples } });
  await provider.requestReadAccess(['steps']);
  expect((await provider.getAccessState()).accessRequested).toBe(true);
  const read = await provider.readSteps(day);
  expect(read.status).toBe('present');
  const steps = aggregateSteps({ taskDate: day, samples: read.value, pinnedSource: pin });
  const observedAt = latestEligibleObservation({ taskDate: day, samples: read.value, pin });
  return prepareActivitySummary({ taskDate: day, steps, observedAt, revision: 1 });
}

describe('synthetic HealthDataProvider → mobile coordinator → typed client → Edge → PostgreSQL', () => {
  it('uploads only the pinned eligible summary and refreshes a reconciled ledger', async () => {
    const { id, token, api } = await user(); await api.setConsents(consent);
    const requests = []; const flow = createActivitySyncCoordinator({ api: apiFor(token, { requests }), randomUUID });
    flow.setContext({ accountId: id, cloudSync: true });
    const prepared = await readPreparedSummary(); const result = await flow.submit(prepared);
    expect(prepared).toMatchObject({ eligibleSteps: 3000, observedAt: '2026-09-18T01:00:00.000Z' });
    expect(result.status).toBe('accepted'); expect(result.points.availablePoints).toBe(10);
    expect(result.ledger.items).toHaveLength(1);
    expect(result.ledger.items.reduce((sum, item) => sum + item.points, 0)).toBe(result.points.availablePoints);
    const uploaded = requests.find(request => request.path.endsWith('/activity/sync')).body;
    expect(Object.keys(uploaded).sort()).toEqual(['taskDate', 'eligibleSteps', 'sourceCategory', 'sourcePolicy', 'sourcePinToken', 'revision', 'observedAt', 'timezone'].sort());
    expect(JSON.stringify(uploaded)).not.toContain('synthetic-private-source-id');
    expect(JSON.stringify(uploaded)).not.toContain('synthetic-phone-1');
    expect(flow.pending(prepared.taskDate)).toBeNull();
  });

  it.each(['/activity/sync', '/claim'])('replays an actually committed %s response loss without another award', async (suffix) => {
    const { id, token, api } = await user(); await api.setConsents(consent);
    let dropped = false; const requests = [];
    const unreliable = apiFor(token, { requests, dropSuccessfulResponse(path) { if (!dropped && path.endsWith(suffix)) { dropped = true; return true; } return false; } });
    const flow = createActivitySyncCoordinator({ api: unreliable, randomUUID }); flow.setContext({ accountId: id, cloudSync: true });
    const prepared = await readPreparedSummary();
    await expect(flow.submit(prepared)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(flow.pending(prepared.taskDate)?.stage).toBe(suffix === '/claim' ? 'claim' : 'sync');
    if (suffix === '/claim') expect((await api.getPointsSummary()).availablePoints).toBe(10);
    flow.pause(); await expect(flow.retry(prepared.taskDate)).rejects.toMatchObject({ code: 'SYNC_PAUSED' });
    flow.setContext({ accountId: id, cloudSync: true }); const result = await flow.retry(prepared.taskDate);
    expect(result.points.availablePoints).toBe(10); expect(result.ledger.items).toHaveLength(1);
    const repeated = requests.filter(request => request.path.endsWith(suffix)); expect(repeated).toHaveLength(2);
    expect(repeated[0].body).toEqual(repeated[1].body);
    expect((await pool.query('select count(*)::int n from public.activity_submissions where user_id=$1', [id])).rows[0].n).toBe(1);
    expect((await pool.query('select count(*)::int n from public.claim_requests where user_id=$1', [id])).rows[0].n).toBe(1);
  });

  it('local withdrawal after accepted sync prevents the next claim and clears retry memory', async () => {
    const { id, token, api } = await user(); await api.setConsents(consent);
    const requests = []; let flow;
    const interrupted = apiFor(token, { requests, afterResponse(path) { if (path.endsWith('/activity/sync')) flow.setContext({ accountId: id, cloudSync: false }); } });
    flow = createActivitySyncCoordinator({ api: interrupted, randomUUID }); flow.setContext({ accountId: id, cloudSync: true });
    const prepared = await readPreparedSummary(); await expect(flow.submit(prepared)).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(requests.some(request => request.path.endsWith('/claim'))).toBe(false); expect(flow.pending(prepared.taskDate)).toBeNull();
    expect((await api.getPointsSummary()).availablePoints).toBe(0); expect((await api.getLedger()).items).toEqual([]);
    flow.setContext({ accountId: id, cloudSync: true }); await expect(flow.retry(prepared.taskDate)).rejects.toMatchObject({ code: 'NO_PENDING_SYNC' });
  });

  it('uses yesterday sample time for permitted late synchronization and exposes canonical revision', async () => {
    const { id, token, api } = await user(); await api.setConsents(consent);
    const flow = createActivitySyncCoordinator({ api: apiFor(token), randomUUID }); flow.setContext({ accountId: id, cloudSync: true });
    const prepared = await readPreparedSummary('2026-09-17'); const result = await flow.submit(prepared);
    expect(result.sync.taskDate).toBe('2026-09-17'); expect(result.points.availablePoints).toBe(10);
    const canonical = await api.getHealthSummary();
    expect(canonical.items.find(item => item.taskDate === '2026-09-17')).toMatchObject({ revision: 1, eligibleSteps: 3000 });
    expect(Date.parse(canonical.items[0].observedAt)).toBe(Date.parse('2026-09-17T01:00:00Z'));
  });
});


/** Catalog rows here are disposable test fixtures, never real merchant stock. */
async function demoReward(pointsCost = 10, stock = 1) {
  const id = randomUUID();
  await pool.query('insert into public.reward_catalog(id,title_key,points_cost,stock,is_demo) values($1,$2,$3,$4,true)', [id, 'reward.demo_badge', pointsCost, stock]);
  return id;
}
async function fundedUser(steps = 7000) {
  const account = await user();
  await account.api.setConsents(consent);
  const input = summary(steps);
  const sync = await account.api.syncActivity(input);
  await account.api.claimMission(sync.instanceId, randomUUID());
  return { ...account, sourcePinToken: input.sourcePinToken };
}

describe('demonstration reward client → Edge → PostgreSQL', () => {
  it('runs the shipped mobile controller through restart recovery and consent-withdrawn refund against real SQL', async () => {
    const account = await fundedUser(); const rewardId = await demoReward();
    const values = new Map();
    const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
    let dropped = false; const requests = [];
    const unreliable = apiFor(account.token, { requests, dropSuccessfulResponse(path, method) {
      if (!dropped && method === 'POST' && path.endsWith('/redemptions')) { dropped = true; return true; }
      return false;
    } });
    const first = new RewardController({ api: unreliable, storage, randomUUID });
    first.setContext({ accountId: account.id, verified: true, redeemAllowed: true });
    await first.refresh();
    const operation = first.redeem(rewardId);
    expect(first.redeem(rewardId)).toBe(operation);
    await expect(operation).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    const recordedBody = requests.find(request => request.path.endsWith('/redemptions') && request.body).body;
    const stored = [...values.values()][0];
    expect(JSON.parse(stored)).toMatchObject({ kind: 'redeem', stage: 'request', rewardId, idempotencyKey: recordedBody.idempotencyKey });
    expect(stored).not.toContain('demoCode'); expect(stored).not.toContain('eligibleSteps');
    first.setContext({ accountId: null, verified: false, redeemAllowed: false });
    const reopened = new RewardController({ api: unreliable, storage, randomUUID });
    reopened.setContext({ accountId: account.id, verified: true, redeemAllowed: true });
    await reopened.refresh();
    const recovered = await reopened.retry();
    expect(recovered.points).toMatchObject({ balance: 20, availablePoints: 20 });
    expect(recovered.redemptions.items).toHaveLength(1);
    expect(recovered.ledger.items.filter(entry => entry.kind === 'redemption')).toHaveLength(1);
    expect(requests.filter(request => request.path.endsWith('/redemptions') && request.body).map(request => request.body)).toEqual([recordedBody, recordedBody]);
    expect(values.size).toBe(0);
    await account.api.setConsents({ ...consent, cloudSync: false });
    reopened.setContext({ accountId: account.id, verified: true, redeemAllowed: false });
    const refunded = await reopened.cancel(recovered.redemptions.items[0].id);
    expect(refunded.points).toMatchObject({ balance: 30, availablePoints: 30 });
    expect(refunded.redemptions.items[0].status).toBe('cancelled');
    expect(refunded.ledger.items.filter(entry => entry.kind === 'refund')).toHaveLength(1);
    expect(refunded.rewards.find(item => item.id === rewardId).stock).toBe(1);
    await expect(reopened.redeem(rewardId)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
  });

  it('recovers a committed redemption response loss using the same key and canonical balance, stock and history', async () => {
    const account = await fundedUser();
    const rewardId = await demoReward(10, 1); const idempotencyKey = randomUUID();
    let dropped = false; const requests = [];
    const unreliable = apiFor(account.token, { requests, dropSuccessfulResponse(path) {
      if (!dropped && path.endsWith('/redemptions')) { dropped = true; return true; }
      return false;
    } });
    const reward = (await account.api.getRewards()).items.find(item => item.id === rewardId);
    expect(reward).toMatchObject({ isDemo: true, pointsCost: 10, stock: 1 });
    await expect(unreliable.redeemReward({ rewardId, idempotencyKey })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect((await account.api.getPointsSummary()).availablePoints).toBe(20);
    const result = await unreliable.redeemReward({ rewardId, idempotencyKey });
    expect(result).toMatchObject({ status: 'demonstration', pointsCost: 10 });
    expect(result.demoCode).toMatch(/^[a-f0-9-]{36}$/i);
    const history = await account.api.getRedemptions();
    expect(history.items).toHaveLength(1);
    expect(history.items[0]).toMatchObject({ id: result.id, demoCode: result.demoCode, rewardId });
    const debits = (await account.api.getLedger()).items.filter(item => item.kind === 'redemption');
    expect(debits).toHaveLength(1); expect(debits[0].points).toBe(-10);
    expect((await account.api.getRewards()).items.find(item => item.id === rewardId)?.stock).toBe(0);
    expect(requests.filter(item => item.path.endsWith('/redemptions')).map(item => item.body)).toEqual([
      { rewardId, idempotencyKey }, { rewardId, idempotencyKey },
    ]);
    await expect(account.api.redeemReward({ rewardId, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'OUT_OF_STOCK', status: 409 });
  });

  it('refunds once after cloud consent withdrawal without granting new rewards or revealing another account code', async () => {
    const a = await fundedUser(); const b = await fundedUser(); const rewardId = await demoReward();
    const idempotencyKey = randomUUID();
    const redeemed = await a.api.redeemReward({ rewardId, idempotencyKey });
    expect((await b.api.getRedemptions()).items).toEqual([]);
    await expect(b.api.cancelRedemption(redeemed.id)).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    await a.api.setConsents({ ...consent, cloudSync: false });
    expect(await a.api.redeemReward({ rewardId, idempotencyKey })).toEqual(redeemed);
    await expect(a.api.redeemReward({ rewardId, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'CONSENT_REQUIRED', status: 403 });
    expect(await a.api.cancelRedemption(redeemed.id)).toEqual({ id: redeemed.id, status: 'cancelled' });
    expect(await a.api.cancelRedemption(redeemed.id)).toEqual({ id: redeemed.id, status: 'cancelled' });
    expect((await a.api.getPointsSummary()).availablePoints).toBe(30);
    expect((await a.api.getRewards()).items.find(item => item.id === rewardId)?.stock).toBe(1);
    expect((await a.api.getLedger()).items.filter(item => item.kind === 'refund')).toHaveLength(1);
    expect((await a.api.getRedemptions()).items[0]).toMatchObject({ status: 'cancelled' });
  });

  it('serializes competing clients for the final demonstration item without charging the loser', async () => {
    const a = await fundedUser(); const b = await fundedUser(); const rewardId = await demoReward();
    const results = await Promise.allSettled([a.api.redeemReward({ rewardId, idempotencyKey: randomUUID() }), b.api.redeemReward({ rewardId, idempotencyKey: randomUUID() })]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(result => result.status === 'rejected');
    expect(failure.reason).toMatchObject({ code: 'OUT_OF_STOCK' });
    expect((await a.api.getPointsSummary()).availablePoints + (await b.api.getPointsSummary()).availablePoints).toBe(50);
    expect((await a.api.getRedemptions()).items.length + (await b.api.getRedemptions()).items.length).toBe(1);
  });
});

// Only the owner of this disposable fixture can set the clock or assign roles.
// Actual review operations still cross the client/Edge/authenticated RPC boundary.
async function fixtureClock(value = fixedTime) {
  if (!/^2026-09-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) throw new Error('Unexpected fixture date');
  await pool.query(`create or replace function private.server_now() returns timestamptz language sql volatile set search_path='' as $$ select '${value}'::timestamptz $$`);
}
async function administrator(role, assurance = 'aal2') {
  const account = await user();
  await account.api.setConsents(consent);
  await pool.query('insert into private.admin_roles(user_id,role) values($1,$2)', [account.id, role]);
  simulatedAssurance.set(account.token, assurance);
  return account;
}

describe('two-person appeal client → Edge → PostgreSQL (synthetic Auth and MFA)', () => {
  it('corrects a spent daily and weekly award atomically and recovers a lost approval response without another correction', async () => {
    const subject = await user(); const operator = await administrator('operator'); const reviewer = await administrator('reviewer');
    await subject.api.setConsents(consent);
    const pin = randomUUID();
    try {
      for (const day of ['2026-09-16', '2026-09-17', '2026-09-18']) {
        await fixtureClock(`${day}T01:00:00Z`);
        const accepted = await subject.api.syncActivity({ ...summary(3000, 1, pin), taskDate: day, observedAt: `${day}T01:00:00Z` });
        await subject.api.claimMission(accepted.instanceId, randomUUID());
      }
      expect((await subject.api.getPointsSummary()).balance).toBe(50);
      await subject.api.redeemReward({ rewardId: await demoReward(40), idempotencyKey: randomUUID() });
      expect(await subject.api.syncActivity(summary(0, 2, pin))).toMatchObject({ status: 'pending_review' });
      const appeal = await subject.api.createAppeal({ taskDate: '2026-09-18', reason: 'Synthetic fixture: review a downward revision.' });
      const ownAppeals = await subject.api.getAppeals();
      expect(ownAppeals.items.find(item => item.id === appeal.id)).toMatchObject({ status: 'open', proposals: [] });
      expect((await operator.api.getAdminReviews()).items.find(item => item.id === appeal.id)).toMatchObject({
        subjectId: subject.id, canonicalSummary: { eligibleSteps: 3000, revision: 1 },
        pendingSubmissions: [expect.objectContaining({ revision: 2, eligibleSteps: 0 })],
      });
      const proposalInput = { appealId: appeal.id, revision: 2, reason: 'Synthetic fixture: propose the stored correction.', idempotencyKey: randomUUID() };
      const proposal = await operator.api.proposeAppeal(proposalInput);
      expect(await operator.api.proposeAppeal(proposalInput)).toEqual(proposal);
      const decisionInput = { decision: 'approve', reason: 'Synthetic fixture: independent reviewer confirms.', idempotencyKey: randomUUID() };
      let dropped = false;
      const unreliable = apiFor(reviewer.token, { dropSuccessfulResponse(path) {
        if (!dropped && path.endsWith('/decision')) { dropped = true; return true; }
        return false;
      } });
      await expect(unreliable.decideAppeal(proposal.id, decisionInput)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
      const decision = await unreliable.decideAppeal(proposal.id, decisionInput);
      expect(decision).toMatchObject({ status: 'approved', dailyDelta: -10, weeklyDelta: -20, addedPoints: -30, balance: -20, availablePoints: 0 });
      expect(await reviewer.api.decideAppeal(proposal.id, decisionInput)).toEqual(decision);
      await expect(reviewer.api.decideAppeal(proposal.id, { ...decisionInput, reason: 'Synthetic fixture: changed replay is not allowed.' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
      const points = await subject.api.getPointsSummary();
      expect(points).toMatchObject({ earnedPoints: 50, correctionPoints: -30, balance: -20, availablePoints: 0, spentPoints: 40 });
      const entries = (await subject.api.getLedger({ limit: 100 })).items;
      const corrections = entries.filter(entry => entry.kind.endsWith('_correction'));
      expect(corrections).toHaveLength(2);
      for (const entry of corrections) {
        expect(entry.adjustmentId).toBe(proposal.id);
        expect(entries.some(original => original.id === entry.relatedEntryId && original.instanceId === entry.instanceId)).toBe(true);
      }
      expect(entries.reduce((sum, entry) => sum + entry.points, 0)).toBe(points.balance);
      expect((await subject.api.getAppeals()).items.find(item => item.id === appeal.id)).toMatchObject({ status: 'resolved', proposals: [expect.objectContaining({ status: 'approved' })] });
      expect((await subject.api.getHealthSummary()).items.find(item => item.taskDate === '2026-09-18')).toMatchObject({ eligibleSteps: 0, revision: 2 });
      await expect(subject.api.redeemReward({ rewardId: await demoReward(), idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'INSUFFICIENT_POINTS', status: 409 });
      const stranger = await user(); await stranger.api.setConsents(consent);
      expect((await stranger.api.getAppeals()).items).toEqual([]);
    } finally { await fixtureClock(); }
  });

  it('enforces server roles, signed assurance and separate approvers across the HTTP boundary', async () => {
    const subject = await fundedUser(); const operator = await administrator('operator', 'aal1'); const reviewer = await administrator('reviewer');
    await subject.api.syncActivity(summary(0, 2, subject.sourcePinToken));
    const appeal = await subject.api.createAppeal({ taskDate: '2026-09-18', reason: 'Synthetic fixture: authorization test.' });
    const input = { appealId: appeal.id, revision: 2, reason: 'Synthetic fixture: propose stored revision.', idempotencyKey: randomUUID() };
    await expect(subject.api.getAdminReviews()).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    await expect(subject.api.proposeAppeal(input)).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    await expect(operator.api.proposeAppeal(input)).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    simulatedAssurance.set(operator.token, 'aal2');
    const proposal = await operator.api.proposeAppeal(input);
    // A privileged fixture changes the proposer's role; a role change still must
    // not permit that same identity to approve its own previously created proposal.
    await pool.query("update private.admin_roles set role='reviewer' where user_id=$1", [operator.id]);
    const decision = { decision: 'approve', reason: 'Synthetic fixture: independent review required.', idempotencyKey: randomUUID() };
    await expect(operator.api.decideAppeal(proposal.id, decision)).rejects.toMatchObject({ code: 'SELF_REVIEW', status: 403 });
    simulatedAssurance.set(reviewer.token, 'aal1');
    await expect(reviewer.api.decideAppeal(proposal.id, decision)).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect((await subject.api.getPointsSummary()).balance).toBe(30);
    simulatedAssurance.set(reviewer.token, 'aal2');
    expect(await reviewer.api.decideAppeal(proposal.id, { ...decision, decision: 'reject' })).toMatchObject({ status: 'rejected', dailyDelta: 0, weeklyDelta: 0, addedPoints: 0, balance: 30 });
    expect((await subject.api.getLedger()).items.filter(entry => entry.kind.endsWith('_correction'))).toHaveLength(0);
  });
});

describe('optional notification preferences client → Edge → PostgreSQL', () => {
  it('runs the shipped reminder controller through SQL, then preserves an offline stop across restart', async () => {
    const { id, api } = await user(); await api.setConsents({ ...consent, localRead: false, cloudSync: false });
    const data = new Map();
    const storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, removeItem: async key => { data.delete(key); } };
    let permission = 'undetermined'; let prompts = 0; let scheduled = null;
    const driver = {
      permission: async () => permission,
      requestPermission: async () => { prompts++; permission = 'granted'; return permission; },
      cancel: async () => { scheduled = null; },
      schedule: async choices => {
        // Verify the real server has confirmed the choice before the injected OS receives it.
        const canonical = await api.getNotificationPreferences();
        expect(canonical).toMatchObject({ enabled: true, revision: 1, reminderTime: choices.reminderTime });
        scheduled = { ...choices };
      },
    };
    const controller = new ReminderController({ api, storage, driver }); controller.setContext(id, true);
    await controller.refresh(); expect(prompts).toBe(0); expect(scheduled).toBeNull();
    await controller.change({ enabled: true, reminderTime: '18:45' }); expect(prompts).toBe(0);
    await controller.save(); expect(prompts).toBe(1); expect(scheduled).toMatchObject({ enabled: true, reminderTime: '18:45' });
    expect((await api.getLedger()).items).toEqual([]);
    controller.setContext(id, false); await controller.change({ enabled: false }); expect(scheduled).toBeNull();
    expect((await api.getNotificationPreferences()).enabled).toBe(true);
    const restarted = new ReminderController({ api, storage, driver }); restarted.setContext(id, true); await restarted.refresh();
    expect(restarted.getSnapshot().draft.enabled).toBe(false); expect(scheduled).toBeNull();
    await restarted.save(); expect(await api.getNotificationPreferences()).toMatchObject({ enabled: false, revision: 2 });
    expect(data.size).toBe(0); expect(prompts).toBe(1); expect(scheduled).toBeNull();
    expect((await api.getConsents()).profile).toMatchObject({ localRead: false, cloudSync: false, marketing: false });
  });

  it('requires onboarding, then saves preferences without local-health, cloud-health or marketing consent', async () => {
    const { id, api } = await user();
    await expect(api.getNotificationPreferences()).rejects.toMatchObject({ code: 'ONBOARDING_REQUIRED', status: 409 });
    await expect(api.setNotificationPreferences(notificationInput())).rejects.toMatchObject({ code: 'ONBOARDING_REQUIRED', status: 409 });
    await api.setConsents({ ...consent, localRead: false, cloudSync: false, marketing: false });
    expect(await api.getNotificationPreferences()).toEqual(defaultNotificationPreferences);
    expect(await api.setNotificationPreferences(notificationInput({ enabled: false }))).toEqual(defaultNotificationPreferences);
    expect((await pool.query('select count(*)::int n from public.notification_preferences where user_id=$1', [id])).rows[0].n).toBe(0);
    const saved = await api.setNotificationPreferences(notificationInput());
    expect(saved).toEqual({ ...defaultNotificationPreferences, enabled: true, revision: 1, updatedAt: expect.any(String) });
    expect(Date.parse(saved.updatedAt)).toBe(Date.parse(fixedTime));
    expect(await api.getNotificationPreferences()).toEqual(saved);
    expect((await api.getConsents()).profile).toMatchObject({ id, localRead: false, cloudSync: false, marketing: false });
    expect((await api.getLedger()).items).toEqual([]);
    expect((await api.getPointsSummary()).balance).toBe(0);
    expect((await pool.query('select count(*)::int n from public.activity_submissions where user_id=$1', [id])).rows[0].n).toBe(0);
  });

  it('rejects malformed and quiet-hour requests at the client and HTTP boundary without changing stored preferences', async () => {
    const { token, api } = await user(); await api.setConsents(consent);
    for (const overrides of [
      { reminderTime: '22:00' }, { reminderTime: '07:59' }, { reminderTime: '24:00' },
      { reminderTime: '9:00' }, { enabled: false, quietEnd: '22:00' },
      { quietStart: '09:00', quietEnd: '12:30', reminderTime: '12:29' },
    ]) {
      const input = notificationInput(overrides);
      expect(() => api.setNotificationPreferences(input)).toThrow();
      const response = await rawNotificationRequest(token, input);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ error: { code: 'INVALID_INPUT' } });
    }
    expect(await api.getNotificationPreferences()).toEqual(defaultNotificationPreferences);
    // The end of either an overnight or same-day quiet window is permitted.
    const overnight = await api.setNotificationPreferences(notificationInput({ reminderTime: '08:00' }));
    expect(overnight).toMatchObject({ reminderTime: '08:00', revision: 1 });
    const daytime = await api.setNotificationPreferences(notificationInput({ quietStart: '09:00', quietEnd: '12:30', reminderTime: '12:30', expectedRevision: 1 }));
    expect(daytime).toMatchObject({ reminderTime: '12:30', revision: 2 });
    // A disabled preference can preserve a reminder time inside quiet hours.
    expect(await api.setNotificationPreferences(notificationInput({ enabled: false, reminderTime: '23:00', expectedRevision: 2 }))).toMatchObject({ enabled: false, reminderTime: '23:00', revision: 3 });
  });

  it('preserves identical retries but rejects a stale enable after disable and rejects future revisions', async () => {
    const { api } = await user(); await api.setConsents(consent);
    const enable = notificationInput();
    const enabled = await api.setNotificationPreferences(enable);
    expect(await api.setNotificationPreferences(enable)).toEqual(enabled);
    const disable = notificationInput({ enabled: false, expectedRevision: 1 });
    const disabled = await api.setNotificationPreferences(disable);
    expect(disabled).toMatchObject({ enabled: false, revision: 2 });
    expect(await api.setNotificationPreferences(disable)).toEqual(disabled);
    await expect(api.setNotificationPreferences(enable)).rejects.toMatchObject({ code: 'PREFERENCES_CONFLICT', status: 409 });
    await expect(api.setNotificationPreferences({ ...disable, expectedRevision: 3 })).rejects.toMatchObject({ code: 'PREFERENCES_CONFLICT', status: 409 });
    expect(await api.getNotificationPreferences()).toEqual(disabled);
  });

  it('recovers a committed response loss with the same desired state and no extra revision or points', async () => {
    const { id, token, api } = await user(); await api.setConsents(consent);
    let dropped = false; const requests = [];
    const unreliable = apiFor(token, { requests, dropSuccessfulResponse(path, method) {
      if (!dropped && method === 'POST' && path.endsWith('/account/notification-preferences')) { dropped = true; return true; }
      return false;
    } });
    const input = notificationInput({ reminderTime: '18:30' });
    await expect(unreliable.setNotificationPreferences(input)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    const canonical = await api.getNotificationPreferences();
    expect(canonical).toMatchObject({ enabled: true, reminderTime: '18:30', revision: 1 });
    expect(await unreliable.setNotificationPreferences(input)).toEqual(canonical);
    expect(requests.map(request => request.body)).toEqual([input, input]);
    expect((await pool.query('select revision from public.notification_preferences where user_id=$1', [id])).rows).toEqual([{ revision: 1 }]);
    expect((await api.getLedger()).items).toEqual([]);
  });

  it('serializes competing desired states so the stale client cannot overwrite the winning preference', async () => {
    const { token, api } = await user(); await api.setConsents(consent);
    const results = await Promise.allSettled([
      api.setNotificationPreferences(notificationInput({ reminderTime: '18:00' })),
      apiFor(token).setNotificationPreferences(notificationInput({ reminderTime: '20:00' })),
    ]);
    const successes = results.filter(result => result.status === 'fulfilled');
    const failures = results.filter(result => result.status === 'rejected');
    expect(successes).toHaveLength(1); expect(failures).toHaveLength(1);
    expect(failures[0].reason).toMatchObject({ code: 'PREFERENCES_CONFLICT', status: 409 });
    expect(successes[0].value.revision).toBe(1);
    expect(await api.getNotificationPreferences()).toEqual(successes[0].value);
  });

  it('exports only the current account preferences and rejects injected identity, health, reward and push fields', async () => {
    const a = await user(); const b = await user();
    await a.api.setConsents(consent); await b.api.setConsents({ ...consent, localRead: false, cloudSync: false });
    const saved = await a.api.setNotificationPreferences(notificationInput({ reminderTime: '17:15' }));
    expect(await b.api.getNotificationPreferences()).toEqual(defaultNotificationPreferences);
    for (const extra of [{ userId: a.id }, { eligibleSteps: 7000 }, { amount: 100 }, { pushToken: 'synthetic-forbidden-token' }]) {
      const response = await rawNotificationRequest(b.token, notificationInput(extra));
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ error: { code: 'INVALID_INPUT' } });
    }
    const query = await rawNotificationRequest(b.token, undefined, `?userId=${a.id}`);
    expect(query.status).toBe(422);
    const exportA = await a.api.exportAccount(); const exportB = await b.api.exportAccount();
    expect(exportA.profile.id).toBe(a.id); expect(exportA.notificationPreferences).toEqual(saved);
    expect(exportB.profile.id).toBe(b.id); expect(exportB.notificationPreferences).toEqual(defaultNotificationPreferences);
    expect(await a.api.getNotificationPreferences()).toEqual(saved);
    expect((await b.api.getLedger()).items).toEqual([]);
  });
});
