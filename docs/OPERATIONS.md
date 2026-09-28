# Operations — development only

Migrations are forward-only once applied to a shared database. The core and forward correction migrations have been exercised only in disposable local test databases. Never run the reset test runner against a production or shared project. The runner requires a loopback host, a `healthloop_test_` database name and explicit `HEALTHLOOP_ALLOW_DB_RESET=local-only`.

## Bootstrap and migrations

Use the pinned runtime, `pnpm install --frozen-lockfile`, then the local Supabase CLI workflow in README. `supabase db reset` is destructive to the selected local environment. Seed data must stay synthetic and the demo project label unmistakable. Hosted project creation/migration requires separate approval.

## Reward incident switch

An authorized operator with strengthened authentication uses the implemented pause RPC described in BACKEND_NOTES. It locks the same settings record used when claims post. Pause blocks new claims/redemptions and all adjustment approvals; it leaves ledger reads, cancellation refunds, proposals and rejections available subject to their normal permissions. Capture actor/reason/audit evidence; never erase history to make a balance appear correct. Second-person adjustment RPCs are implemented; the browser admin console and live MFA enrollment remain open.

## Backups and recovery

Before live use, configure encrypted backups with documented retention, restricted access and restoration tests. Restore into an isolated environment with rewards paused and network access restricted. Apply deletion tombstones/jobs collected after the backup before admitting any user traffic. Verify deleted accounts cannot read/sync/claim with old JWTs; then reconcile ledger sums and inventory. A restore drill has not been executed in this checkpoint.

## Deletion and retention

Account deletion immediately changes account state under the claim lock; queued activity and old tokens must fail. A durable service worker removes unnecessary core data and the Supabase Auth user. Retry must be idempotent. Do not mark erasure complete just because the request was accepted. Review retained accounting identity and backup tombstones for linkability; severing a profile link is not a guarantee of anonymity.

The proposed summary retention is 90 days. Scheduling and verification of purge/backup expiration and separately justified consent/audit retention must be completed before live operation. No blanket permanent retention is authorized.

## Reconciliation and rollback

Balance is the sum of committed ledger points, not the mobile cache. Compare per-account totals, daily maxima (30) and weekly bonus maxima (20), and verify each debit/refund corresponds to a redemption. A failed transaction must roll back inventory and ledger together. Correct business errors through controlled compensating entries with reasons; do not update/delete ledger rows. Migration rollback should restore a separately verified backup or use reviewed forward correction migrations, never rewrite applied shared files.

## Two-person correction procedure

An authorized operator authenticates with MFA and fetches `/admin/reviews`. Review only the stored pending revision and the complete retained affected week. Submit an existing appeal/revision and a meaningful reason to `/admin/adjustments`; never provide an amount or alter SQL ledger rows. Record the idempotency key for uncertain retries. A different authorized reviewer with MFA inspects the same source and sends approve/reject plus their own reason/key to `/admin/adjustments/:id/decision`. Do not use a service key in a browser or manufacture `aal2` outside disposable tests.

If state changed, `STALE_PROPOSAL` leaves the proposal pending; reject it and re-review current evidence. A fresh proposal must reference the latest still-reviewable submission. Missing/pruned evidence is a blocker, not permission to reconstruct invented steps. A withdrawn/deleting subject cannot be newly reviewed. All approvals honor the incident pause; rejection leaves the original appeal open. Approval resolves its selected appeal and pending flags up to the accepted revision; separate appeals remain separately tracked.

After a decision, read canonical summary, missions, signed balance and ledger. Do not display the old idempotent receipt's balance as current. Check each correction's adjustment reference, previous entry where present and signed daily/weekly total. Negative balances after prior spending are valid; available spending is zero until the real balance recovers. Never erase earlier awards, advance epochs manually or bypass unique business keys to make reconciliation pass.

Apply deletion/retention to the private review table before appeals; the implemented purge does this. Retained immutable audit/ledger links require restricted access and an approved retention basis. Exercise these paths in the pending isolated backup/restore drill before any live use.
