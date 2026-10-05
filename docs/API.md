# Core API contract

Base URL: `/functions/v1/core`. Requests use `Authorization: Bearer <Supabase access token>`. Identity comes from validated tokens, never request bodies. Browser mutations do not use ambient cookies. Responses are `{data, requestId}`; failures are `{error:{code,message},requestId}` with a matching `x-request-id` header. Error bodies do not echo health data or stack traces.

Implemented typed client: `packages/api-client/src/index.ts`. Shared strict input validation: `packages/domain/src/schema.ts`. PostgreSQL validates again because authenticated RPCs are callable directly. Extra upload fields, raw samples, requested award amounts and client identity fields are rejected.

| Method / route | Input / behavior |
|---|---|
| GET `/account/consents` | `{profile:null}` before onboarding; otherwise own profile choices. Inactive accounts rejected. |
| POST `/account/consents` | `{adultConfirmed:true,localRead:boolean,cloudSync:boolean,marketing:boolean,version:'2026-09-18'}`; records immutable decision event. Permission-only reductions remain available when the normal consent rate budget is exhausted; any simultaneous permission grant remains limited. |
| GET `/account/notification-preferences` | Own active onboarded account; default disabled, `19:00` reminder, `22:00`–`08:00` quiet hours, `Asia/Hong_Kong`, revision 0 and null updatedAt until saved. Independent of health/cloud/marketing consent. |
| POST `/account/notification-preferences` | `{enabled,reminderTime,quietStart,quietEnd,timezone:'Asia/Hong_Kong',expectedRevision}`. Exact 24-hour `HH:mm`; strict optimistic concurrency; server returns confirmed settings plus revision/updatedAt. No account selector, arbitrary content, health input or push token. |
| POST `/activity/sync` | `{taskDate,eligibleSteps,sourceCategory,sourcePolicy,sourcePinToken,revision,observedAt,timezone}`. Source is `apple_phone` or `apple_watch`; policy is `single-approved-source-v1`; timezone `Asia/Hong_Kong`. Date ISO calendar string, steps integer0..100000, revision positive integer, token UUID. Only current/prior eligible day; server deadline authoritative. Returns accepted or pending review, never points chosen by client. |
| GET `/health/summary` | Seven days of permitted minimum stored summaries; no raw health samples. |
| GET `/missions` | No query parameters. Server time/task date and own daily/weekly instances with pinned rules, posted points, accepted qualifying dates and pending-review status. |
| POST `/missions/:instanceId/claim` | `{idempotencyKey:UUID}`. Claims daily entitlement and any dependent weekly bonus atomically; a weekly instance can also be claimed directly. Returns delta and canonical balance. A changed key does not bypass daily business uniqueness. An implicit weekly bonus must meet its own pinned deadline even when the daily task has a later cutoff. |
| GET `/points/summary` | Signed `balance` and `correctionPoints`, nonnegative `availablePoints`, gross earned/spent/refunded totals and pending evaluation count. |
| GET `/points/ledger?limit=20&cursor=…` | Cursor is positive ledger ID string; limit1..100. Returns items and nextCursor. |
| GET `/rewards` | Clearly marked demonstration catalog. |
| POST `/redemptions` | Reward ID and idempotency key; inventory reservation and debit occur in one transaction. |
| GET `/redemptions` | Own bounded redemption listing; `limit` 1..100 and optional positive bigint-string cursor. |
| POST `/redemptions/:id/cancel` | `{}`; own active-account cancellation/refund, exactly once, including after cloud-consent withdrawal. |
| POST `/appeals` | `{taskDate,reason}`; trimmed reason1..1000 characters. Stores request, does not fabricate approval. |
| GET `/appeals` | Own cursor-paginated appeals and proposal/decision reasons/status; no reviewer identities. |
| GET `/admin/reviews` | Server-assigned operator/reviewer and signed `aal2` required. Paginated open appeals with existing canonical summary and pending minimum revisions. |
| POST `/admin/adjustments` | Operator + `aal2`; `{appealId,revision,reason,idempotencyKey}`. Selects an existing reviewable revision. |
| POST `/admin/adjustments/:id/decision` | Distinct reviewer + `aal2`; `{decision:"approve"\|"reject",reason,idempotencyKey}`. Server computes all daily/weekly deltas. |
| POST `/account/export` | Own persisted core records, including submitted revision history and excluding unnecessary internal identities. No public export URL. |
| DELETE `/account` | Recent email OTP reauthentication required. Immediately blocks sync/claims; returns durable job ID. This response means requested, not erasure completed. |

