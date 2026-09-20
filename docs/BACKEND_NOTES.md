# Backend implementation checkpoint

Implemented on 2026-09-18; consent/cutoff hardening verified on 2026-09-20. Owner C / reviewer B. This is an executable first core slice, not production acceptance.

## Implemented boundary

`supabase/migrations/202609180001_core.sql` rebuilds the core schema on PostgreSQL 17 with Supabase's `auth.uid()`, `auth.jwt()` and `auth.role()` helpers. No migration contains a test clock, OTP bypass, external project or production credential. `private.server_now()` always reads PostgreSQL's clock; only the privileged disposable test fixture replaces its implementation, then restores it.

Apply all migrations in filename order. `202609200001_consent_weekly_cutoff.sql` preserves existing data/grants and replaces two functions: pure permission withdrawal bypasses the consent rate budget, while grants/mixed upgrades remain limited; implicit weekly bonuses now use the weekly instance’s own pinned rule deadline. A valid late daily claim may succeed with no expired weekly bonus.

The schema contains profiles, versioned consent events, immutable mission versions, unique daily/weekly mission instances, accepted minimum activity summaries, a submitted-revision journal, risk flags, append-only points, idempotent claim outcomes, demo catalog/redemptions, appeals and durable deletion jobs. Internal tables contain rate windows, an incident switch, verified admin roles and immutable admin audit entries. Sleep, heart-rate readings, raw sensor samples, emails, health-provider IDs and wallets are absent.

Only explicitly granted authenticated RPCs mutate application data. Every exposed table has RLS and no direct client INSERT/UPDATE/DELETE privilege. Users can read their active account's own rows. Admin metadata supplied by the user does not confer authority. Internal service jobs require the `service_role` JWT role and separate EXECUTE grants. Definer functions fix their search path and derive identity from Auth.

All account mutations lock the profile row first. Claims then share-lock the incident switch; pausing takes its exclusive lock. This serializes consent withdrawal/deletion against sync and claims, and establishes a clear pause boundary. Business uniqueness is `(user, kind, period_start)`, independent of request UUID and published version. Ledger award uniqueness is `(account_key, instance_id, entitlement_total)`. Ledger amounts are integer deltas, not trusted request values. Balances are computed from the committed ledger, without a cached projection.

Daily tiers award 10/20/30 total with top-ups only. A weekly bonus counts three distinct accepted qualifying days, whether or not each daily award was claimed; direct weekly claims are supported. Both daily and weekly instances pin their version and selected goal. Weekly changes do not repin an existing instance. The rule table currently permits versioned cutoff/goal configuration while fixing the specified tier/cap rules; full draft/publish administration is not implemented.

The first accepted summary pins its category/policy and opaque source token. Manual/unknown categories are rejected. Demo categories and real categories are mutually exclusive at both Edge schema and database configuration boundaries. Observed timestamps are validated but never used to reopen a cutoff. Same revision+payload replays its stored outcome; changed payload conflicts, including pending revisions. Steps above 30,000, downward revisions and large rapid increments create pending reviews, retain the proposed minimum summary and do not alter the accepted summary or balance. These are conservative testable risk rules, not proof of exercise or fraud. A malicious authenticated device can still fabricate a structurally valid supported-source summary; source labels/tokens are not attestations.

## API

Base path `/functions/v1/core`; every request uses `Authorization: Bearer <Supabase access token>`. Success is `{data,requestId}`, error is `{error:{code,message},requestId}`. Error messages are Simplified Chinese; code identifiers are stable English. JSON bodies are capped at 8 KiB. CORS allows only configured exact origins, no wildcard or cookie session. The handler validates every token using `auth.getUser(token)` and executes SQL under that same user token. It never accepts a body user ID or ledger amount.

| Method / route | JSON request | RPC |
|---|---|---|
| GET /account/consents | — | hl_consents |
| POST /account/consents | adultConfirmed=true, localRead, cloudSync, marketing, version="2026-09-18" | hl_set_consents |
| POST /activity/sync | taskDate, eligibleSteps 0..100000, sourceCategory, sourcePolicy, sourcePinToken UUID, revision positive integer, observedAt ISO-offset timestamp, timezone="Asia/Hong_Kong" | hl_sync_activity |
| GET /health/summary | latest seven calendar days | hl_health_summary |
| GET /missions | current/recent daily and weekly instances | hl_missions |
| POST /missions/:id/claim | idempotencyKey UUID | hl_claim |
| GET /points/summary | — | hl_points_summary |
| GET /points/ledger | limit 1..100, cursor optional bigint string | hl_ledger |
| GET /rewards | demo catalog only | hl_rewards |
| POST /redemptions | rewardId UUID, idempotencyKey UUID | hl_redeem |
| GET /redemptions | limit 1..100, cursor optional bigint string | hl_redemptions |
| POST /redemptions/:id/cancel | {} | hl_cancel_redemption |
| POST /appeals | taskDate, reason 1..1000 characters | hl_create_appeal |
| POST /account/export | {} | hl_export |
| DELETE /account | {}, recent OTP required | hl_request_deletion |
| POST /admin/reward-pause | paused boolean, reason 10..1000 characters | hl_admin_pause |

