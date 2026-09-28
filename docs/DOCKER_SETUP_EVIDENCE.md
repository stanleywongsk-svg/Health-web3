# Docker installation and recovery — 2026-09-22

User request: install Docker for continued local HealthLoop development. Docker Desktop 4.49.0 was already installed, but its backend/Engine had remained stuck at startup. This session installed **Docker Desktop 4.92.0 (240144)** and verified a working **29.8.0 Engine**, **29.8.1 CLI** and **Compose 5.5.1**. It did not run the HealthLoop application or full Supabase stack.

## Actual checks

| Command / observation | Outcome |
| --- | --- |
| Initial `docker desktop status` and local-socket `docker info` | Timed out after 12 seconds |
| `docker desktop restart --timeout 45` | Failed to stop the old unresponsive processes |
| Graceful quit/TERM, then force-stop of the one verified stuck Docker backend | Old backend stopped; fresh 4.49 startup still failed readiness checks |
| Official Apple Silicon `Docker.dmg` download | Passed; 4.92.0, build240144 |
| SHA-256 compared with official build240144 checksums.txt | Exact match: `e513bbfeca246165595e2f17cabf6579936f36057f3f4fb689c619e6aac6d188` |
| `hdiutil verify`, `codesign --verify --deep --strict`, `spctl --assess --type execute` | Passed; valid image/signature, accepted Notarized Developer ID |
| New application copy and installation | `/Applications/Docker.app` is 4.92.0; prior 4.49.0 retained separately |
| `brew install docker` from homebrew/core | Passed; CLI29.8.1, no additional formula dependency |
| `command -v docker` | `/opt/homebrew/bin/docker` |
| `docker version --format 'Client={{.Client.Version}} Server={{.Server.Version}}'` | `Client=29.8.1 Server=29.8.0` |
| `docker info --format 'OS={{.OSType}} Architecture={{.Architecture}}'` | `OS=linux Architecture=aarch64` |
| `docker compose version` | `Docker Compose version v5.5.1` |
| `docker desktop status` and Desktop UI | `running`; UI showed **Engine running** and **v4.92.0** |
| `docker run --rm --network none hello-world` | Exit0, **Hello from Docker!**; actual ARM64 container execution |

The first smoke test used an explicit local Unix socket; the final test used the normal shell command/default desktop context after the CLI repair. Image digest: `sha256:5e23090353324d887c48ad5e5c56d294eab81588df9605b07d1afe895f9cc8f8`. The container had no host mounts or published ports and was automatically removed; its small test image remains cached.

## Installation details and limits

- The old application was owned by another macOS account. Direct replacement returned PermissionError; noninteractive sudo required a password. A Finder move subsequently completed and preserved the old app at `/Applications/.HealthLoopDockerBackup-20260922/Docker.app`. The verified new staging app was then moved into the normal installation location. **The earlier operator sudo/move instruction is obsolete and must not be rerun.** No password was collected in the coding session.
- A stale Desktop plugin initially relaunched the backup app and rewrote some links to that path. Docker was stopped normally, user-owned plugin links were corrected, and the new application was explicitly launched from `/Applications/Docker.app`. Process inspection confirmed the active backend and VM came from the new installation. A modern Homebrew CLI now takes precedence in the normal shell.
- The legacy root-owned `/usr/local/bin/docker` link still points into the preserved old app. Do not delete the rollback copy until an operator has normalized any legacy system links. The verified active command is `/opt/homebrew/bin/docker`; current user plugin links point to the new app.
- No factory reset, container/volume purge, account creation, paid subscription, registry push, production operation or diagnostic upload occurred. Existing Docker data/settings were retained. No new license-acceptance action was taken by the agent. The precise cause of the original startup hang was not isolated; successful recovery was verified after the installation/launch repairs.
- The task's temporary DMG was unmounted and removed after verification. The application and rollback copy remain. Docker is left running; the test container is removed. No HealthLoop background service was started.

Sources used: [Docker's Mac installation instructions](https://docs.docker.com/desktop/setup/install/mac-install/), [4.92.0 release notes](https://docs.docker.com/desktop/release-notes/#4920), and [bounded Desktop restart command](https://docs.docker.com/reference/cli/docker/desktop/restart/). Installation checks are evidence of local Docker operation, not app, native HealthKit, OTP/MFA, database or real-device acceptance.

## Next executable task

Prepare the local Supabase CLI and start HealthLoop's full local Auth/Edge stack using the existing configuration. Keep it separate from disposable schema-reset databases and set real/native development mode as DEVICE_SETUP specifies. Xcode/native build and two-iPhone checks remain separate open prerequisites; they were not rerun in this Docker-only session.
