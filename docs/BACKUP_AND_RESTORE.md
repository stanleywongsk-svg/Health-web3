# Backup and restore checkpoint

**Public source backup verified:** [https://github.com/stanleywongsk-svg/Health-web3](https://github.com/stanleywongsk-svg/Health-web3), initial complete snapshot [`38c0425`](https://github.com/stanleywongsk-svg/Health-web3/commit/38c0425e01a440727f702d356ad507d8f36cbccb). The operator explicitly approved public upload. A fresh GitHub clone matched all 138 intended paths and blob IDs; 136 source-file SHA-256 values and the downloaded history bundle matched. The downloaded bundle passed Git integrity checks and restored all seven saved branch refs. See [GITHUB_BACKUP.md](GITHUB_BACKUP.md) for the verification record and local cleanup outcome.

The GitHub snapshot preserves the current source and handoff documents. The archived bundle preserves the original local branch histories; the GitHub commit graph differs because the authenticated connector uploaded a snapshot. These checks prove source preservation, not native compilation, real Auth/OTP, device acceptance or the P27 database restore drill.

## What is preserved

- Current source, lockfiles, migrations, automated tests, requirement register, implementation status and test evidence.
- `UNFINISHED_REPORT.md` and `CONTINUE_PROMPT.md` for continuation from a fresh clone.
- `../HealthLoop_Codex_Kit/` including the original DOCX and XLSX; `DEVELOPMENT_KIT.md` records its provenance.
- `source-materials/HealthLoop_Codex_Mega_Prompt.txt`: original attached prompt, preserved byte for byte. The root `MEGA_PROMPT.md` and requirement register remain the active implementation brief.
- `archive/environment-evidence/`: historical native dependency resolution and actual environment/build/test outputs. They do not establish device success.
- `archive/unreferenced-git-blobs/`: four orphaned local draft blobs preserved by their original object IDs; these are not active code.
- `archive/healthloop-history.bundle`: all local branch histories through the checkpoint named in `archive/backup-manifest.json`. The manifest also records source-file SHA-256 values and Git object IDs. The bundle precedes the later commit that adds the bundle/manifest, avoiding recursive self-inclusion.

Installed dependencies, generated iOS/Android projects, derived build output, disposable synthetic PostgreSQL data, caches and local environment files are rebuildable artifacts and are excluded from the source backup. Shared developer tools and other projects are outside cleanup scope. This source backup is not the P27 production-database restore/deletion-replay drill.

## Normal recovery

Clone the public repository to a path without spaces, such as `~/Projects/healthloop`. Use Node24.19.0 and pnpm11.19.0, then run `pnpm install --frozen-lockfile` and follow the root README. Read `CONTINUE_PROMPT.md` before resuming implementation. Recreate environment files from the examples; do not paste secrets into chat or commit them. Recreate disposable databases using `BACKEND_NOTES.md` / `DEVICE_SETUP.md`; old `/tmp` paths are historical, not dependencies.

To verify and restore the preserved pre-upload Git history from a fresh clone:

```sh
git bundle verify docs/archive/healthloop-history.bundle
git clone -b main docs/archive/healthloop-history.bundle ../healthloop-history
```

The restored repository includes the saved implementation branches as remote-tracking branches; list them with `git branch -a`. The current GitHub snapshot remains the place to retrieve later backup documentation or subsequent changes.

## Upload and cleanup gate

1. Use the operator-approved public repository `stanleywongsk-svg/Health-web3`. Public upload was explicitly authorized; no other deployment, spending or chain broadcast was authorized. Inspect existing contents before adding files; preserve unrelated work.
2. Transfer every current tracked file, including the manifest, original documents and history bundle. Prefer a normal Git push if an authenticated CLI is available; otherwise Git database APIs can create a complete snapshot while the bundle preserves original history.
3. Include `[skip ci]` in this archival upload's commit message so the existing push/pull-request workflow does not start a possibly billable run. This does not mark CI as passed. GitHub documents this behavior at https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs . Future CI execution needs available quota or cost approval.
4. Verify the remote branch/commit tree matches all uploaded paths and blob object IDs. Fetch the remote history bundle and verify its SHA-256 and Git integrity. Retain the immutable commit URL as evidence.
5. Only after those checks succeed, remove the six project worktrees, project-specific temporary builds/logs, stopped disposable PostgreSQL cluster, archived original attachment and the main local project directory. Do not follow symlinks or remove shared caches/tools, unrelated processes or other projects.
6. Record the actual remote URL, verification result and cleanup outcome in the final handoff. Until then, keep local files. File removal frees disk space; only stopping project processes frees their RAM.
