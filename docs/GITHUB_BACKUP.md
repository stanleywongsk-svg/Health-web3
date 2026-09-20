# Verified GitHub backup

- Public repository: [https://github.com/stanleywongsk-svg/Health-web3](https://github.com/stanleywongsk-svg/Health-web3); public publication was explicitly authorized by the operator.
- Initial complete source snapshot: [`38c0425e01a440727f702d356ad507d8f36cbccb`](https://github.com/stanleywongsk-svg/Health-web3/commit/38c0425e01a440727f702d356ad507d8f36cbccb).
- Local source checkpoint: `7ee8f5e29a1d1bc2eca61d40dde84913a7cddb59`.
- Identical initial Git tree: `4dc233e418125aadbef639b2196581a8e40f1507`.
- Coverage: all 138 original tracked files, including original DOCX/XLSX, attached prompt, source, lockfiles, tests, migrations, reports, historical evidence and history bundle. Later commits update handoff documentation.
- Verified by a fresh public clone: Git integrity, all 136 manifest source-file hashes, bundle SHA-256, independent bundle restore and all seven saved branch refs.
- Bundle SHA-256: `fd0d102e9774fea135231e5a0718cf2bd5a9f2a3a548f669a65bd6b1fb41e008`.
- GitHub Actions observed runs: 0 after initial archive upload; `[skip ci]` was used. No remote CI pass claimed.

## Local cleanup

Completed after remote verification. A second GitHub checkout at commit `86e7f18d1bb87ba4a7476dbb5dd3440cdbe0fee4` matched all 139 current local files byte for byte, with matching tree `59603e9ae85e9f7e5e8401cd2be8443c305068ba`, before deletion.

Removed the main HealthLoop local directory, six archived worktrees, three project-only temporary build/database/extraction directories, 17 inventoried temporary files and the byte-verified archived original attachment. All 28 inventoried paths were checked absent. The removed directories accounted for approximately 821 MiB by pre-cleanup disk usage; actual free-space change may differ because of shared filesystem blocks. Shared developer tools/caches, unrelated projects and app/tool processes were preserved. No dedicated HealthLoop service was running; the disposable PostgreSQL cluster was already stopped. This operation removes disk files and does not claim a measured RAM reduction.

## Continue work

Read [UNFINISHED_REPORT.md](UNFINISHED_REPORT.md) and use [CONTINUE_PROMPT.md](CONTINUE_PROMPT.md) in a fresh clone. [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md) explains recovery of the original branch histories. Native compilation, real Auth/OTP, two-iPhone acceptance and other unfinished requirements remain open. Source-backup verification does not satisfy the P27 database restore/deletion-replay drill.
