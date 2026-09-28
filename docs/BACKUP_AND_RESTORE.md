# Backup and restore checkpoint

**Current instruction — 2026-09-28:** the operator has authorized uploading the current source, relevant evidence and two Simplified Chinese proposals to the existing public repository. Keep the local checkout, dependencies, worktrees and newer commits after upload. The earlier project-deletion instruction is superseded; this document does not authorize another cleanup. Consult [GITHUB_BACKUP.md](GITHUB_BACKUP.md) for the latest completed upload verification, rather than treating a prepared local file as already uploaded.

**Public source backup verified:** [https://github.com/stanleywongsk-svg/Health-web3](https://github.com/stanleywongsk-svg/Health-web3), initial complete snapshot [`38c0425`](https://github.com/stanleywongsk-svg/Health-web3/commit/38c0425e01a440727f702d356ad507d8f36cbccb). The operator explicitly approved public upload. A fresh GitHub clone matched all 138 intended paths and blob IDs; 136 source-file SHA-256 values and the downloaded history bundle matched. The downloaded bundle passed Git integrity checks and restored all seven saved branch refs. See [GITHUB_BACKUP.md](GITHUB_BACKUP.md) for the verification record and local cleanup outcome.

That historical GitHub snapshot preserves source and handoff documents at its recorded checkpoint. The archived bundle preserves the original local branch histories; the GitHub commit graph differs because the authenticated connector uploaded a snapshot. Later local work is covered only once a subsequent upload is verified. These checks prove source preservation, not native compilation, real Auth/OTP, device acceptance or the P27 database restore drill.

## What is preserved

- Current source, lockfiles, migrations, automated tests, requirement register, implementation status and test evidence.
- `UNFINISHED_REPORT.md` and `CONTINUE_PROMPT.md` for continuation from a fresh clone.
- `../HealthLoop_Codex_Kit/` including the original DOCX and XLSX; `DEVELOPMENT_KIT.md` records its provenance.
- `source-materials/HealthLoop_Codex_Mega_Prompt.txt`: original attached prompt, preserved byte for byte. The root `MEGA_PROMPT.md` and requirement register remain the active implementation brief.
- `archive/environment-evidence/`: historical native dependency resolution and actual environment/build/test outputs. They do not establish device success.
- `archive/unreferenced-git-blobs/`: four orphaned local draft blobs preserved by their original object IDs; these are not active code.
- `archive/healthloop-history.bundle`: all local branch histories through the checkpoint named in `archive/backup-manifest.json`. The manifest also records source-file SHA-256 values and Git object IDs. The bundle precedes the later commit that adds the bundle/manifest, avoiding recursive self-inclusion.
- `archive/healthloop-continuation-20260928.bundle`: continuation history through `403c073`, including 11 local branch tips and 23 recorded refs; `continuation-manifest-20260928.json` records its exact hashes. It deliberately precedes proposal/publication packaging; current proposal and handoff files are preserved directly in the delivered repository. Keep the original bundle as well.
- `proposals/`: the two new Word proposals and editable Markdown sources are prepared for the current upload; they do not amend the implementation brief or authorize live cryptocurrency operations.
- `evidence/recordings/`: the processed simulator MP4, its README and metadata. Its OTP area is obscured; the raw recording, screenshots, capture state and local logs are excluded. The actual UI test scope is recorded in [SIMULATOR_WALKTHROUGH_20260928.md](SIMULATOR_WALKTHROUGH_20260928.md).

Installed dependencies, generated iOS/Android projects, derived build output, disposable synthetic PostgreSQL data, caches and local environment files are rebuildable artifacts and are excluded from the source backup. Shared developer tools and other projects are outside cleanup scope. This source backup is not the P27 production-database restore/deletion-replay drill.

## Normal recovery

Clone the public repository to a path without spaces, such as `~/Projects/healthloop`. Use Node24.19.0 and pnpm11.19.0, then run `pnpm install --frozen-lockfile` and follow the root README. Read `CONTINUE_PROMPT.md` before resuming implementation. Recreate environment files from the examples; do not paste secrets into chat or commit them. Recreate disposable databases using `BACKEND_NOTES.md` / `DEVICE_SETUP.md`; old `/tmp` paths are historical, not dependencies.

To verify and restore the preserved pre-upload Git history from a fresh clone:

```sh
git bundle verify docs/archive/healthloop-history.bundle
git clone -b main docs/archive/healthloop-history.bundle ../healthloop-history
```

The restored repository includes the saved implementation branches as remote-tracking branches; list them with `git branch -a`. The current GitHub snapshot remains the place to retrieve later backup documentation or subsequent changes.

To inspect the newer implementation history in a separate directory without replacing current files:

```sh
git bundle verify docs/archive/healthloop-continuation-20260928.bundle
git clone -b codex/resume-core docs/archive/healthloop-continuation-20260928.bundle ../healthloop-continuation-history
```

The restored branch stops at the pre-publication source checkpoint; use the normal GitHub checkout for the latest Word proposals and delivery documentation. A connector snapshot has a different commit graph from the original local work. Do not force-push one over the other.

## Upload verification and local retention

1. Use the operator-approved public repository `stanleywongsk-svg/Health-web3`. Public upload was explicitly authorized; no other deployment, spending or chain broadcast was authorized. Inspect existing contents before adding files; preserve unrelated work.
2. Transfer every current tracked file, including the manifest, original documents, reviewed proposals and processed evidence. Prefer a normal non-force Git push if an authenticated CLI is available; otherwise Git database APIs can create a complete snapshot based on the latest remote commit. Preserve any newer remote changes. Keep the original history bundle unchanged and add a separately named continuation bundle when the snapshot upload must also preserve later local history.
3. Include `[skip ci]` in this archival upload's commit message so the existing push/pull-request workflow does not start a possibly billable run. This does not mark CI as passed. GitHub documents this behavior at https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs . Future CI execution needs available quota or cost approval.
4. Verify the remote branch/commit tree matches all uploaded paths and blob object IDs. Fetch the remote history bundle and verify its SHA-256 and Git integrity. Retain the immutable commit URL as evidence.
5. Keep local files after verification. Upload completion is not deletion permission. Any future cleanup must follow a new explicit instruction, with its own exact scope; do not remove shared tools, caches, unrelated processes or other projects.
6. Record the actual remote URL, immutable commit, verified paths/hashes and any remaining exclusions in the final handoff and GITHUB_BACKUP. Do not describe a pending upload as complete or a skipped CI run as passed.
