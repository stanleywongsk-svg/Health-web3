# Executed continuation verification — 2026-09-20

This continuation strengthens the executable core; it does not complete all 58 requirements or confer B/C acceptance. UI remains Simplified Chinese. There are still **zero real-iPhone acceptance records, zero real OTP end-to-end records, and zero wallet acceptance records**. The original September 18 evidence is retained below as historical results.

All final root Node commands used `/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` first in PATH (Node24.19.0), pnpm11.19.0 and the existing lockfile. No dependency upgrade was made. Work was developed in isolated worktrees and cherry-picked after review.

| Executed check | Actual final outcome |
|---|---|
| `pnpm install --frozen-lockfile --offline` | Passed, exit0; existing cached dependency set |
| `pnpm check` | Passed, exit0; zero-warning ESLint, root+mobile strict TypeScript, **159 tests across 10 files**, boundaries for 20 client files and all 58 B/C assignments |
| `pnpm test:db` with the disposable loopback environment below | Passed, exit0; **28 grouped real PostgreSQL checks**, including two 100-request concurrent claim runs |
| `pnpm test:integration` with the same DB | Passed, exit0; **10 tests**, rerun after the final API schema restriction |
| `pnpm typecheck:edge` | Passed, exit0; core/deletion-worker Deno checking |
| `pnpm test:edge` | Passed, exit0; **12 tests** |
| `pnpm mobile:bundle` | Final pass, exit0; 780 modules, 3.3MB iOS Hermes bundle; HealthLoopHealth reference present and synthetic provider/policy excluded |
| `git diff --check` | Passed before checkpoint commit |
| Bounded `docker info --format '{{.ServerVersion}}'` | Timed out after 20 seconds; no local Supabase Auth/Edge stack executed |
| Required CoreSimulator framework existence | Still absent; no repeat native compile or device test attempted |

Database environment:

```sh
export PATH="/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
HEALTHLOOP_TEST_DATABASE_URL=postgresql://wi@127.0.0.1:55432/healthloop_test_core \
HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:db
HEALTHLOOP_TEST_DATABASE_URL=postgresql://wi@127.0.0.1:55432/healthloop_test_core \
HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:integration
```

The runner now loads **all migrations in filename order**. New migration `202609200001_consent_weekly_cutoff.sql` was applied after the unchanged original schema. Separate worker DBs `healthloop_test_security` and `healthloop_test_flow` also passed their targeted/full checks; final root results above used `healthloop_test_core`. The owner-only injected fixture clock was restored by the runners. `pg_ctl -D /tmp/healthloop-pg17 stop` completed after final verification; no PostgreSQL startup service was enabled.

## What the new evidence covers

- The live mobile hook uses ConsentController and its tested secure-storage protocol: only a server-confirmed adult/profile/version can permit local offline reads; drafts cannot grant access; withdrawal overrides old confirmation; reconnect disables cloud work; Auth/403/deleted/invalid/corrupt-record failures fail closed.
- The tested ActivitySyncCoordinator is used by today's/previous-day mobile sync buttons. It derives observation time from eligible pinned-source samples, preserves exact pending summary/revision/key in memory, serializes same-day work, clears on withdrawal/account switch, and only displays refreshed server missions/points/ledger. Successful sync/claim followed by a lost response replays safely; refresh failure does not repeat a completed claim.
- SyntheticHealthProvider → aggregation/coordinator → typed API client → actual HTTP handler → actual PostgreSQL: normal completion, response-loss replay, a single persisted submission/claim/ledger award, withdrawal between sync and claim, and previous-day sample timestamps. **Provider data and authentication are synthetic**; Auth validation/PostgREST transport are injected test adapters. This is not real HealthKit, real Supabase JWT/OTP, a running HTTP gateway, or real device evidence.
- Regression tests cover exhausted consent rate budgets permitting pure withdrawal but rejecting upgrades, and weekly bonuses granted before their own pinned deadline but denied exactly at/after it, even when a daily task has a later cutoff.
- A read-only review reproduced an old-account error cleanup blocking a new account. The controller fix and exact delayed-storage/account-switch regression passed. Account-sequence tests also ensure a late withdrawal write or DELETE response cannot advance deletion/cleanup against a replacement account. These are utility/flow tests; a mounted React/native account-switch walkthrough remains required.
- API requests now settle within a 15-second deadline across token lookup, fetch and JSON decoding, propagate caller cancellation, distinguish storage errors, and never auto-retry writes. The typed health summary rejects demo sources in the real core client.

## Failures encountered and remaining limits

An initial `pnpm mobile:bundle` exported JavaScript but failed its isolation gate because the new API response schema contained a `synthetic_demo` enum member. The real client schema was restricted to `apple_phone`/`apple_watch`, a demo-response rejection test was added, and the full check and bundle commands were rerun successfully. The isolation check was not weakened.