Real sourceCategory is `apple_phone` or `apple_watch`; policy `single-approved-source-v1`. Demo sourceCategory is `synthetic_demo`; policy `synthetic-demo-v1`. Category names are intentionally not arbitrary provider bundle identifiers.

Consent response: `{profile:null}` before onboarding, otherwise `{profile:{id,status,adultConfirmed,localRead,cloudSync,marketing,consentVersion}}`. Inactive profiles are rejected.

Sync response: `{instanceId,taskDate,eligibleSteps:number|null,status:"accepted"|"pending_review",revision,sourceCategory,ruleVersion}`. Pending responses show the previous accepted eligible steps, or null when none exist, and never manufacture zero.

Mission response: `{items:[{id,kind:"daily_steps"|"weekly_consistency",periodStart,ruleVersion,selectedGoal,awardedPoints,eligibleSteps:number|null,cutoffAt,tiers:[{steps,points}],weeklyDaysRequired,weeklyBonusPoints}]}`.

Claim response: `{instanceId,addedPoints,dailyAwardedPoints,weeklyAwardedPoints,balance}`. Daily claims also evaluate the dependent weekly bonus. For a weekly-only claim dailyAwardedPoints is zero. Same idempotency key returns the original outcome, so its original balance can be older than a subsequent points-summary response.

Points response: `{availablePoints,pendingEvaluations,earnedPoints,spentPoints,reversedPoints}`; reversedPoints currently represents refunds, since reviewed negative reward adjustments are not implemented. Ledger response: `{items:[{id:string,kind,points,createdAt,instanceId:string|null}],nextCursor:string|null}`. A full final page can return a cursor leading to an empty final page; no row is duplicated.

Export response contains exportedAt, profile, consentEvents, activitySummaries, activityRevisions, missions, ledger, appeals and redemptions. Historical exported rows use their stored SQL field names. Export is currently synchronous and whole-account; a streaming/chunked export job is a scaling follow-up.

Deletion response: `{jobId,status:"deletion_requested"}`. Appeals return `{id,status:"open"}`. Demo redemptions return `{id,status:"demonstration"|"cancelled",demoCode,pointsCost}`; these UUID codes are clearly non-redeemable, and cannot be exchanged at a merchant. Reservation, stock decrement, debit and row creation share a transaction. Cancellation restores stock and credits exactly once. A real redeem/consume flow is out of scope.

## Local commands and executed evidence

The full Supabase stack could not start because the installed Docker engine returned HTTP 500. Supabase email delivery, OTP expiry/resend behavior, token validation over a live Auth server and the Edge network gateway remain unverified. The Supabase CLI configuration supplies a local email sink and six-digit ten-minute provider OTP template, with 60-second resend throttling and no universal code.

Native PostgreSQL 17.11 was installed locally. A disposable cluster was initialized at `/tmp/healthloop-pg17`, bound only to `127.0.0.1:55432` with max_connections=160. Root stopped this disposable cluster after final verification; no background server was left running. It is separate from the package manager's default cluster. To start that already initialized cluster after stopping it:

```sh
/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D /tmp/healthloop-pg17 -l /tmp/healthloop-pg17.log start
```

For a fresh native cluster, use installed PostgreSQL 17 binaries:

```sh
initdb -D /tmp/healthloop-pg17 -A trust --no-locale -E UTF8
pg_ctl -D /tmp/healthloop-pg17 -l /tmp/healthloop-pg17.log -o '-h 127.0.0.1 -p 55432 -c max_connections=160' start
createdb -h 127.0.0.1 -p 55432 healthloop_test_core
```

The database username is the local operating-system username for native initdb. Use a dedicated service username/password in CI. Trust authentication is solely for the disposable loopback test cluster.

```sh
HEALTHLOOP_TEST_DATABASE_URL=postgresql://wi@127.0.0.1:55432/healthloop_test_core HEALTHLOOP_ALLOW_DB_RESET=local-only node supabase/tests/run.mjs
deno check --config supabase/functions/core/deno.json supabase/functions/core/index.ts supabase/functions/deletion-worker/run.ts
deno test --config supabase/functions/core/deno.json supabase/functions/core/handler.test.ts
```

