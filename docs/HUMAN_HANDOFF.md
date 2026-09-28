# Human handoff

No external services were provisioned, no production data was loaded, and no transaction was broadcast. All tests use synthetic input in disposable local databases.

1. Install/use pinned Node and pnpm, run the documented automated commands, and review their actual outcomes in TEST_EVIDENCE.
2. Use the pinned local stack launcher and the configured Mailpit sink; actual local OTP/JWT/Edge and the deletion worker passed on2026-09-24. Real SMTP/project provisioning is a separate operator action requiring approval. Configure a code email template, expiration and provider-side throttling; never add a universal test code.
3. Run `pnpm mobile:preflight` on a new host. On 2026-09-24 this Mac passed, with actual iPhoneOS and Simulator compilation plus simulator installation/launch. No Xcode repair is currently required; see NATIVE_BUILD_EVIDENCE. B now prepares an available Apple developer team/signing profile with HealthKit capability, a unique bundle identifier and reviewed read-only explanation. Rebuild the development client with the committed native configuration; do not use Expo Go or purchase a membership automatically.
4. Test on at least two real compatible iPhones. Record device model, iOS version, app commit/build, authorization requested, nonempty/empty results, manual entries, phone/watch overlap, source replacement, return-to-foreground and revoked/unknown read states. Evidence must be redacted and never contain real health samples in the coding session.
5. Verify the complete sign-in → separate consent → native read → minimum summary → canonical daily top-up → ledger path. Verify cloud-off leaves local reads usable, cancels queued uploads, and that logout/account switching clears sensitive memory.
   Also exercise the implemented P29 preferences: refusal leaves core usable; quiet hours and Hong Kong time are honored; an offline local stop survives restart; old-account or stale saves cannot reschedule; actual OS delivery is recorded separately from a scheduling result. No APNs entitlement/token, health content or ad reward is involved.
6. C reviews schema/RLS/concurrency and B reviews the backend; C reviews B's native implementation. Project labels do not automatically create admin accounts.
7. Complete and approve retention/purge and restore/tombstone replay, full admin controls, security/privacy review, accessibility and store disclosures before distribution.
8. Start the independent Lab only after the core slice is stable. Provisioning, testnet deployment and broadcasts need explicit approval; private keys stay in local/server secret configuration. Wallet chooser display alone never counts as two-wallet evidence.

Device results, legal approval and independent audit fields must stay pending until people supply those results. No mainnet switch, sale, custody or payments are authorized.
