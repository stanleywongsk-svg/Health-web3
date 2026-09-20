# Core API contract

Base URL: `/functions/v1/core`. Requests use `Authorization: Bearer <Supabase access token>`. Identity comes from validated tokens, never request bodies. Browser mutations do not use ambient cookies. Responses are `{data, requestId}`; failures are `{error:{code,message},requestId}` with a matching `x-request-id` header. Error bodies do not echo health data or stack traces.

Implemented typed client: `packages/api-client/src/index.ts`. Shared strict input validation: `packages/domain/src/schema.ts`. PostgreSQL validates again because authenticated RPCs are callable directly. Extra upload fields, raw samples, requested award amounts and client identity fields are rejected.

| Method / route | Input / behavior |
|---|---|
| GET `/account/consents` | `{profile:null}` before onboarding; otherwise own profile choices. Inactive accounts rejected. |
| POST `/account/consents` | `{adultConfirmed:true,localRead:boolean,cloudSync:boolean,marketing:boolean,version:'2026-09-18'}`; records immutable decision event. Permission-only reductions remain available when the normal consent rate budget is exhausted; any simultaneous permission grant remains limited. |
| POST `/activity/sync` | `{taskDate,eligibleSteps,sourceCategory,sourcePolicy,sourcePinToken,revision,observedAt,timezone}`. Source is `apple_phone` or `apple_watch`; policy is `single-approved-source-v1`; timezone `Asia/Hong_Kong`. Date ISO calendar string, steps integer0..100000, revision positive integer, token UUID. Only current/prior eligible day; server deadline authoritative. Returns accepted or pending review, never points chosen by client. |
| GET `/health/summary` | Seven days of permitted minimum stored summaries; no raw health samples. |
| GET `/missions` | Daily/weekly instances, pinned rule version/goal, cutoff, tiers, awarded points and known eligible steps. |
| POST `/missions/:instanceId/claim` | `{idempotencyKey:UUID}`. Claims daily entitlement and any dependent weekly bonus atomically; a weekly instance can also be claimed directly. Returns delta and canonical balance. A changed key does not bypass daily business uniqueness. An implicit weekly bonus must meet its own pinned deadline even when the daily task has a later cutoff. |
| GET `/points/summary` | Available, earned, spent, refunded and pending evaluation counts. |
| GET `/points/ledger?limit=20&cursor=…` | Cursor is positive ledger ID string; limit1..100. Returns items and nextCursor. |
| GET `/rewards` | Clearly marked demonstration catalog. |
| POST `/redemptions` | Reward ID and idempotency key; inventory reservation and debit occur in one transaction. |
| GET `/redemptions` | Own bounded redemption listing. |
| POST `/appeals` | `{taskDate,reason}`; trimmed reason1..1000 characters. Stores request, does not fabricate approval. |
| POST `/account/export` | Own persisted core records, including submitted revision history and excluding unnecessary internal identities. No public export URL. |
| DELETE `/account` | Recent email OTP reauthentication required. Immediately blocks sync/claims; returns durable job ID. This response means requested, not erasure completed. |

See `supabase/functions/core/index.ts` and `docs/BACKEND_NOTES.md` for final routing, cancellation/admin operations and server-only deletion processing. Missing admin review workflows are not represented as completed operations.

Important codes include `UNAUTHENTICATED`, `FORBIDDEN`, `ONBOARDING_REQUIRED`, `ACCOUNT_INACTIVE`, `CONSENT_REQUIRED`, `INVALID_INPUT`, `NOT_FOUND`, `REVISION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `SOURCE_REJECTED`, `SOURCE_PINNED`, `CUTOFF_PASSED`, `REWARDS_PAUSED`, `RATE_LIMITED`, `REAUTHENTICATION_REQUIRED`, `INSUFFICIENT_POINTS` and `OUT_OF_STOCK`. The typed client additionally distinguishes `NETWORK_ERROR`, `TIMEOUT`, `CANCELLED`, `SESSION_UNAVAILABLE` and `INVALID_RESPONSE`. Retrying ambiguous writes must reuse the appropriate business operation; the client never assumes failure means no transaction committed.

Requests have a 15-second deadline covering secure-session lookup, transport and response decoding. Cancellation interrupts the caller even if a transport ignores its abort signal. Session-storage failure is distinct from a network outage and must not enable offline access. The transport does not retry writes automatically. `getHealthSummary()` returns accepted summary revisions for restart reconciliation; pending proposals remain in the revision journal and are not represented as accepted summaries.

The API transport is not evidence of actual email delivery, native permissions or an external Supabase deployment. Those remain explicit integration/device checks.