An earlier worktree install/source write failed with ENOSPC. Only this task's previously generated staging Pods were removed, recovering space; source and user files were preserved. Historical CocoaPods installation remains documented, but Pods must be installed again before a future native build. Current host recheck details are in ENVIRONMENT_RECHECK.md.

Docker and Xcode remain external prerequisites. No new Swift compilation, signed install, native runtime, email delivery, live deletion worker, device accessibility, two-wallet exercise, hosted CI, legal review or deployment is claimed. Full admin correction/approval, rewards UI, sponsor separation, retention/restore operations and the independent Lab remain open in IMPLEMENTATION_STATUS. Pending operations survive only within one process; there is no persistent health upload queue or automatic source-pin recovery across installations/devices. Local pin/revision metadata cleanup remains unfinished.

No costs, public publishing, production changes, external provisioning or blockchain transactions were initiated. The user-supplied kit and `docs/DEVELOPMENT_KIT.md` were preserved without staging them.

---

# Executed verification — 2026-09-18

This checkpoint records actual local results, not acceptance of the complete product. Human reviewers remain B/C as assigned in IMPLEMENTATION_STATUS. No legal approval, independent audit, signed install, device acceptance, wallet acceptance or remote CI run is claimed.

## Environment

macOS26.3 (25D125); Xcode26.3 (17C529), iPhoneSimulatorSDK26.2; Node24.19.0; pnpm11.19.0; TypeScript5.9.3; Vitest4.1.11; PostgreSQL17.11; Deno2.7.1. CocoaPods1.17.0/Ruby4.0.7 were installed during native verification. PostgreSQL was installed locally and used only in a disposable loopback cluster. No login/startup PostgreSQL service was enabled. The disposable cluster was stopped after successful verification with `pg_ctl -D /tmp/healthloop-pg17 stop`; restart commands are in BACKEND_NOTES.

The system's default Node is25.6.1. Final root commands used the bundled pinned runtime:

```sh
export PATH="/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

Earlier worker/unit checks used system Node25; all final root unit/type/bundle and PostgreSQL/client checks were rerun with Node24.19.0. Deno has its own runtime.

## Final executed checks

| Command | Actual outcome | What it establishes |
|---|---|---|
| `pnpm install --frozen-lockfile` | Passed, exit0 | Workspace resolves from committed package manifests and lockfile |
| `pnpm check` | Passed, exit0 | ESLint with zero warnings; root+mobile strict TypeScript; **114 tests across7 files passed**; boundary checks passed for17 client files and58 IDs |
| `pnpm test:db` with disposable DB environment below | Passed, exit0; **26 grouped PostgreSQL checks** | Real RLS/permissions/locking/transactions, including two 100-request concurrency runs, mixed tiers, rollback, weekly accepted days, pending-revision replay, cutoff equality, inventory/refund races, pause and deletion/old-token checks |
| `pnpm test:integration` with same environment, after DB runner | Passed, exit0; **5 tests** | Typed API client → actual HTTP handler → real PostgreSQL RPCs, consent/sync/top-ups/ledger/pagination/export/user isolation/cloud withdrawal |
| `deno check --config supabase/functions/core/deno.json supabase/functions/core/index.ts supabase/functions/deletion-worker/run.ts` | Passed, exit0 | Edge and deletion worker typechecking |
| `deno test --config supabase/functions/core/deno.json supabase/functions/core/handler.test.ts` | Passed, exit0; **12 tests** | HTTP schemas/body limits/CORS/auth call ordering/errors/config guards using injected Auth/RPC doubles |
| `pnpm mobile:bundle` | Passed, exit0 | Actual Expo iOS JavaScript/Hermes export; real native-module reference present, synthetic provider/policy excluded |
| `pnpm --filter @healthloop/mobile exec expo prebuild --platform ios --no-install` (`CI=1`) | Passed, exit0 | Generated iOS project/configuration. Warning: no app icon yet |
| `xcrun swiftc -frontend -parse apps/mobile/modules/healthloop-health/ios/HealthLoopHealthModule.swift` | Passed, exit0 | Swift syntax only; **not typechecking or linking** |
| CocoaPods installation in no-space staging project | Passed, exit0;95 pods | Native dependencies resolved, including HealthLoopHealth and ExpoModulesCore |
| Unsigned simulator `xcodebuild` | **Blocked, exit70 before compilation** | Host is missing CoreSimulator framework; no app build evidence |
| `git diff --check` | Passed | No whitespace errors in tracked changes |

Exact database environment used at root:

```sh
HEALTHLOOP_TEST_DATABASE_URL=postgresql://wi@127.0.0.1:55432/healthloop_test_core \
HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:db

