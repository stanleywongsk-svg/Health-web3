/**
 * Real local Auth / SMTP sink / Edge / PostgREST integration. No injected JWTs,
 * mock transport, database reset, HealthKit access or remote provisioning.
 * Run separately: HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm exec vitest run --config vitest.local.config.ts
 * Prerequisite: pinned CLI stack + served core Edge in test/real mode. Mailpit API:
 * https://mailpit.axllent.org/docs/api-v1/ ; Auth: https://github.com/supabase/auth#endpoints
 */
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import { it } from 'vitest';
import { createCoreClient } from '../packages/api-client/src/index.ts';
import { extractEmailOtp, FIXTURE_LABEL, loadLocalStack, LOCAL_PROJECT, syntheticEmail } from './local-stack.ts';

const runFile = promisify(execFile);
const { AbortSignal } = globalThis;
const consent = { adultConfirmed: true, localRead: true, cloudSync: true, marketing: false, version: '2026-09-18' };
const preference = { enabled: true, reminderTime: '19:00', quietStart: '22:00', quietEnd: '08:00', timezone: 'Asia/Hong_Kong', expectedRevision: 0 };
class LocalCheckError extends Error {}
function requireCheck(condition, message) { if (!condition) throw new LocalCheckError(message); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
async function rejectsCode(operation, code) {
  try { await operation(); } catch (error) { requireCheck(error?.code === code, `Expected safe API error ${code}; received a different error.`); return; }
  throw new LocalCheckError(`Expected ${code}; request unexpectedly succeeded.`);
}
function claimsFrom(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); }
  catch { throw new LocalCheckError('Auth issued an unreadable access token; token withheld.'); }
}

