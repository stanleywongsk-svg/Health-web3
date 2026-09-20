# Operations — development only

Migrations are forward-only once applied to a shared database. This initial migration has been exercised only in disposable local test databases. Never run the reset test runner against a production or shared project. The runner requires a loopback host, a `healthloop_test_` database name and explicit `HEALTHLOOP_ALLOW_DB_RESET=local-only`.

## Bootstrap and migrations

Use the pinned runtime, `pnpm install --frozen-lockfile`, then the local Supabase CLI workflow in README. `supabase db reset` is destructive to the selected local environment. Seed data must stay synthetic and the demo project label unmistakable. Hosted project creation/migration requires separate approval.

## Reward incident switch

An authorized operator with strengthened authentication uses the implemented pause RPC described in BACKEND_NOTES. It locks the same settings record used when claims post. Pause blocks new claims/redemptions and leaves ledger reads available. Capture actor/reason/audit evidence; never erase history to make a balance appear correct. Full admin console and second-person adjustment review remain open.

## Backups and recovery

Before live use, configure encrypted backups with documented retention, restricted access and restoration tests. Restore into an isolated environment with rewards paused and network access restricted. Apply deletion tombstones/jobs collected after the backup before admitting any user traffic. Verify deleted accounts cannot read/sync/claim with old JWTs; then reconcile ledger sums and inventory. A restore drill has not been executed in this checkpoint.

## Deletion and retention

Account deletion immediately changes account state under the claim lock; queued activity and old tokens must fail. A durable service worker removes unnecessary core data and the Supabase Auth user. Retry must be idempotent. Do not mark erasure complete just because the request was accepted. Review retained accounting identity and backup tombstones for linkability; severing a profile link is not a guarantee of anonymity.

The proposed summary retention is 90 days. Scheduling and verification of purge/backup expiration and separately justified consent/audit retention must be completed before live operation. No blanket permanent retention is authorized.

## Reconciliation and rollback

Balance is the sum of committed ledger points, not the mobile cache. Compare per-account totals, daily maxima (30) and weekly bonus maxima (20), and verify each debit/refund corresponds to a redemption. A failed transaction must roll back inventory and ledger together. Correct business errors through controlled compensating entries with reasons; do not update/delete ledger rows. Migration rollback should restore a separately verified backup or use reviewed forward correction migrations, never rewrite applied shared files.