Executed: 28 grouped PostgreSQL integration checks passed, including two real 100-request concurrent claim tests (distinct keys and identical key); mixed-tier races; business version uniqueness; rollback after a failing ledger trigger; exact cutoff equality; separate pinned weekly cutoff before/at/after equality; exhausted consent budget with successful withdrawal and blocked upgrades; independent weekly entitlement; pending revision replay conflict; user isolation/direct mutation denial; forged admin metadata and MFA; pause; last-item contention; insufficient balance; repeated cancellation; ledger reconciliation; deletion racing with a claim; old-token denial; repeated purge; and demo isolation. The owner fixture creates Supabase-compatible Auth helper functions and injects signed-claim equivalents; that fixture does not establish Supabase JWT/OTP integration evidence.

Executed: Deno static checking passed for the core handler and deletion worker. Twelve HTTP handler tests passed with an injected Auth/RPC test double, covering schemas, verified-user call ordering, auth rejection, strict input, body bounds, CORS, safe errors and startup guards. These tests verify our HTTP code and deliberately do not claim live provider token validation.

CI example with a PostgreSQL 17 service and healthloop_test_ci database:

```sh
HEALTHLOOP_TEST_DATABASE_URL=postgresql://postgres:local-only-ci-password@127.0.0.1:5432/healthloop_test_ci HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:db
```

The runner refuses non-loopback targets, database names outside `healthloop_test_*`, or a missing acknowledgement. It drops only schemas in the explicitly supplied disposable database. It requires a database owner and creates the anon/authenticated/service_role test roles if absent.

Once Docker works, from the repository root with an installed Supabase CLI:

```sh
supabase start
supabase db reset
supabase functions serve core --env-file supabase/functions/core/.env.local
```

Copy `.env.example` to `.env.local` first; the CLI injects local Supabase URL/anon key. Local `seed.sql` enables synthetic demo mode and adds one explicitly demo catalog entry, no health samples or users. To test a native real-data development build, set Edge build mode to real and explicitly set `private.system_settings.demo_mode=false` in the local database. Do not reuse a demo database for a remote deployment. No remote deployment or account provisioning was performed.

## Deletion, retention and incident operations

DELETE /account checks the signed Auth `amr` array for an OTP authentication timestamp within five minutes. JWT refresh time does not count. The account becomes inactive immediately; old JWTs cannot read application data, upload, claim or restore consent. The deletion job remains pending until a privileged worker purges core personal rows, deletes the Auth user, and marks completion. The worker safely retries after a crash in any stage. It is a runnable operator job, not a scheduled automation:

```sh
deno run --config supabase/functions/core/deno.json --env-file=supabase/functions/core/.env.local --allow-env --allow-net supabase/functions/deletion-worker/run.ts
```

The operator must securely configure SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY for this worker. Never put the service key in mobile/browser environments. Only counts are logged. The Auth Admin deletion call was statically checked but not executed against a live Supabase service in this session.

The remaining profile tombstone retains Auth UUID and deletion state; the opaque account_key link is removed. Posted ledger entries remain immutable and unlinkable through normal application tables, but this is pseudonymization, not a claim that reidentification is impossible. External backups and prior exports may preserve links. Retention/legal basis for tombstones, ledger and incident records still needs qualified review and operational policy. Restores must reapply deletion tombstones before reopening traffic; backup/restore evidence is not complete.

`hl_prune_summaries()` is service-only and deletes accepted summaries and revision journals older than the configured 90-day default. Scheduling it and setting separate retention for consent, risk, appeal, tombstone and audit records remain operator/product work. No scheduler was secretly installed.

For an incident, an existing server-assigned operator with an aal2 JWT may call `/admin/reward-pause` with a meaningful reason. It blocks new claim/redemption postings while retaining history and permitting cancellation refunds. There is no seeded admin, metadata privilege switch or shared default password. Admin assignment requires an authorized database operator; a full role-management UI is not implemented.

## Remaining blockers and limitations

- Live Supabase Auth/Edge end-to-end and the deletion worker need local-stack execution after Docker is fixed.
- Reviewers can submit appeals and inspect pending rows, but there is no approval UI, dual-review adjustment workflow, compensating negative adjustment RPC or reviewed weekly reconciliation. Do not treat P21 as complete.
- No mission publishing/admin console, sponsor aggregation service, production notifications, product analytics, backup restore drill or independent audit was implemented here.
- The last-item demonstration flow is tested at the database, but mobile reward UX and real merchant redemption are separate acceptance work.
- Source claims remain spoofable without a stronger approved risk/attestation program. No server can infer that these client summaries prove exercise.
- Table retention and synchronous export limits require operational review before live data. Pending fields are minimum activity summaries, not raw health samples.

References verified during implementation: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Edge authentication](https://supabase.com/docs/guides/functions/auth), [CLI configuration](https://supabase.com/docs/guides/local-development/cli/config), [signed AMR claims](https://supabase.com/docs/guides/auth/jwt-fields). npm registry confirmed supabase-js 2.116.0 and zod 4.6.5; Deno lockfile is committed.