async function exerciseLocalStack() {
  const directory = resolve(process.env.HEALTHLOOP_LOCAL_STACK_WORKDIR ?? process.cwd());
  const stack = loadLocalStack(directory, process.env.HEALTHLOOP_ALLOW_LOCAL_STACK);
  const runId = randomUUID().replaceAll('-', '');
  const accounts = []; const ownedJobIds = new Set();
  let deadline = Date.now() + 90_000;
  const remaining = maximum => {
    const duration = Math.min(maximum, deadline - Date.now());
    requireCheck(duration > 0, 'Local HTTP phase deadline reached; no new request started.');
    return duration;
  };
  const pool = new pg.Pool({ connectionString: stack.databaseUrl, max: 2, connectionTimeoutMillis: 5000, query_timeout: 10_000 });
  let owner; let originalMode; let locked = false; let prepared = false;
  let completed = 0;
  const pass = label => { completed++; console.log(`PASS local HTTP ${completed}: ${label}`); };
  // Neither HTTP failures nor assertion output contains response bodies, OTPs or keys.
  async function request(path, { method = 'GET', body, token, service = false } = {}) {
    const key = service ? stack.serviceKey : stack.anonKey;
    let response;
    try { response = await fetch(`${stack.apiUrl}${path}`, {
      method, redirect: 'error', headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(remaining(15_000)),
    }); } catch { throw new LocalCheckError('Local HTTP transport failed; request and credentials withheld.'); }
    let data;
    try { const text = await response.text(); data = text ? JSON.parse(text) : null; }
    catch { throw new LocalCheckError('Local HTTP response was not JSON; body withheld.'); }
    return { status: response.status, ok: response.ok, data };
  }
  async function rpc(name, body = {}) {
    const result = await request(`/rest/v1/rpc/${name}`, { method: 'POST', body, service: true });
    requireCheck(result.ok, 'Trusted local worker RPC failed; response withheld.');
    return result.data;
  }
  function core(account) {
    // Real fetch and production typed client. No in-process handler or fake response.
    return createCoreClient({ baseUrl: `${stack.apiUrl}/functions/v1/core`, accessToken: async () => account.session?.access_token ?? null,
      fetch: (url, init) => {
        const phaseSignal = AbortSignal.timeout(remaining(15_000));
        return fetch(url, { ...init, redirect: 'error', signal: init?.signal ? AbortSignal.any([init.signal, phaseSignal]) : phaseSignal });
      } });
  }
  async function emailOtp(email) {
    const mailDeadline = Date.now() + remaining(20_000);
    while (Date.now() < mailDeadline) {
      let search;
      try { search = await fetch(`${stack.mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, { redirect: 'error', signal: AbortSignal.timeout(remaining(3000)) }); }
      catch { throw new LocalCheckError('Local email sink is unavailable.'); }
      requireCheck(search.ok, 'Expected the local Mailpit v1 search API.');
      const results = await search.json();
      const match = results.messages?.find(message => message.To?.some(recipient => recipient.Address === email));
      if (match && typeof match.ID === 'string' && /^[a-zA-Z0-9-]+$/.test(match.ID)) {
        const response = await fetch(`${stack.mailUrl}/api/v1/message/${match.ID}`, { redirect: 'error', signal: AbortSignal.timeout(remaining(3000)) });
        requireCheck(response.ok, 'Local OTP message could not be read.');
        return extractEmailOtp(await response.json(), email);
      }
      await new Promise(resolveWait => setTimeout(resolveWait, 200));
    }
    throw new LocalCheckError('Local OTP delivery timed out; no mail content logged.');
  }
  async function authenticate(suffix, wrongCodeAndReplay = false) {
    const email = syntheticEmail(runId, suffix);
    const account = { email, session: null, id: null, api: null }; accounts.push(account);
    const sent = await request('/auth/v1/otp', { method: 'POST', body: { email, create_user: true, data: { fixture_label: FIXTURE_LABEL, fixture_run: runId } } });
    requireCheck(sent.ok, 'Real Auth OTP request was rejected.');
    const otp = await emailOtp(email);
    if (wrongCodeAndReplay) {
      const wrong = `${otp[0] === '0' ? '1' : '0'}${otp.slice(1)}`;
      const rejected = await request('/auth/v1/verify', { method: 'POST', body: { email, token: wrong, type: 'email' } });
      requireCheck(!rejected.ok && [400, 401, 403, 422].includes(rejected.status), 'Auth accepted an incorrect OTP or failed unexpectedly.');
    }
    const verified = await request('/auth/v1/verify', { method: 'POST', body: { email, token: otp, type: 'email' } });
    requireCheck(verified.ok && typeof verified.data?.access_token === 'string' && typeof verified.data?.refresh_token === 'string', 'Real email OTP verification failed.');
    account.session = verified.data; account.id = verified.data.user?.id; account.api = core(account);
    requireCheck(typeof account.id === 'string' && verified.data.user?.user_metadata?.fixture_run === runId, 'Auth fixture identity metadata did not match.');
    const claims = claimsFrom(account.session.access_token);
    requireCheck(claims.sub === account.id && claims.role === 'authenticated' && claims.amr?.some(entry => entry.method === 'otp' && Math.abs(Date.now() / 1000 - entry.timestamp) < 300), 'Real token lacks a recent signed OTP AMR.');
    if (wrongCodeAndReplay) {
      const replay = await request('/auth/v1/verify', { method: 'POST', body: { email, token: otp, type: 'email' } });
      requireCheck(!replay.ok && [400, 401, 403, 422].includes(replay.status), 'Auth accepted a consumed OTP or failed unexpectedly.');
      const tokenParts = account.session.access_token.split('.');
      tokenParts[2] = `${tokenParts[2][0] === 'a' ? 'b' : 'a'}${tokenParts[2].slice(1)}`;
      const forged = { session: { access_token: tokenParts.join('.') } };
      await rejectsCode(() => core(forged).getConsents(), 'UNAUTHENTICATED');
      const algorithm = JSON.parse(Buffer.from(tokenParts[0], 'base64url').toString('utf8')).alg;
      requireCheck(['HS256', 'ES256', 'RS256', 'EdDSA'].includes(algorithm), 'Unexpected JWT signing algorithm.');
      console.log(`Auth signing algorithm observed: ${algorithm}; core gateway verify_jwt=false, handler validates with getUser.`);
    }
    return account;
  }
  async function runDeletionWorker(onlyIds) {
    const pending = (await owner.query("select user_id from public.deletion_jobs where status='pending'")).rows;
    requireCheck(pending.every(job => accounts.some(account => account.id === job.user_id)), 'Refusing a pending deletion outside this run.');
    const queue = await rpc('hl_deletion_jobs');
    requireCheck(Array.isArray(queue) && queue.every(job => accounts.some(account => account.id === job.user_id)), 'Refusing to process a deletion job outside this synthetic run.');
    for (const job of queue) ownedJobIds.add(job.id);
    const selectedIds = onlyIds ?? [...ownedJobIds];
    requireCheck(Array.isArray(selectedIds) && selectedIds.every(id => ownedJobIds.has(id)), 'Deletion worker selection contains a job outside this run.');
    requireCheck(onlyIds === undefined || selectedIds.length > 0, 'Explicit deletion worker selection cannot be empty.');
    if (ownedJobIds.size === 0) return;
    try {
      const { stdout } = await runFile('deno', ['run', '--no-prompt', `--allow-net=${new URL(stack.apiUrl).host}`,
        '--allow-env=SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,HEALTHLOOP_ENV,HEALTHLOOP_BUILD_MODE,HEALTHLOOP_PROJECT_LABEL,HEALTHLOOP_ALLOWED_ORIGINS,HEALTHLOOP_DELETION_JOB_IDS',
        '--config', resolve(directory, 'supabase/functions/core/deno.json'), resolve(directory, 'supabase/functions/deletion-worker/run.ts')], {
        cwd: directory, timeout: remaining(30_000), maxBuffer: 1024 * 1024,
        env: { ...process.env, SUPABASE_URL: stack.apiUrl, SUPABASE_ANON_KEY: stack.anonKey, SUPABASE_SERVICE_ROLE_KEY: stack.serviceKey,
          HEALTHLOOP_ENV: 'test', HEALTHLOOP_BUILD_MODE: 'real', HEALTHLOOP_PROJECT_LABEL: LOCAL_PROJECT, HEALTHLOOP_ALLOWED_ORIGINS: '', HEALTHLOOP_DELETION_JOB_IDS: selectedIds.join(',') },
      });
      requireCheck(/^Completed \d+ deletion job\(s\)\. No user identifiers are logged\.\s*$/.test(stdout), 'Deletion worker output did not report completion.');
    } catch { throw new LocalCheckError('Real deletion worker failed; captured output withheld, durable job retained for retry.'); }
  }
  try {
    try { owner = await pool.connect(); }
    catch { throw new LocalCheckError('Local PostgreSQL connection unavailable; credentials withheld.'); }
    locked = (await owner.query("select pg_try_advisory_lock(hashtext('healthloop-local-http-harness')) as locked")).rows[0].locked;
    requireCheck(locked, 'Another local HTTP harness is already running.');
    const settings = (await owner.query('select demo_mode,project_label,rewards_paused from private.system_settings where singleton')).rows[0];
    requireCheck(settings?.project_label === LOCAL_PROJECT && !settings.rewards_paused, 'Local DB project label or reward state does not match the fresh test stack.');
    const present = (await owner.query("select exists(select 1 from auth.users) or exists(select 1 from public.profiles where status<>'deleted') or exists(select 1 from public.daily_activity_summaries) or exists(select 1 from public.activity_submissions) or exists(select 1 from public.deletion_jobs where status='pending') as occupied")).rows[0].occupied;
    requireCheck(!present, 'Refusing a stack containing existing users, health summaries or pending deletions. No data was reset.');
    originalMode = settings.demo_mode;
    prepared = true;
    await owner.query('update private.system_settings set demo_mode=false where singleton');

    const anonymous = await request('/functions/v1/core/account/consents');
    requireCheck(anonymous.status === 401, 'Anonymous request unexpectedly reached core account data.');
    const anonymousTable = await request('/rest/v1/profiles?select=id');
    requireCheck([401, 403].includes(anonymousTable.status), 'Anonymous PostgREST access was not denied.');
    const a = await authenticate('subject', true); const b = await authenticate('other');
    pass('real OTP wrong-code rejection, acceptance, replay rejection, signed-token tamper rejection and anonymous denial');

    requireCheck((await a.api.getConsents()).profile === null, 'A new authenticated account did not require onboarding.');
    await a.api.setConsents(consent);
    await b.api.setConsents({ ...consent, localRead: false, cloudSync: false });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    // Native-shaped schema fixture only. No HealthKit source was queried or verified.
    const activity = { taskDate: today, eligibleSteps: 3000, sourceCategory: 'apple_phone', sourcePolicy: 'single-approved-source-v1', sourcePinToken: randomUUID(), revision: 1, observedAt: new Date().toISOString(), timezone: 'Asia/Hong_Kong' };
    const accepted = await a.api.syncActivity(activity);
    requireCheck(accepted.status === 'accepted', 'Synthetic activity was not accepted by the served real-mode Edge.');
    const claimKey = randomUUID(); const claim = await a.api.claimMission(accepted.instanceId, claimKey);
    requireCheck(claim.addedPoints === 10 && same(await a.api.claimMission(accepted.instanceId, claimKey), claim), 'Claim or identical replay changed the earned amount.');
    const ledger = await a.api.getLedger();
    requireCheck(ledger.items.length === 1 && ledger.items[0].points === 10 && (await a.api.getPointsSummary()).balance === 10, 'Ledger did not reconcile to one server award.');
    requireCheck((await a.api.getMissions()).items.some(item => item.id === accepted.instanceId), 'Claimed mission was missing from the typed list.');
    pass('typed consent, synthetic native-shaped summary, mission claim, identical retry and immutable ledger over real HTTP');

    await rejectsCode(() => b.api.syncActivity(activity), 'CONSENT_REQUIRED');
    await b.api.setConsents(consent);
    await rejectsCode(() => b.api.claimMission(accepted.instanceId, randomUUID()), 'NOT_FOUND');
    requireCheck((await b.api.getLedger()).items.length === 0, 'User B could read user A ledger.');
    const bReadsA = await request(`/rest/v1/profiles?select=id&id=eq.${a.id}`, { token: b.session.access_token });
    requireCheck(bReadsA.ok && Array.isArray(bReadsA.data) && bReadsA.data.length === 0, 'PostgREST RLS exposed another profile.');
    const write = await request('/rest/v1/point_ledger', { token: a.session.access_token, method: 'POST', body: { points: 999 } });
    requireCheck([401, 403].includes(write.status), 'PostgREST permitted direct client ledger mutation.');
    await a.api.setConsents({ ...consent, localRead: false, cloudSync: false });
    await rejectsCode(() => a.api.syncActivity({ ...activity, revision: 2, eligibleSteps: 5000 }), 'CONSENT_REQUIRED');
    await rejectsCode(() => a.api.claimMission(accepted.instanceId, randomUUID()), 'CONSENT_REQUIRED');
    pass('real PostgREST A/B RLS, direct-write rejection and consent withdrawal block further awards');

    const prefs = await a.api.getNotificationPreferences(); requireCheck(!prefs.enabled && prefs.revision === 0, 'Reminder defaults were not disabled.');
    const saved = await a.api.setNotificationPreferences(preference);
    requireCheck(saved.revision === 1 && same(await a.api.setNotificationPreferences(preference), saved), 'Reminder replay did not preserve the revision.');
    const disabled = await a.api.setNotificationPreferences({ ...preference, enabled: false, expectedRevision: 1 });
    await rejectsCode(() => a.api.setNotificationPreferences(preference), 'PREFERENCES_CONFLICT');
    const exportA = await a.api.exportAccount(); const exportB = await b.api.exportAccount();
    requireCheck(exportA.profile.id === a.id && exportB.profile.id === b.id && same(exportA.notificationPreferences, disabled) && exportB.ledger.length === 0, 'Account export or reminder isolation failed.');
    pass('optional reminders without health consent, stale-enable conflict, exact retry and own-account export');

    const refreshed = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: a.session.refresh_token } });
    requireCheck(refreshed.ok && refreshed.data?.user?.id === a.id && typeof refreshed.data.access_token === 'string', 'Real refresh token exchange failed.');
    a.session = refreshed.data;
    requireCheck((await a.api.getConsents()).profile.id === a.id, 'Refreshed session failed the served Edge identity check.');
    const logout = await authenticate('logout'); const refreshToken = logout.session.refresh_token;
    const signedOut = await request('/auth/v1/logout', { method: 'POST', token: logout.session.access_token });
    requireCheck(signedOut.ok, 'Real Auth logout failed.'); logout.session = null;
    await rejectsCode(() => logout.api.getConsents(), 'UNAUTHENTICATED');
    const revoked = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } });
    requireCheck(!revoked.ok && [400, 401, 403].includes(revoked.status), 'Logout did not revoke the refresh session.');
    // Logout does not promise immediate access-JWT expiry; this checks refresh revocation and the cleared caller only.
    pass('real refresh, logout, refresh revocation and cleared in-memory caller session');

    const oldA = a.session.access_token; const oldB = b.session.access_token;
    const deletionA = await a.api.deleteAccount(); const deletionB = await b.api.deleteAccount();
    requireCheck(deletionA.status === 'deletion_requested' && deletionB.status === 'deletion_requested', 'Recent real OTP did not authorize deletion.');
    requireCheck(same(await a.api.deleteAccount(), deletionA), 'Deletion request retry changed its durable job.');
    await rejectsCode(() => a.api.getPointsSummary(), 'ACCOUNT_INACTIVE');
    await rejectsCode(() => b.api.syncActivity(activity), 'ACCOUNT_INACTIVE');
    // Exercise the real recovery boundary: purge and Auth removal committed, but
    // completion has not run. The production worker must tolerate user_not_found.
    await rpc('hl_purge_deletion', { p_job_id: deletionA.jobId });
    const removeA = await request(`/auth/v1/admin/users/${a.id}`, { method: 'DELETE', service: true });
    requireCheck(removeA.ok, 'Auth deletion at the worker retry boundary failed.');
    requireCheck((await rpc('hl_deletion_jobs')).some(job => job.id === deletionA.jobId), 'Partial deletion did not retain its durable pending job.');
    await runDeletionWorker([deletionA.jobId]);
    const afterScopedWorker = await rpc('hl_deletion_jobs');
    requireCheck(afterScopedWorker.some(job => job.id === deletionB.jobId) && !afterScopedWorker.some(job => job.id === deletionA.jobId), 'Scoped worker processed an excluded job or failed the selected job.');
    const selectedJob = (await owner.query('select status from public.deletion_jobs where id=$1', [deletionA.jobId])).rows[0];
    requireCheck(selectedJob?.status === 'complete', 'Selected deletion job was not durably completed.');
    const remainingIdentity = await request('/auth/v1/user', { token: oldB });
    requireCheck(remainingIdentity.ok && remainingIdentity.data?.id === b.id, 'Scoped worker removed the excluded Auth identity.');
    await rejectsCode(() => b.api.getPointsSummary(), 'ACCOUNT_INACTIVE');
    await runDeletionWorker(); await runDeletionWorker();
    requireCheck((await rpc('hl_deletion_jobs')).length === 0, 'Deletion worker left pending jobs after retry.');
    for (const token of [oldA, oldB]) {
      const current = await request('/auth/v1/user', { token }); requireCheck(current.status === 401 || current.status === 403, 'Deleted Auth identity still accepted its old token.');
      await rejectsCode(() => core({ session: { access_token: token } }).getConsents(), 'UNAUTHENTICATED');
    }
    const residue = (await owner.query('select status,account_key from public.profiles where id=any($1::uuid[])', [[a.id, b.id]])).rows;
    requireCheck(residue.length === 2 && residue.every(row => row.status === 'deleted' && row.account_key === null), 'Deletion failed to retain inactive tombstones with cleared account keys.');
    requireCheck((await owner.query('select count(*)::int n from public.notification_preferences where user_id=any($1::uuid[])', [[a.id, b.id]])).rows[0].n === 0, 'Notification preferences survived purge.');
    pass('durable deletion, scoped worker exclusion, partial Auth-deletion retry, repeated worker and old-JWT rejection');
  } finally {
    deadline = Date.now() + 60_000;
    let cleanupFailed = false;
    try {
      if (prepared) {
        // Remove only this run's synthetic identities. Never reset Auth or application schemas.
        for (const account of accounts) {
          const row = (await owner.query('select u.id,p.status from auth.users u left join public.profiles p on p.id=u.id where u.email=$1 and u.raw_user_meta_data->>\'fixture_run\'=$2 and u.raw_user_meta_data->>\'fixture_label\'=$3', [account.email, runId, FIXTURE_LABEL])).rows[0];
          if (!row) continue;
          account.id = row.id;
          if (!row.status) {
            const removed = await request(`/auth/v1/admin/users/${row.id}`, { method: 'DELETE', service: true });
            requireCheck(removed.ok, 'Unonboarded synthetic Auth fixture could not be removed.');
          } else if (row.status === 'active') {
            requireCheck(account.session, 'Synthetic fixture requires reauthentication before cleanup.');
            await account.api.deleteAccount();
          }
        }
        await runDeletionWorker();
      }
    } catch { cleanupFailed = true; }
    finally {
      try { if (prepared) await owner.query('update private.system_settings set demo_mode=$1 where singleton', [originalMode]); }
      finally {
        try { if (owner && locked) await owner.query("select pg_advisory_unlock(hashtext('healthloop-local-http-harness'))"); }
        finally { try { owner?.release(); } finally { await pool.end(); } }
      }
    }
    requireCheck(!cleanupFailed, 'Synthetic cleanup did not finish; local mode restored, durable state retained for operator recovery.');
  }
}

it('runs actual local OTP, refresh, RLS, core transactions, preferences and durable deletion recovery', async () => {
  try { await exerciseLocalStack(); }
  catch (error) {
    // Fetch/JSON/PostgreSQL/child-process exceptions can carry body snippets or
    // connection values. Only our fixed, deliberate diagnostics may escape.
    if (error instanceof LocalCheckError) throw error;
    // eslint-disable-next-line preserve-caught-error -- A retained cause can disclose OTPs, tokens or mail in the test reporter.
    throw new Error('Local stack integration failed; underlying response, connection and process details withheld.');
  }
});
