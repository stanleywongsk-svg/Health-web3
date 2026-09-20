# HealthLoop / 健康循环

An iOS-first adult health-habit app with read-only HealthKit and server-controlled, nontransferable points. UI is Simplified Chinese; mission time is Asia/Hong_Kong. Points have no cash value or future-token conversion rights. No wallet is required.

This repository implements the **first core slice**, not the complete 58-requirement product. Native reads, email OTP screens, separate consent, minimum daily summaries, daily/weekly mission accounting, ledger, export/appeal/deletion requests are connected in code. PostgreSQL and client tests use synthetic data. Actual Supabase email delivery, two-iPhone acceptance, full admin operations and release approval remain open. The independent Web3 Lab and conditional P1/P2 work are not implemented.

Start with the [unfinished work report](docs/UNFINISHED_REPORT.md) and [continuation prompt](docs/CONTINUE_PROMPT.md). See also [implementation status](docs/IMPLEMENTATION_STATUS.md), [executed evidence](docs/TEST_EVIDENCE.md), [device setup](docs/DEVICE_SETUP.md), and [human handoff](docs/HUMAN_HANDOFF.md). The complete brief is [MEGA_PROMPT.md](MEGA_PROMPT.md); original IDs/ownership remain in [requirements.json](docs/requirements.json).

## Toolchain

- Node **24.19.0** (`.nvmrc`), pnpm **11.19.0**
- Expo **55.0.31**, React Native **0.83.10**, React **19.2.0**
- PostgreSQL **17**, Supabase CLI/local Docker for full Auth/Edge testing
- Xcode compatible with Expo55 and CocoaPods for iOS development builds
- Deno **2.7.1** for Edge checks

Use the pinned Node in your shell before running commands. The historical implementation host used a bundled Node24 because its system Node25 differed. On a fresh clone, install/select the pinned Node version; old host paths in TEST_EVIDENCE are historical evidence only.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm mobile:bundle
pnpm typecheck:edge
pnpm test:edge
```

`check` runs lint, strict TypeScript checks, unit tests and import/secret/requirement boundary checks. `mobile:bundle` builds the real iOS JavaScript bundle and rejects synthetic fixture code. Neither command proves native compilation, signing or real-device HealthKit access.

## Local backend

The local PostgreSQL accounting suite runs without Docker. It deliberately resets only an explicitly named disposable loopback test database:

```sh
HEALTHLOOP_TEST_DATABASE_URL=postgres://localhost:55432/healthloop_test_core \
HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:db

# Run after the database test runner creates the disposable schema:
HEALTHLOOP_TEST_DATABASE_URL=postgres://localhost:55432/healthloop_test_core \
HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:integration
```

Create/start that database first using the tested instructions in [BACKEND_NOTES](docs/BACKEND_NOTES.md), or provide an equivalent local PostgreSQL17 database. Never point this runner at shared data. It supplies a local `auth.uid/jwt/role` shim so actual RLS/locks/transactions run; the shim does **not** validate Supabase email delivery or real JWT signatures.

For the complete local Supabase services, install a compatible Supabase CLI and make Docker healthy, then from the repository root:

```sh
supabase start
supabase db reset
```

The supplied seed is explicitly local/synthetic. Follow BACKEND_NOTES to configure real-native development separately; the real app rejects synthetic mode and never falls back to generated health readings. Copy the Edge `.env.example`, set local values, and serve the core function using the documented backend command. Obtain local public keys from `supabase status`; do not commit or paste secrets into chat. Read local OTP emails in the configured email sink on port54324.

## Mobile

Copy `apps/mobile/.env.example` to `apps/mobile/.env`, set the public local project key and matching core API URL, then:

```sh
pnpm mobile
pnpm mobile:ios
```

For a physical iPhone, use the development computer's private LAN address for both URLs and follow [NATIVE_VERIFICATION](apps/mobile/NATIVE_VERIFICATION.md). A signed development build is required; Expo Go and a browser cannot read HealthKit. HealthKit, sleep and heart-rate permissions remain optional. Missing data is displayed honestly. Unknown/manual sources cannot earn points. On-device source pins are carried as opaque per-day tokens to the backend, not provider IDs.

A generated iOS project can also be prepared without installing native dependencies:

```sh
pnpm --filter @healthloop/mobile exec expo prebuild --platform ios --no-install
```

The current React Native prebuilt-core CocoaPods path rejects project paths containing spaces on this host. Native verification used a temporary no-space staging path; see TEST_EVIDENCE for the outcome and exact steps. Do not interpret prebuild or JavaScript export success as a signed install.

## Scope and operation

- No synthetic mobile build is shipped. Isolated provider fixtures and disposable database data are test-only.
- No active merchant voucher, sponsor campaign, notifications, admin console or Lab wallet flow is presented as complete.
- Offline consent recovery and reconnect behavior are implemented and tested with synthetic inputs; native device verification is still open. Full correction approvals, retention scheduling, backup replay and store acceptance remain checkpoint tasks.
- [API](docs/API.md), [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), [privacy data map](docs/PRIVACY_DATA_MAP.md), and [operations](docs/OPERATIONS.md) describe actual boundaries and release blockers.
- Remote provisioning, publishing, production migrations and testnet broadcasts require explicit approval. Mainnet operations are outside this brief.

## Source backup and continuation

A verified public source backup is available at [stanleywongsk-svg/Health-web3](https://github.com/stanleywongsk-svg/Health-web3). It includes the source snapshot, original planning documents, unfinished-work report, continuation prompt and a Git bundle preserving seven local branch histories. See [backup verification](docs/GITHUB_BACKUP.md) and [restore instructions](docs/BACKUP_AND_RESTORE.md). Recreate dependencies and disposable test databases from a fresh clone; historical host paths and staging artifacts are not recovery dependencies. This backup does not establish native or real Auth/device acceptance.
