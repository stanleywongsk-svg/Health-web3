# HealthLoop repository instructions

## Read first
Read `MEGA_PROMPT.md` as the implementation brief, then `docs/requirements.md` or `docs/requirements.json`. Inspect existing code and git status before edits. Preserve existing compatible architecture and unrelated work. These instructions do not override higher-priority workspace instructions.

## Approved scope amendment — 2026-10-05
The user has adopted the Hong Kong App Store recommendations in `docs/APP_STORE_RELEASE_RESEARCH.md` and requested implementation across the app. This supersedes the earlier same-day permission to add NFT/wallet activity bonuses to the native app. The first native release profile is health activity, noncash points and server-verified platform achievements. Optional advertising, StoreKit content and read-only collections require their own working, verified integration before inclusion; absent providers must not be represented by simulated purchases or ad success. Preserve the 58 requirement IDs and B/C assignments; record changed acceptance criteria and implementation evidence separately. This amendment takes precedence over conflicting product-scope text in `MEGA_PROMPT.md`, the register and older notes, but is not Apple approval or authority to spend, deploy, publish or broadcast transactions.

## Product boundaries
- Native iOS-first health habit app; Simplified Chinese UI; adult audience; task timezone Asia/Hong_Kong.
- Core rewards are nontransferable, noncash points. No future-token conversion promise or price speculation. Basic activity missions remain available without a wallet, NFT purchase or ad viewing.
- NFT ownership, wallet connection and chain balances must not unlock native features, change activity eligibility or increase native reward rates/caps. Rest carries no penalty. Platform badges are personal in-app achievements, not NFTs or merchant vouchers.
- Independent Web3 Lab uses only synthetic tasks and its own identities/database. Remote chain: Base Sepolia 84532 only. No mainnet or core-health-to-token path.
- A future optional collection viewer must remain separate from health records and reward evaluation; it must not become a purchase-to-unlock route or a bridge to the independent Lab. Never put health data, health-derived proofs or links to core health identities on-chain.
- No health data, health-derived targeting or wallet identifiers in sponsor events. Rewarded ad completion verification must use purpose-limited, single-use tokens without exposing core account IDs or reusable identifiers to ad services. An ad click alone does not qualify for a reward.
- Read existing health data; do not invent readings or write fake samples to HealthKit. Missing data does not mean zero or proven denial of read authorization.
- Synthetic/demo mode must be labeled and isolated. A mock test cannot prove real native integration.

## Implementation rules
Implement working vertical slices and tests, not only plans or static screens. Use compatible supported dependencies and a lockfile. Verify exact APIs against official documentation where available.

Server-authorized transactions control points and inventory. Never trust client amounts or completion flags. Require RLS, business-level uniqueness, concurrency-safe claims, immutable posted accounting with compensating entries, and tested deletion/consent behavior. No service-role secrets in client bundles.

Keep the first native release capability policy explicit and enforced by both API/SQL and clients. Existing base activity rules stay intact. New demonstration-voucher spending is excluded from the real release; retain historical reads, safe reconciliation and cancellation/refunds. Achievements must derive from canonical posted activity entitlement, respect reviewed corrections and account deletion, and never use optimistic local readings as awards.

For later monetization, use StoreKit for immediately usable digital content/services; do not sell NFT or wallet-based earning boosts. Optional rewarded-ad benefits must be closed-loop, personal and nontransferable, with no conversion to cash, cryptocurrency, gift cards or transferable items. Keep them separate from activity accounting and any future external-benefit catalog. Verify provider completion server-side with replay protection; an ad click or client flag is insufficient. Refusing tracking must not remove normal functionality or rewards. Test SDK data flows, provider proofs, refunds and native lifecycle before enabling an integration. No remote flag may silently enable excluded payment, advertising or chain features after review.

Do not upload real health data, production records or secrets into the coding session. Do not collect wallet private keys or seed phrases. No hidden tracking, fake success responses, suppressed failing checks or unauthorized scope expansion.

Local implementation and synthetic testing are permitted. External provisioning, spending, production changes, remote deployment, publishing and broadcasting transactions require explicit operator approval. Mainnet is outside this brief.

## Responsibility and evidence
Only B and C own the 58 technical requirements and review each other. A supplies business/product/legal coordination; D supplies research/design/QA support. Project letters do not automatically grant admin roles.

Use dependencies and acceptance criteria, not target dates or development-week schedules. Maintain `docs/IMPLEMENTATION_STATUS.md` and `docs/TEST_EVIDENCE.md`. Record actual commands, outcomes, unresolved issues and manual device/wallet checks. Never describe unrun tests, external approvals or audits as completed.

Before ending a session: summarize implemented IDs and paths, tests actually run, blockers and the next executable task. Leave a checkpoint that can be resumed. Do not imply work continues after the session automatically.
