# First-release App Privacy worksheet — 2026-10-05

This worksheet describes the current health/points/achievement implementation. It is not a submitted App Store Connect declaration, privacy-policy approval or certification of a hosted production service. The operator must reconcile the final archive, hosting/SMTP logs, retention and processor contracts before submission. No hosted privacy-policy URL, support contact or legal entity has been invented.

`apps/mobile/app.json` declares the following app-level data in `ios.privacyManifests`. Each is linked to the user, used for app functionality, and not used for tracking. The API receives only the permitted minimum activity summary after separate cloud-sync consent; optional sleep/heart-rate readings remain on the device.

| App Privacy category | Current collection and purpose |
|---|---|
| Contact info → Email address | OTP authentication through Supabase Auth and the selected mail processor. |
| Identifiers → User ID | Auth subject, account-scoped records, access control, export and deletion. |
| Health & fitness → Fitness | Daily eligible steps, task date, minimum source category/policy, revisions and mission outcomes for server verification. Raw HealthKit samples and provider identifiers remain local. |
| User content → Other user content | User-authored correction/appeal explanations; the UI asks users not to include unnecessary personal data. |
| Usage data → Product interaction | Identifiable mission claims, point-ledger operations and historical redemption actions necessary to operate and audit the service; no advertising analytics SDK. |
| Other data | Adult confirmation (no birth date), consent records and reminder/quiet-hour preferences. |

The manifest uses Apple's `NSPrivacyCollectedDataType…` constants and `NSPrivacyCollectedDataTypePurposeAppFunctionality`. Tracking is false and the tracking-domain list is empty. Required-reason API declarations are aggregated by the existing React Native/Pods build; the app configuration does not invent new reasons. Inspect the generated manifest and archive privacy report again when SDKs change. [Apple manifest data types](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype), [Expo 55 configuration](https://docs.expo.dev/versions/v55.0.0/config/app/)

Data processed solely on-device is not declared as collected just because the app reads it. Current sleep and heart-rate display therefore does not itself add a collected Health category. Server-linked pseudonymous records are still declared linked; opaque identifiers are not assumed anonymous. Infrastructure metadata, IP retention and diagnostic logging must be reviewed against the actual production processors rather than inferred from local tests. [Apple App Privacy definitions](https://developer.apple.com/app-store/app-privacy-details/)

The app does not request ATT permission or send data to an ad provider in this release. No wallet address, seed phrase, private key, payment information, advertising ID or precise location is requested. HealthKit authorization and cloud-sync consent are separate; declining them leaves account/privacy/help access available. Deletion requests immediately disable further account earning; durable erasure/backup obligations still need operational completion as listed in `PRIVACY_DATA_MAP.md`.

Before submission, the operator must supply the real privacy/support URLs, approve retention and processor terms, finish account-deletion operations and confirm App Store Connect answers against the signed archive. Adding advertising, StoreKit, external benefits or a collection viewer requires a new data-flow and policy review; the first-release capability document cannot remotely enable those functions.
