# Privacy data map — draft for review

This is an implementation/design record, not a legal opinion or compliance approval. Initial region/timezone assumption is Hong Kong. The operator must approve processor agreements, retention and user notices before any real-user service.

| Data | Purpose | Storage / recipient | Retention and handling |
|---|---|---|---|
| Email and OTP/session | Authentication | Supabase Auth; native session in SecureStore | Provider OTP expiry/throttle; clear native session on logout; account purge must remove Auth identity |
| Adult confirmation | Adult-only service | Core profile/consent history | Boolean, no birth date; consent retention requires approval |
| Local read, cloud sync, marketing choices | Record separate permission decisions | Core consent events; account-scoped device Keychain records | Server-confirmed profile/version/time and local withdrawal overlay are stored separately. Editable drafts cannot grant offline access; a new connection must confirm cloud access. Disabling sync stops pending work immediately. |
| Raw step records and display source labels | Display and conservative source selection | In-memory device processing only | No persistent raw sample cache; no server upload, logging, sponsorship or on-chain use |
| Local source pin and revision counter | Keep account/day source continuity and monotonic submissions | Device Keychain, account/day scoped | Mapping contains source bundle/product category, source policy and a random server-facing token, plus a revision counter. Retained across logout for continuity; not raw readings. Only the opaque token/category/policy reaches the server. Cross-device/reinstall recovery and bounded metadata cleanup remain unimplemented. |
| Pending minimum sync operation | Resolve an uncertain response without duplicate effects | Process memory only | Exact permitted summary/revision, random claim key and stage; no raw records. Clears on consent withdrawal/account change/process exit. A network pause may retain it for explicit same-session retry. |
| Raw sleep intervals / latest heart-rate | Optional local display | Device only | No reward targeting; show units/time; no invented missing readings |
| Daily eligible steps/date/timezone/source category/policy, opaque source pin, revision journal and observation/receipt times | Server mission evaluation, retries and review | Core PostgreSQL under RLS | Proposed configurable 90-day summary retention; service-only pruning is implemented; scheduling and legal approval required before live service |
| Mission instance / point ledger | Canonical capped entitlement and audit | Core PostgreSQL under RLS | Integer nontransferable points; append-only financial-style history does not permit indefinite identifiable retention |
| Export | User access to their stored data | Authenticated response to device | No public link; transient handling; clear display/export state on account change |
| Deletion tombstone/job | Prevent old sessions from resuming claims and enable durable purge | Restricted core database | Keep minimum necessary suppression record; completion/backup replay must be verified |
| Sponsor aggregates (future) | Placement counts | Separate aggregate store | No email/user ID/source pin/wallet/health fields; do not join to core records |

Intended processors: Apple HealthKit (on-device platform), Supabase Auth/PostgreSQL/Edge Functions (local in current tests; hosted provider not provisioned), operator SMTP provider (not selected). No analytics, advertising, crash-reporting or LLM API receives health data in this slice. Package registries and build tooling receive dependency/build requests, not patient data.

Pending operational implementation: bounded summary/consent retention scheduling, erasure completion, backup expiry/deletion replay, approval of any narrowly justified ledger retention. The service must remain development-only until these obligations and evidence are addressed. Do not collect real records in automated test outputs or upload them to coding tools.
