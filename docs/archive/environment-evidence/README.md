# Historical environment evidence

These are original evidence artifacts from the local implementation host. They do not prove successful native compilation or real-device execution.

- `environment-20260918.json`: bounded checks of Docker and native prerequisites.
- `environment-20260920.json`: repeated missing CoreSimulator / Docker timeout observation.
- `Podfile.lock`: the native dependency resolution reached in the temporary no-space iOS staging project. This is historical evidence, not an active pnpm/CocoaPods lockfile for an installed application. Recreate the native project and verify current compatibility before use.

Absolute paths inside these artifacts describe the old host only; a fresh clone does not depend on those paths. See `../../DEVICE_SETUP.md` and `../../NATIVE_BUILD_EVIDENCE.md`.

`logs/` preserves the original bounded test/install/build outputs as plain text. PostgreSQL output contains only disposable synthetic test activity; it is not a production backup. Empty logs are kept as empty evidence, not interpreted as success. These historical logs were not rerun during backup preparation.
