# Native implementation and honest acceptance

The real build has no synthetic fixture import or automatic data fallback. `EXPO_PUBLIC_DATA_MODE=real` is mandatory. Expo 55.0.31 uses React 19.2.0 / React Native 0.83.10 from its published bundledNativeModules.json. Official SDK 55 requirements: Xcode 26.2+, iOS 15.1+. Local module scaffold generated with create-expo-module 57.0.1; template samples replaced with the SDK55-compatible Expo Modules DSL and iOS15.1 podspec.

From the installed workspace:

```
pnpm --filter @healthloop/mobile prebuild
pnpm --filter @healthloop/mobile ios --device
```

Set the three public service values in `.env` plus explicit APP_ENV/DATA_MODE as `.env.example` documents. A physical iPhone cannot reach the computer's `127.0.0.1`; use a private LAN address for local Supabase and its core API, or a separately approved HTTPS backend. Public publishable/anon key only. Native HealthKit requires a development build, signing team, matching bundle identifier and HealthKit capability. No EAS account, provisioning or remote build is automatically created.

Run acceptance on **two physical compatible iPhones**. Record model/iOS/build, signing identity (redacted), and reviewer B/C. Screenshots containing real health data must remain outside coding sessions and be redacted for evidence.

1. Email OTP: wrong/expired/resend rate limit, successful login, relaunch, logout, different account. Credentials use chunked Keychain values with WHEN_UNLOCKED_THIS_DEVICE_ONLY; no raw health data cache is persisted.
2. Three independent choices: adult, local read, cloud sync; marketing off initially. Declining cloud sync still permits local reads. Disable sync while query/upload is pending; verify no subsequent requests and no stale UI. Relaunch while offline after withdrawal: local false must override server true.
3. Permission sheet requests `toShare: []` and selected read types only. Complete, dismiss or refuse reads; empty query means no readable data and does not reveal read grant. Return from Health app without repeat authorization prompts.
4. Real phone/watch steps: seven days, duplicate/overlapping sources, manual records and unknown metadata. Known category requires native Apple Health bundle AND phone/watch productType. No name-based approval. Metadata coverage on devices remains unverified; unsupported records fail closed. Source pins and monotonic revision counters are account/day scoped in Keychain, and retained for same-day continuity across logout (not raw sample caching). Server pins remain authoritative; a reinstall cannot change server pin.
5. Valid day → summary sync → atomic server claim → reconciled ledger. Offline/timeout never creates local points. After a server-confirmed onboarding, relaunch offline: local reads may work but cloud actions stay disabled until an explicit reconnect obtains fresh consent. A stored draft alone must not allow reads. Verify a locally withdrawn choice survives relaunch and overrides older server consent. Authentication, deleted-account, malformed-response and secure-storage failures must fail closed.
6. Interrupt a summary response and a claim response after the server commits. Reconnect and retry the pending day in the same process: the exact revision/body and claim key must be reused; canonical points/ledger must reconcile without a second award. Force a ledger-refresh failure: retry refresh without replaying a successful claim. Switch account or withdraw consent during each stage: no later stage or old-account result may appear. Relaunch drops in-memory pending payloads; reread local data and reconcile the revision counter with accepted server summaries. Previous-day sync must use the eligible sample observation time and respect the server cutoff. Reinstall/another device cannot recover the source pin automatically; reject an incompatible source rather than silently repin.
7. Request sleep/heart rate separately. Sleep union avoids overlap, heart rate shows measured time, raw rows stay in memory only. Missing/invalid values never fabricated. Clear on consent withdrawal, logout and account switch.
8. Export invokes OS share sheet only on request. Correction accepts task date and reason. Delete requires fresh email OTP before DELETE; test old JWT rejection server-side.
9. Large text / VoiceOver: all four tabs, buttons, statuses, seven-day values, dynamic layouts. No reward catalog is falsely presented as active; disabled item explains not open.

Source policy intentionally undercounts ambiguous overlapping samples and does not claim parity with Apple Health totals. Server sees only allowed category, random source pin token, policy, date, eligible count, revision, timezone and observation time; clients can still spoof these claims. Device attestation is not implemented. No sleep/heart-rate data uploads or HealthKit writes exist. Demo execution, reward redemption UI, actual notification scheduling and active sponsors are not implemented in this slice.

Official references checked: https://docs.expo.dev/versions/v55.0.0/ ; https://docs.expo.dev/modules/module-api/ ; https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data ; https://supabase.com/docs/guides/auth/quickstarts/react-native . Native build and real-device checks must be recorded by actual execution, not inferred from TypeScript tests.