See `supabase/functions/core/index.ts` and `docs/BACKEND_NOTES.md` for final routing, cancellation/admin operations and server-only deletion processing. The dual-review API is implemented; a browser administration console and live MFA enrollment remain unfinished.

Important codes include `UNAUTHENTICATED`, `FORBIDDEN`, `ONBOARDING_REQUIRED`, `ACCOUNT_INACTIVE`, `CONSENT_REQUIRED`, `INVALID_INPUT`, `NOT_FOUND`, `REVISION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `SOURCE_REJECTED`, `SOURCE_PINNED`, `CUTOFF_PASSED`, `REWARDS_PAUSED`, `RATE_LIMITED`, `REAUTHENTICATION_REQUIRED`, `INSUFFICIENT_POINTS` and `OUT_OF_STOCK`. The typed client additionally distinguishes `NETWORK_ERROR`, `TIMEOUT`, `CANCELLED`, `SESSION_UNAVAILABLE` and `INVALID_RESPONSE`. Retrying ambiguous writes must reuse the appropriate business operation; the client never assumes failure means no transaction committed.

Requests have a 15-second deadline covering secure-session lookup, transport and response decoding. Cancellation interrupts the caller even if a transport ignores its abort signal. Session-storage failure is distinct from a network outage and must not enable offline access. The transport does not retry writes automatically. `getHealthSummary()` returns accepted summary revisions for restart reconciliation; pending proposals remain in the revision journal and are not represented as accepted summaries.

The API transport is not evidence of actual email delivery, native permissions or an external Supabase deployment. Those remain explicit integration/device checks.

## Optional local reminders

Quiet hours are `[quietStart, quietEnd)` with midnight wrap; equal endpoints are rejected. An enabled reminder must fall outside that interval. Disabled preferences may retain an otherwise quiet-hour reminder time. `expectedRevision` is a nonnegative 32-bit integer. A stale changed state returns `PREFERENCES_CONFLICT` (409); reload and confirm before changing again. A retry of the identical current state with an old or current revision returns its canonical state without another revision or rate charge. A future revision always conflicts. A pure disable bypasses an exhausted preference rate budget but still requires a valid current revision for changed state.

`hl_notification_preferences()` and `hl_set_notification_preferences(...)` derive identity from Auth and serialize updates under the profile lock. RLS denies cross-user reads and direct writes. Account export includes `notificationPreferences`; purge removes the preference row and old sessions cannot recreate it. No health consent or task claim runs as part of this API.

The mobile controller stores only an account-scoped stop marker. It never treats an unsaved enable draft as permission to schedule. Explicit save requests OS permission when undecided, confirms the server write, then installs one generic local calendar reminder. Cancellation/reload/account generation guards prevent late operations from restoring an old schedule. Notification API/native failures stay scoped to reminders; real session/authorization failures still invalidate core access. No remote push registration or background remote cancellation exists. A server change on another device is applied here on the next foreground/reconnect; an OS delivery already in progress cannot be recalled with certainty.

## Reviewed corrections and balances

Both review reasons are trimmed to 10..1000 characters. IDs/keys are UUIDs; revision is a positive 32-bit integer. No arbitrary points, replacement step count or subject ID is accepted in either write. The server resolves the subject/day through the appeal. The subject must remain active, adult-confirmed and cloud-consenting; either review actor is forbidden from reviewing their own health records. Only a different server-assigned reviewer may decide an operator's proposal.

A proposal snapshots the retained week's accepted summaries and mission state. A newer revision or changed state makes approval fail with `STALE_PROPOSAL` (409); rejection remains possible. An approval can review retained submissions after the ordinary claim deadline, but cannot accept a newly submitted late summary or reopen expired normal claims. All approvals stop during the reward incident pause. Rejection/proposal/history remain available subject to account/consent/role checks. Only retained complete-week evidence may be used.

An approved revision updates the canonical summary and inserts signed `daily_correction`/`weekly_correction` ledger deltas in one transaction, resolving that appeal and its superseded pending risk flags. Original submission receipts and posted entries remain unchanged. `adjustmentId` identifies the proposal; `relatedEntryId` references the previous entry for the instance when one exists (null for the first posting). Original award/refund rows have null correction links. A posting epoch allows a later legitimate re-award after reversal without reusing an old ledger business key or paying twice.

`balance = earnedPoints - spentPoints + reversedPoints + correctionPoints`; `availablePoints = max(balance, 0)`. Earned points are gross ordinary awards, reversed points are redemption refunds, and correction points are the signed sum of approved corrections. Spent points stay spent after correction; negative balances are shown and block new redemption. Never reconcile a partial ledger page to the whole account balance.

Proposal responses contain `{id,appealId,revision,status:"pending",createdAt}`. Decision responses contain `{id,appealId,status,decision,addedPoints,dailyDelta,weeklyDelta,balance,availablePoints,decidedAt}`. Reusing the same actor/key and body returns its original receipt; changed reuse conflicts. Refresh canonical reads afterward because receipt balances/status can be historical. `SELF_REVIEW` is 403; `APPEAL_CLOSED`, `SUBMISSION_NOT_REVIEWABLE`, `STALE_PROPOSAL` and `PROPOSAL_DECIDED` are 409. Strict client/Edge schemas validate the new responses and accounting equalities.

New redemptions require cloud consent. An active account can replay its previously committed redemption key after withdrawal to reconcile a lost response; this path never reserves new stock or posts a new debit. If the original write never committed, replay after withdrawal fails with `CONSENT_REQUIRED`. Cancellation remains available to refund an existing record. The mobile controller persists only account-scoped reward/operation UUIDs, not codes or health records; uncertain writes reuse the same key and refresh server state before completion.


Explicit demo-mode Edge builds return `404 NOT_SUPPORTED` for the three new administrative review/proposal/decision routes after authentication and before RPC. Own-user appeal history is still available. Real correction integration tests use synthetic values under native-category test fixtures; the real mobile schema never accepts demo health sources.

## X to Earn mission progress (2026-10-05)

`GET /missions` returns `{serverNow,taskDate,timezone:"Asia/Hong_Kong",items}`. Each item includes the existing ID/kind/periodStart/ruleVersion/selectedGoal/awardedPoints/eligibleSteps/cutoffAt/tiers/weeklyDaysRequired/weeklyBonusPoints and adds `qualifyingDates:string[]` and `pendingReview:boolean`. Daily instances have an empty qualifying-date array; weekly instances have `eligibleSteps:null`. An absent accepted daily summary stays null, while a received zero stays zero. Weekly dates are distinct accepted summaries meeting that week's pinned goal, using the same join/predicate as claims. Reading this snapshot does not post points.

A pending correction is a separate fact: the existing accepted summary/awards remain visible until an authorized reconciliation changes them. Neither new risk flags nor local estimates become qualifying dates. Progress reads remain available after optional cloud-sync withdrawal, but inactive/deleted or anonymous identities are rejected. Responses expose no raw samples, source identifiers, wallet or other-user data. The strict shared decoder rejects excess fields, invalid dates/tiers, duplicate instances/dates and out-of-week qualification.

The current app uses this snapshot for progress and rules. The local date only selects a screen; a mismatch requires refresh and cannot reopen a server cutoff. Unsubmitted local totals provide a clearly labeled nonspendable preview. Direct claims of already accepted summaries send only the mission ID and idempotency key; the server still computes eligibility and amounts. An ambiguous response retains its original key, and a failed canonical refresh does not repost a known successful claim. After process termination a new key is still protected by the existing business-level award uniqueness.

Migration order: apply `202610050001_mission_progress.sql` before serving the updated Edge/client. Older clients ignore the added properties. Updated clients fail closed against older incomplete responses; no zero-progress compatibility fallback is provided.
# iOS first-release additions — 2026-10-05

Apply `202610050002_store_release.sql` before serving the updated API. `GET /app/capabilities` returns the fixed `ios-hk-health-points-v1` / `HK` contract: health activity, points and platform badges enabled; wallets, NFT purchases, crypto rewards, ads, IAP and demo redemptions disabled. It authenticates and checks an active onboarded account. A demo HTTP handler returns `NOT_SUPPORTED` instead of claiming compatibility. This endpoint is a build contract, not a remotely editable feature flag.

`GET /badges` returns exactly `first_steps` and `consistent_week` with `earned`, nullable `earnedOn`, and `evaluatedAt`. The server reads canonical posted mission awards (daily >=10, weekly >=20), so uploads alone cannot award a badge and approved compensation can retract one. `earnedOn` is the earliest qualifying task period: the weekly value is its Monday, not the claim timestamp. Reading badges neither uploads health data, posts points nor spends balance. Own history remains readable without cloud consent; inactive/deleted accounts cannot read it.

Real-mode `GET /rewards` now returns an empty catalogue. `POST /redemptions` invokes reconciliation only: an existing caller-owned idempotency key returns its original receipt, a mismatched reward returns `IDEMPOTENCY_CONFLICT`, and an uncommitted key returns `NOT_SUPPORTED` without a debit. Existing list/cancel/refund routes remain active. Direct SQL new spending is also blocked unless privileged private settings identify an explicitly local demo fixture; a client cannot enable it. The older demo-contract documentation below describes retained isolated tests/history, not the shipping storefront.
