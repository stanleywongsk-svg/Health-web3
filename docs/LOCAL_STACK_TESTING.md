# Full local Auth / Edge testing

This environment runs real Supabase Auth, PostgREST, PostgreSQL and the Edge runtime on this Mac. Accounts and activity values are synthetic test fixtures. It does not prove HealthKit access, native Keychain behavior, external email delivery or release readiness. Keep real health records out of this test stack.

Use Node24.19.0, pnpm11.19.0 and the repository-pinned Supabase CLI2.117.0. Docker must be running. The [official local-development guide](https://supabase.com/docs/guides/local-development) recommends binding the development network to loopback; the [CLI setup guide](https://supabase.com/docs/guides/local-development/cli/getting-started) supports a pinned project dependency.

## Start only the required services

From the repository root:

```sh
pnpm install --frozen-lockfile
HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm local:start
```

The project launcher supports the pinned CLI2.117.0 and a local Unix-socket Docker engine only. It creates/reuses the owned `healthloop-local-network`, verifies network/container labels and checks configured **and actual** port bindings. A temporary project-specific Docker adapter supplies explicit `127.0.0.1` publish addresses; it is never installed globally. Unsupported publication, another project, host networking or an unhealthy final state fails closed. The launcher does not reset databases or change Docker Desktop's global settings.

This adapter is a tested project compatibility measure, not an official Supabase flag. On Docker Desktop29.8, the documented network default alone still produced `0.0.0.0`/`::` listeners during the first attempt. That stack was stopped before accounts were created. Explicit bindings were then verified through Docker inspection and a real HTTP test run.

The six required services are Auth, PostgreSQL, PostgREST, Kong, Mailpit and Edge runtime. Studio, Storage, Realtime and analytics are excluded to reduce running resource use. API54321, PostgreSQL54322 and Mailpit54324 publish only on loopback. Inspect safely with `docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'`. CLI logs are filtered before writing to mode-0600 `.local/local-backend-*.log`; credential-bearing and oversized lines are omitted. Do not print raw `supabase status` output into a coding session.

The existing migrations and seed are applied on first start. No reset is required. **Never run `test:db` or `test:integration` against this stack**: those older suites reset Auth/public/private schemas and require a separate `healthloop_test_*` database. Do not point automated synthetic tests at a device-test database.

Create `supabase/functions/core/.env.local` if absent, or preserve and review an existing file. Its local-test values are:

```dotenv
HEALTHLOOP_ENV=test
HEALTHLOOP_BUILD_MODE=real
HEALTHLOOP_PROJECT_LABEL=healthloop-local-dev
HEALTHLOOP_ALLOWED_ORIGINS=http://localhost:8081
```

These are configuration values, not credentials. The CLI supplies the local Supabase keys to the function runtime. Start the function in a separate terminal:

```sh
HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm local:serve
```

Keep that process running for HTTP tests. `verify_jwt=false` delegates authentication to the handler's real `auth.getUser(accessToken)` call; the same bearer token then reaches PostgREST/RLS. This is not evidence that the gateway JWT-verification switch is enabled.

The local mail UI is `http://127.0.0.1:54324`. Its messages stay local; no external SMTP provider is configured. Never copy OTPs, session tokens or service-role keys into reports. The `local_smtp` configuration name is used by the pinned CLI (the old `inbucket` name is deprecated).

## Run the actual HTTP suite

In another terminal:

```sh
HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm test:local --reporter=verbose --disableConsoleIntercept
```

This is one sequential integration scenario with six labeled groups. It reads local CLI status into process memory, rejects noncanonical loopback endpoints and a different project, and refuses existing Auth users, live profiles, summaries or pending deletions. It never resets schemas. The harness temporarily disables the seed's demo mode so the shipped typed native-source contract can be exercised using **synthetic** values, then restores the original mode in `finally`. Each generated account is tagged with a random run identifier and uses `local.invalid`; cleanup targets only this run's identities.

The six groups cover real Auth OTP wrong/valid/replayed codes, signed-token tampering and anonymous denial; consent/summary/claim/retry/ledger; PostgREST A/B isolation and withdrawal; reminder preferences and export; refresh/logout refresh-token revocation; and durable deletion with actual Auth removal, selected-job exclusion, crash-boundary recovery, repeat execution and old-JWT rejection. Logout does not imply an already-issued access JWT immediately expires. OTP expiry, resend timing, MFA, external SMTP and native secure-session behavior remain separate gates.

The real deletion worker accepts an optional `HEALTHLOOP_DELETION_JOB_IDS` comma-separated UUID allowlist. Explicit empty/malformed scopes fail before work; an absent scope retains the normal queue behavior. The harness always passes its own job IDs. It proves one selected job completes while another remains pending, before completing that second job. No service key is written into the mobile environment or test output.

After the successful harness run, `demo_mode` returns to its seed value (`true` on this host), all run Auth identities are removed and pending deletions are zero. The still-served Edge is test/real, so the stack is **not** a ready real-device health backend. Retained tombstones/ledger entries are pseudonymous test accounting history; there is no anonymity or full retention-policy acceptance claim.

## Stop and resume

Stop the foreground `functions serve` process with Ctrl-C, then:

```sh
HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm local:stop
```

This preserves the project's database volumes for another session; do not add `--no-backup`. Source, dependencies and compiled app artifacts are retained. No scheduled/background continuation is configured. The loopback network can be reused on the next start.

Loopback deliberately cannot be reached from an iPhone on Wi-Fi. A later device environment needs a separately reviewed LAN binding, its own real-mode database and signing setup from [DEVICE_SETUP](DEVICE_SETUP.md). Do not simply expose this synthetic test environment or reuse its automated fixtures for device acceptance.
