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
const fixedTime = '2026-09-18T01:00:00Z';
const consent = { adultConfirmed: true, localRead: true, cloudSync: true, marketing: false, version: '2026-09-18' };
// This explicit list prevents the injected transport from invoking arbitrary SQL identifiers.
const rpcArguments = Object.freeze({
  hl_consents: [],
  hl_set_consents: ['p_adult_confirmed', 'p_local_read', 'p_cloud_sync', 'p_marketing', 'p_version'],
  hl_sync_activity: ['p_task_date', 'p_eligible_steps', 'p_source_category', 'p_source_policy', 'p_source_pin_token', 'p_revision', 'p_observed_at', 'p_timezone'],
  hl_claim: ['p_instance_id', 'p_idempotency_key'],
  hl_missions: [],
  hl_health_summary: [],
  hl_points_summary: [],
  hl_ledger: ['p_limit', 'p_cursor'],
  hl_export: [],
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
        const claims = { sub: id, role: 'authenticated', is_anonymous: false, aal: 'aal1', amr: [{ method: 'otp', timestamp: Date.parse(fixedTime) / 1000 }] };
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
      if (response.ok && options.dropSuccessfulResponse?.(path)) throw new TypeError('SIMULATED_NETWORK_RESPONSE_LOSS');
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
  } finally { simulatedSessions.clear(); await pool.end(); }
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
