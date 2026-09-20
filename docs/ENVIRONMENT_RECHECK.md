# Environment recheck — 2026-09-18

This is a bounded continuation of [NATIVE_BUILD_EVIDENCE.md](NATIVE_BUILD_EVIDENCE.md). It records fresh host checks, not additional native or authentication acceptance. Relevant requirements remain P01/P03/P31/P32/P36 with the existing B/C ownership and review assignments.

## Current result

Checks began at **2026-09-18 15:29:03 UTC / 23:29:03 Asia/Hong_Kong**. Each subprocess had a hard 20-second timeout. Independent checks ran in parallel.

| Check | Exact command or filesystem path | Actual result |
|---|---|---|
| Docker server response | `docker info --format '{{.ServerVersion}}'` | Timed out after 20 seconds without output. Client exists at `/usr/local/bin/docker`; server health is not established. |
| Xcode version | `xcodebuild -version` | Exit 0: Xcode 26.3, build 17C529. |
| Installed simulator SDK | `xcrun --sdk iphonesimulator --show-sdk-path` | Exit 0: `/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator26.2.sdk`. |
| Required CoreSimulator system framework | `/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/CoreSimulator` | Still absent. This is the prerequisite whose absence previously stopped `xcodebuild` before compilation. |
| Xcode simulator plugin | `/Applications/Xcode.app/Contents/Frameworks/IDESimulatorFoundation.framework/Versions/A/IDESimulatorFoundation` | Present. Its dependent system CoreSimulator framework remains absent. |
| Previously staged native workspace | `/tmp/healthloop-native-build/ios/app.xcworkspace` | Present. Prior successful CocoaPods installation remains documented separately. |

The timeout runner used Python `subprocess.run(..., stdout=PIPE, stderr=STDOUT, text=True, timeout=20)`. A timed-out child was terminated by the runner; no success exit status was substituted. The Docker command was executed only once during this recheck.

The unchanged missing native prerequisite did not justify repeating the already failed unsigned build. No native source compilation was attempted in this recheck. The Docker timeout prevented starting a complete local Supabase stack, so real local email OTP, JWT validation and Edge delivery were not executed here. Existing standalone PostgreSQL tests are separate evidence and were left for the coordinating agent.

## Local evidence files

- `/tmp/healthloop-env-next-results.json`: structured commands, timeout limits, exit outcomes and filesystem checks.
- `/tmp/healthloop-env-next-docker_info.log`: empty output from the timed-out Docker health command.
- `/tmp/healthloop-env-next-xcode_version.log`: successful version output.
- `/tmp/healthloop-env-next-simulator_sdk.log`: successful SDK-path output.

These temporary files are local session evidence, not durable repository artifacts. Their material results are preserved in the table above. No credentials or health records were collected.

## Existing local backend configuration reviewed

`supabase/config.toml` identifies the disposable development project as `healthloop-local-dev`, with API port 54321, PostgreSQL port 54322 and local email sink port 54324. Email OTP is configured for six digits, a 600-second expiry and a 60-second resend interval. The core Edge function performs token validation inside its handler. This was a configuration read only; none of those runtime behaviors was newly verified.

No services, containers, installers or new native-build processes were started. No packages were installed. No production/cloud resources, signing/provisioning, device health data or shared PostgreSQL test processes were touched. Existing first-launch processes were left untouched.

## Next executable checks after operator repair

1. Restore a responsive local Docker server. Re-run the single bounded Docker health command; only after it succeeds should the coordinating agent start the existing local Supabase configuration and test OTP through its local email sink and authenticated Edge routes.
2. Repair Xcode's system prerequisites through operator-controlled setup. Verify the missing CoreSimulator framework exists, then rerun the unsigned simulator build already recorded in `NATIVE_BUILD_EVIDENCE.md` from the preserved staging workspace.
3. Treat a future successful native build separately from the two physical-iPhone HealthKit acceptance checks. No current result completes device acceptance.

This checkpoint requires an external host-state change before further native/Auth-stack evidence can be obtained. It does not schedule background continuation.

## Continuation recheck — 2026-09-20

At 07:01:41 UTC / 15:01:41 Hong Kong, the same bounded Docker server command again timed out after 20 seconds. The required CoreSimulator framework was still absent. No additional native build or real OTP test was attempted. The structured result is recorded in `/tmp/healthloop-environment-20260920.json`; these material outcomes are preserved here.

An attempted worktree dependency installation and source write initially failed with `ENOSPC`. Only the previously generated `/tmp/healthloop-native-build/ios/Pods` directory was removed to recover space. Source, workspace/project configuration, user files and historical installation evidence were preserved. The staging workspace now requires `pod install` again before a future build; the September 18 installation result remains historical evidence, not a claim that Pods are still present. Available disk space immediately after cleanup was 5.5 GiB. Root `pnpm install --frozen-lockfile --offline` then passed using the existing dependency cache. No new packages or system tools were installed by this cleanup.