HEALTHLOOP_TEST_DATABASE_URL=postgresql://wi@127.0.0.1:55432/healthloop_test_core \
HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:integration
```

The database runner creates an isolated Supabase-compatible Auth helper shim and explicitly injects claim fixtures. The client/handler integration uses unpredictable **synthetic test tokens** mapped only to synthetic users by an injected validator. It exercises the real HTTP handler and real SQL, but does **not** establish real Supabase JWT verification, email OTP, SMTP delivery, expiry, throttling or an Edge gateway deployment.

The owner-only database test fixture substitutes a fixed server clock inside the disposable test DB and restores it afterward. Production migration code reads the actual database clock and offers no client clock override. No real health data, production records or live credentials were used.

## Defects found and corrected

- Unified consent/source field names and mission version across client/domain/SQL.
- Replaced `.js` imports of TypeScript source with explicit `.ts` imports supported by Metro and Deno; enabled TypeScript source-extension imports. Initial Metro export failure is resolved.
- Anchored private-network URL checks and rejected credential/query-bearing endpoints; disguised remote demo hosts now fail startup.
- Serialized Keychain writes and coalesced health reads; stale consent saves/account switches cannot re-enable withdrawn in-memory upload permission or race two source pins.
- Weekly entitlement now counts accepted qualifying dates without requiring separate daily claims.
- Journaled proposed minimum revisions so changed reuse of a pending revision conflicts.
- Added subprocess tests rejecting unsafe database-reset targets, including query-string host overrides, before a connection is created.
- Preserved revision history in typed account exports; corrected redemption cursor ties.
- Initial plugin lint and API strict-indexing failures were corrected; final lint/typechecking pass.

## Outstanding infrastructure and acceptance

Docker returned HTTP500, so the complete local Supabase Auth/Edge stack was unavailable. No end-to-end OTP or live Auth deletion worker execution is recorded. The worker was typechecked and its SQL purge/retry paths were integration-tested separately.

CocoaPods first failed because React Native's prebuilt-core URI handling rejected the workspace path containing spaces. A temporary no-space staging directory resolved that step. Xcode then failed to load its missing CoreSimulator framework before compilation. First-launch setup stalled. Exact commands/logs and the operator repair step are in [NATIVE_BUILD_EVIDENCE](NATIVE_BUILD_EVIDENCE.md). Neither a native executable nor a signed install exists from this session.

There are **zero real-iPhone acceptance records** and **zero MetaMask/Trust Wallet acceptance records**. VoiceOver, large text, real HealthKit source metadata/manual records/authorization behavior and actual device account switching remain unverified. [NATIVE_VERIFICATION](../apps/mobile/NATIVE_VERIFICATION.md) specifies device evidence to collect without exposing health records.

Full admin approvals, sponsor separation/packet capture, retention scheduling, backup restore/tombstone replay, complete mobile demo rewards, offline relaunch UX and the independent Lab remain unfinished. GitHub Actions is configured for feasible checks but has not run remotely. No remote provisioning, public publishing, payments, wallet broadcasts or mainnet work occurred.

## Archive preparation checks — 2026-09-20

Documentation/source-material archiving only; application code was not changed or retested in this step. `PATH='<bundled Node24 bin>:$PATH' pnpm boundaries` passed: 20 client files, all 58 requirement assignments, no core fixture/Lab imports. `git diff --check` passed. The original attached prompt (49,028 bytes) was copied byte for byte into `docs/source-materials/HealthLoop_Codex_Mega_Prompt.txt` with SHA-256 `4a2fd53736d344c4dbf6d678c06fdf91d2cd806908b1dfe99185aa1041d7f635`. Historical environment JSON, native Podfile.lock and logs are preserved under `docs/archive/environment-evidence`; their dates/outcomes are not new test runs.

GitHub upload and local deletion remain pending a private destination and verified remote backup. Source-backup integrity checks do not replace the unrun P27 database restore/deletion replay or real-device/native/Auth acceptance.

The bounded pre-upload scan covered 41 reachable commits / 150 Git blobs, four unreferenced blobs, and 28 added/working archive/source/README files, including 40 DOCX/XLSX XML parts and 11 archived logs. No likely live credential, private key or personal health-record match was found. Matches were explicit disposable local database/test-key fixtures or public dependency metadata; no secret values were printed. This was a focused pattern/context review, not a complete security/privacy audit. All 58 report IDs and README/report/prompt relative links were checked successfully. Four orphaned source/document drafts were archived by object ID to avoid losing them during later cleanup.

The later full staged whitespace check reported two formatting findings in the verbatim historical `healthloop-pod-install.txt` log (trailing whitespace and an extra final blank line). These original evidence bytes were intentionally preserved; the check was not a clean pass. `git diff 27604e5 HEAD --check -- . ':!docs/archive/environment-evidence/logs'` then passed for source/docs outside the raw log archive. The archive manifest preserves exact hashes of those raw files.
