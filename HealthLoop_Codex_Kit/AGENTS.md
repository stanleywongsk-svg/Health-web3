# HealthLoop repository instructions

## Read first
Read `MEGA_PROMPT.md` as the implementation brief, then `docs/requirements.md` or `docs/requirements.json`. Inspect existing code and git status before edits. Preserve existing compatible architecture and unrelated work. These instructions do not override higher-priority workspace instructions.

## Product boundaries
- Native iOS-first health habit app; Simplified Chinese UI; adult audience; task timezone Asia/Hong_Kong.
- Core rewards are nontransferable, noncash points. No future-token conversion promise, price speculation or wallet requirement.
- Independent Web3 Lab uses only synthetic tasks and its own identities/database. Remote chain: Base Sepolia 84532 only. No mainnet or core-health-to-token path.
- No health data, health-derived targeting or wallet identifiers in sponsor events. No rewards for ad interactions.
- Read existing health data; do not invent readings or write fake samples to HealthKit. Missing data does not mean zero or proven denial of read authorization.
- Synthetic/demo mode must be labeled and isolated. A mock test cannot prove real native integration.

## Implementation rules
Implement working vertical slices and tests, not only plans or static screens. Use compatible supported dependencies and a lockfile. Verify exact APIs against official documentation where available.

Server-authorized transactions control points and inventory. Never trust client amounts or completion flags. Require RLS, business-level uniqueness, concurrency-safe claims, immutable posted accounting with compensating entries, and tested deletion/consent behavior. No service-role secrets in client bundles.

Do not upload real health data, production records or secrets into the coding session. Do not collect wallet private keys or seed phrases. No hidden tracking, fake success responses, suppressed failing checks or unauthorized scope expansion.

Local implementation and synthetic testing are permitted. External provisioning, spending, production changes, remote deployment, publishing and broadcasting transactions require explicit operator approval. Mainnet is outside this brief.

## Responsibility and evidence
Only B and C own the 58 technical requirements and review each other. A supplies business/product/legal coordination; D supplies research/design/QA support. Project letters do not automatically grant admin roles.

Use dependencies and acceptance criteria, not target dates or development-week schedules. Maintain `docs/IMPLEMENTATION_STATUS.md` and `docs/TEST_EVIDENCE.md`. Record actual commands, outcomes, unresolved issues and manual device/wallet checks. Never describe unrun tests, external approvals or audits as completed.

Before ending a session: summarize implemented IDs and paths, tests actually run, blockers and the next executable task. Leave a checkpoint that can be resumed. Do not imply work continues after the session automatically.
