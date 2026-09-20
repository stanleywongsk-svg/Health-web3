# Decisions and assumptions

- Empty repository was confirmed before scaffolding. The subsequently supplied kit was preserved; its 58 IDs and B/C ownership assignments remain authoritative.
- Use a pnpm TypeScript monorepo and Supabase PostgreSQL/Auth. One backend owner controls migrations, with separate worktrees for native and domain work.
- Pin Node 24.19.0 and pnpm 11.19.0. This matches the bundled pnpm runtime used for verification. System Node 25.6.1 is not the intended project runtime.
- Expo 55.0.31 was selected from published versions because installed Xcode 26.3 is compatible with SDK55; current SDK56/57 documentation requires Xcode26.4+. React Native and Expo package versions follow Expo55 bundledNativeModules.json. Upgrade together after native validation.
- TypeScript5.9.3 is compatible with the selected Expo toolchain and typescript-eslint peer range; no unverified TypeScript7 migration. ESLint10 uses the supported typescript-eslint8 adapter.
- Small local Swift module exposes the exact HealthKit metadata required for conservative source selection. Native compilation and device evidence are separate gates.
- The first slice has no distributable synthetic app. Synthetic values are confined to tests. A failure to read HealthKit never activates demo data.
- Default goal is 3,000 steps; daily tiers 3k/5k/7k grant 10/20/30 maximum, weekly 3 distinct qualifying days grant 20. Server Hong Kong time and next-day noon cutoff are authoritative.
- A source pin is an opaque local mapping, never raw device identity. It is a continuity control, not attestation. Ambiguous source changes cannot earn extra credit.
- Recovery uses separate device records for server-confirmed consent and local withdrawal. An old editable draft cannot grant offline access. Each new connection must verify consent before cloud operations; authentication/invalid-response/storage failures fail closed.
- A pending sync retains only its permitted summary, revision, claim key and stage in process memory. An explicit same-session retry reuses the exact operation; no background retry or optimistic point balance exists. Restart loses that queue, retains only local pin/revision metadata, and reconciles accepted server revisions before submitting fresh local readings. Cross-device/reinstall pin recovery is not implemented.
- Requests have a bounded 15-second deadline, including session lookup and response decoding. Timeout cannot establish whether a write committed; canonical server state and idempotency resolve that uncertainty.
- No provisioning, external deployment, broadcasts, paid accounts or production data actions are part of this checkpoint.
- Working name, retention proposals and legal text require human review. Technical implementation does not constitute B/C acceptance.

Official references checked during setup: [Expo SDK compatibility](https://docs.expo.dev/versions/latest/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/), [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [PostgreSQL RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [HealthKit authorization](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data). Package versions were also checked against npm metadata. See TEST_EVIDENCE for executed verification rather than treating documentation review as runtime proof.
