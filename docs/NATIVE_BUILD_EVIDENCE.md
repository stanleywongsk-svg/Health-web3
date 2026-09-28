# Native build evidence

## Latest checkpoint — 2026-09-24

Source under test: `5e61056`; isolated checkout `/Users/wi/healthloop-worktrees/native-build-20260924`. The existing Xcode host prerequisite blocker has been resolved outside this run. No installer, license acceptance, administrator action, cloud build or device health query was performed in this follow-up.

Actual root command with pinned Node on PATH:

```sh
export PATH="/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/opt/homebrew/bin:$PATH"
pnpm mobile:preflight
```

**Passed, exit 0 / `ok: true`.** Xcode 26.3 build 17C529 is selected; first-launch check now returns 0; the XcodeSystemResources package receipt and CoreSimulator system framework exist; iPhoneOS SDK and CocoaPods are discoverable; the simulator-service check returns normally. Build-volume free space was 114 GiB. Optional device environment configuration was not supplied to this host-only run, so keys, endpoint connectivity and authentication are not verified by this result.

A separate bounded read-only probe found one available iOS simulator runtime and **zero valid code-signing identities**. Only these counts were retained; signing identities, team IDs and device identifiers were not printed. An unsigned build can test native compilation; a signed physical-device installation still requires operator-provided signing/provisioning and a compatible iPhone.

Fresh isolated preparation:

```sh
git worktree add -b codex/native-build-20260924 /Users/wi/healthloop-worktrees/native-build-20260924 5e61056
cd /Users/wi/healthloop-worktrees/native-build-20260924
pnpm install --frozen-lockfile
CI=1 pnpm --filter @healthloop/mobile exec expo prebuild --platform ios --no-install
```

Both dependency installation (684 packages, pnpm 11.19.0) and fresh prebuild passed. Generated entitlements contain HealthKit with no `aps-environment`; Info.plist has a health-read purpose, no health-write purpose and no remote-notification background mode; the project contains no Push capability. Expo still warns that an app icon has not been configured. No app source or dependency version was changed.

Actual CocoaPods installation from `apps/mobile/ios`:

```sh
COCOAPODS_DISABLE_STATS=true pod install
```

**Passed, exit 0 in 29 seconds.** CocoaPods installed 98 Podfile dependencies / 97 Pods, including `HealthLoopHealth` 0.1.0, `ExpoModulesCore` 55.0.26 and `ExpoNotifications` 55.0.27. The install ran with a 240-second process-group limit and the same pinned Node PATH. The uncommitted log is `/tmp/healthloop-native-20260924-pods.log`.

Actual native build from the same generated iOS directory:

```sh
SKIP_BUNDLING=1 xcodebuild -workspace app.xcworkspace -scheme app -configuration Debug -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath /tmp/healthloop-native-20260924-derived -jobs 4 CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
```

**Passed, exit 0 / `BUILD SUCCEEDED` in 98 seconds.** The log includes 370 C/Swift compilation steps, including actual `HealthLoopHealth` Swift compilation, and no compiler error lines. The 600-second process-group limit was not reached. Local build log: `/tmp/healthloop-native-20260924-device-build.log`. Native artifact: `/tmp/healthloop-native-20260924-derived/Build/Products/Debug-iphoneos/app.app`; its executable is arm64. `codesign --verify` confirms it is not signed. `SKIP_BUNDLING=1` means this check deliberately did not produce an embedded JavaScript bundle; it is a native Debug compilation artifact, not a distributable or installable release. Source checkout and dependency versions were unchanged.

This is the first successful actual iPhoneOS native compilation recorded here. It resolves the previous **host/Swift-compilation** blocker, but does not verify runtime module loading, notification scheduling, network access, HealthKit read authorization or readings, signing, installation or the two-iPhone acceptance criteria. A subsequent simulator build and startup smoke check also passed, as recorded below; it does not replace physical-device HealthKit acceptance.

Next executable device step: the operator configures an eligible local Apple development signing identity/provisioning for the HealthKit bundle identifier, connects a compatible iPhone and supplies the real development environment using the [device setup guide](DEVICE_SETUP.md). Then run `pnpm --filter @healthloop/mobile ios --device` and serve Metro with the development-client setup as needed. This is the [official Expo local build workflow](https://docs.expo.dev/guides/local-app-development/); do not use a cloud build or `-allowProvisioningUpdates` without the required operator setup/authorization. P03, P31 and P32 remain awaiting real-device/signing acceptance; this compiler pass alone does not mark them complete.

### Actual simulator build and startup smoke check — same source

With `EXPO_PUBLIC_*`, `SKIP_BUNDLING` and `FORCE_BUNDLING` unset in the build process (and no application environment file present), from the generated iOS directory:

```sh
xcodebuild -workspace app.xcworkspace -scheme app -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/healthloop-native-20260924-simulator-derived -jobs 4 CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
```

**Passed, exit 0 / `BUILD SUCCEEDED` in 203 seconds**, with 358 compilation steps and no compiler error lines. This simulator Release build includes `main.jsbundle` and runs without Metro. Its artifact is `/tmp/healthloop-native-20260924-simulator-derived/Build/Products/Release-iphonesimulator/app.app`; log `/tmp/healthloop-native-20260924-simulator-build.log`. It is a simulator binary, not an iPhone install package. The earlier unsigned device artifact is preserved separately.

A new empty simulator named `HealthLoop Native Smoke 20260924`, model iPhone 17, runtime iOS 26.3, was created specifically for this test. Existing simulator devices were not reused. `simctl boot` / bounded `bootstatus`, `simctl install`, `simctl launch com.healthloop.app`, and `simctl io screenshot` all returned 0. Simulator identifiers were retained only in the local mode-0600 state file `/tmp/healthloop-native-20260924-simulator.json`; none were printed in evidence. The application was terminated and this test simulator shut down after capture; its installed app remains available for a later operator session.

The screenshot was actually inspected: the visible title is **“先完成安全配置”**, with the complete Simplified Chinese explanation that configuration is missing/mismatched and the application has not connected to a service. Text is readable and contained within the card at this default simulator size. This is the expected fail-closed startup state for an unconfigured real-data build; it is not a login or backend connectivity pass. No health permission dialog appeared, no health values were read or inserted, and no notification permission was requested. No test or production account was used.

Local screenshot: `/tmp/healthloop-native-20260924-config-screen.png` (contains only the configuration guard and simulator status bar, no personal data). Screenshot is kept outside Git. This limited smoke check verifies native app launch, embedded JavaScript execution and the actual unconfigured Simplified Chinese screen. It does not verify configured login, normal navigation, accessibility/large-text cases, reminder delivery or HealthKit execution.

### Configured local simulator startup — 2026-09-24

The local Supabase stack was available on loopback. Its pinned CLI status JSON was consumed only in subprocess memory; no credentials were printed or saved as a status file. The isolated worktree received an ignored, mode-0600 `apps/mobile/.env` with `EXPO_PUBLIC_APP_ENV=development`, `EXPO_PUBLIC_DATA_MODE=real`, the exact loopback API origin, `/functions/v1/core`, and the public key whose JWT role was verified as `anon`. No service-role key was written to the application environment. No application source changed from `5e61056`.

An initial configured Release simulator rebuild with signing disabled passed in **91 seconds**, with no compiler error lines. Its embedded JavaScript contained the expected loopback origin and public anon key; the service-role key was absent. Installation and launch succeeded, and the actual screenshot showed the Simplified Chinese login form. It also showed an unexpected expired-session banner on this never-authenticated simulator. This was not recorded as a clean startup pass.

Bounded runtime-log inspection found 14 securityd events with OSStatus `-34018`; 12 also mentioned `application-identifier` and `keychain-access-groups`. The no-signing build lacked the simulator application identity entitlements needed by Keychain. The safe correction was to enable Xcode's local ad-hoc **simulator** signing, leaving SecureStore and session error handling unchanged. No Apple login, development team, provisioning update or paid/cloud service was used. From the existing generated iOS directory:

```sh
xcodebuild -workspace app.xcworkspace -scheme app -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/healthloop-native-20260924-simulator-derived -jobs 4 CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES DEVELOPMENT_TEAM= build
```

The build had a 600-second process-group limit and **passed in 59 seconds**, with zero compiler error lines. Xcode generated `app.app-Simulated.xcent` containing `application-identifier` and the HealthKit entitlement, and embedded the simulator entitlement section. `codesign --verify --deep --strict` returned 0. The normal code-sign entitlement dictionary is empty for this simulator artifact; the simulated entitlements are embedded separately. This local simulator signature does not satisfy physical-device signing or HealthKit acceptance. The final and preserved configured no-signing `main.jsbundle` files are byte-identical (SHA-256 `d1c2061f46d52274c0d256af3439b97963deb0fdf1118410567bd7fc7304caa5`), preserving the earlier exact service-key absence check and isolating the startup difference to simulator signing. A final public-only check also verified the configured anon role, embedded loopback API/anon key, absence of privileged JWTs and mode-0600 environment file.

The same test-owned iPhone 17 / iOS 26.3 simulator was booted, the new application installed and launched, and a screenshot captured after startup; every command returned 0. The screenshot was actually inspected: **the expired-session banner is gone**, the configuration guard is absent, and the initial screen contains the readable Simplified Chinese email/OTP form, disabled empty-input actions and the nontransferable/noncash points disclaimer. No field was filled and no action was pressed. No OTP request, account creation, authentication, health query, permission dialog or fabricated sample was used. The app was terminated and only this owned simulator was shut down afterward, both returning 0.

Local evidence is retained outside Git:

- Final simulator application: `/tmp/healthloop-native-20260924-simulator-derived/Build/Products/Release-iphonesimulator/app.app`.
- Successful signed build log: `/tmp/healthloop-native-20260924-configured-signed-build.log`.
- Inspected final screenshot: `/tmp/healthloop-native-20260924-configured-login-adhoc.png`, SHA-256 `f60b10e433283da494d3c0a6d6ea92ad83976ee392a188288920a43949b72b95`.
- Earlier no-signing diagnosis: `/tmp/healthloop-native-20260924-configured-build.log`, `/tmp/healthloop-native-20260924-login-screen.png` and bounded local-only runtime logs under `/tmp/healthloop-native-20260924-runtime.*`; raw runtime logs are not committed.
- Earlier application artifacts remain preserved at `/tmp/healthloop-native-20260924-unconfigured-simulator.app` and `/tmp/healthloop-native-20260924-configured-unsigned-simulator.app`. The unsigned iPhoneOS artifact from the previous check also remains separate.

This proves configured native simulator startup and the initial login UI, with no expired-session error after proper simulator signing. It does not prove a mobile OTP transaction, backend connectivity from an authenticated app, Keychain write/session persistence, normal post-login navigation, large-text accessibility or real HealthKit access. The next simulator task is a separately scoped synthetic OTP login/logout and secure-session restart check when the local integration harness no longer needs an otherwise empty account database. The physical-device signing and two-iPhone read-only acceptance steps remain open.

## Historical checkpoint — 2026-09-20

The new read-only preflight is executable with the repository's pinned Node 24.19:

```sh
node scripts/native-check.ts
node scripts/native-check.ts --env-file apps/mobile/.env
pnpm exec vitest run scripts/native-check.test.ts
```

The default checks the host; the optional file check validates physical-device real-mode configuration without printing keys, URLs, tokens, device identifiers or signing identities. Configuration validation does not contact the server or prove that a key works. Every subprocess is limited to 12 seconds and bounded output; a timeout terminates only the probe's own process group. Exit 0 means the selected prerequisite checks passed, exit 1 means a prerequisite failed, and exit 2 means invalid arguments. This is not native build or HealthKit acceptance evidence. The script does not install packages, accept licenses, change Xcode selection, sign, provision or invoke cloud builds.

Executed from `/Users/wi/healthloop-worktrees/native-readiness` (source base `0e42001`, with the root's pinned `expo-notifications` 55.0.27 manifest/lockfile copied solely for the isolated generation check):

| Check | Actual result |
| --- | --- |
| Frozen pnpm dependency installation | Passed; 684 packages, Node 24.19.0, pnpm 11.19.0 |
| Preflight regression tests | 11 passed, including bounded timeout, missing executable, unsupported host, incomplete first launch, redacted output and unsafe device configuration |
| Focused ESLint and root TypeScript | Passed |
| `node scripts/native-check.ts` | **Exit 1**, correctly reports incomplete Xcode setup |
| Active Xcode | `/Applications/Xcode.app/Contents/Developer`; Xcode 26.3 build 17C529 |
| iPhoneOS SDK | 26.2 discoverable |
| CocoaPods | 1.17.0 available |
| Free build volume | 154 GiB available at inspection; prior 2 GiB observation is historical |
| `xcodebuild -checkFirstLaunchStatus` | **Exit 69** |
| Required CoreSimulator binary | Missing; the entire `/Library/Developer/PrivateFrameworks` directory is absent |
| `xcrun simctl list devices --json` separate diagnostic | **12-second timeout**; no returned device data was printed |
| `CI=1 pnpm --filter @healthloop/mobile exec expo prebuild --platform ios --no-install` | Passed; generated an ignored iOS project, then passed again with the local-only reminders config plugin |
| `COCOAPODS_DISABLE_STATS=true pod install` in generated `apps/mobile/ios` | Passed; 98 Podfile dependencies / 97 installed Pods, including `HealthLoopHealth` and `ExpoNotifications` 55.0.27 |
| Unsigned generic iPhoneOS build | **Exit 70 before source compilation**; `IDESimulatorFoundation` cannot load the absent CoreSimulator system framework |

The four bundled setup packages were inspected by extracting only their `PackageInfo` metadata to temporary directories, not by installing their payloads. All exact package identifiers below lack receipts: `com.apple.pkg.XcodeSystemResources` (26.3), `com.apple.pkg.MobileDevice`, `com.apple.pkg.MobileDeviceDevelopment`, and `com.apple.pkg.CoreTypes.1900A28`. The parent `/Library/Developer` is owned by root and is not writable by this user. These observations explain why merely having an iPhoneOS SDK and successfully generating a project is insufficient to start native compilation. They do not prove the cause of an earlier install stall.

One already-running `xcodebuild -runFirstLaunch` was observed initially and was left untouched; a later preflight saw none. A bounded inspection of recent install-log markers provided no explicit failure reason. No installer lock was removed and no unrelated process was terminated.

Installed `xcodebuild -help` explicitly describes `-runFirstLaunch` as installing packages **and agreeing to the license**. It was not invoked in this follow-up. An operator must review the Xcode license and complete its supported first-launch component installation, including any administrator authorization. Do not manually copy an extracted private framework into system paths. See [Apple's Xcode component instructions](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components).

The fresh generated Info.plist contains the read-only HealthKit purpose and no health-write purpose. Initial generation with Expo Notifications also added `aps-environment` despite no explicit notification plugin entry. After copying the root owner's `with-local-reminders.js` and final app configuration, a second actual prebuild verified: only the HealthKit entitlement remains; `aps-environment`, the `remote-notification` background mode and the `com.apple.Push` project capability are absent. A generated entitlement is not proof of signing or successful HealthKit access.

Actual unsigned device-target compilation command (after successful Pods installation), from generated `apps/mobile/ios`:

```sh
SKIP_BUNDLING=1 xcodebuild -workspace app.xcworkspace -scheme app -configuration Debug -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath /tmp/healthloop-native-readiness-derived -jobs 2 CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
```

It failed in less than one second with exit70; no Swift/C source compilation started. A 45-second process-group limit was in place but was not reached. The generic device target establishes that switching away from the simulator target does **not** avoid Xcode's missing system framework. No signed or installable app was produced. Local logs are `/tmp/healthloop-native-readiness-pods.log` and `/tmp/healthloop-native-readiness-build.log`; unreviewed raw logs are not committed. Generated project/Pods/build artifacts remain ignored. Root-owned manifest/config/plugin copies used for this check are not part of the preflight commit.

Local generation follows [Expo's local development build workflow](https://docs.expo.dev/guides/local-app-development/). A successful development-client install must still be followed by the real-device cases in [NATIVE_VERIFICATION.md](../apps/mobile/NATIVE_VERIFICATION.md). P03, P31 and P32 remain blocked on host repair, actual native compilation/signing/install and the required two-iPhone acceptance.

## Historical evidence — 2026-09-18

## Result

The root integration session successfully generated the iOS project with Expo prebuild (`--no-install`) and parsed the native Swift source. This follow-up installed CocoaPods and completed an actual CocoaPods dependency installation in an isolated path without spaces. The unsigned simulator build then failed **before source compilation** because Xcode's required CoreSimulator system framework is missing. Neither Swift bridge typechecking nor a native app build is verified. No simulator was launched, no signing/provisioning occurred, and no device health data was accessed.

Real HealthKit acceptance remains open and requires the specified two compatible physical iPhones. Dependency installation, Swift parsing and JavaScript bundle checks do not establish native integration.

## Environment

- Xcode 26.3, build 17C529; installed iPhoneSimulator SDK 26.2.
- Pinned build-process Node: `/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`, v24.19.0.
- Expo 55.0.31; React Native 0.83.10.
- Installed CocoaPods 1.17.0 and its Homebrew Ruby 4.0.7 dependency. The system Ruby was initially 2.6.10 and `pod` was unavailable.
- Source checkout: `/Users/wi/web3 health`.
- All staging/generated build files were ignored or under `/tmp`. No committed source, package or lockfile was changed by this follow-up.

## Commands and outcomes

Run from the source checkout:

```sh
HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ENV_HINTS=1 brew install cocoapods > /tmp/healthloop-cocoapods-install.log 2>&1
```

**Passed, exit 0.** CocoaPods 1.17.0 and Ruby 4.0.7 installed locally.

The first installation ran in `/Users/wi/web3 health/apps/mobile/ios`:

```sh
PATH='/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin' COCOAPODS_DISABLE_STATS=true pod install > /tmp/healthloop-pod-install.log 2>&1
```

**Failed, exit 1.** React Native's prebuilt-pod URI handling rejected its artifact path containing the checkout's space:

```text
bad component(expected absolute path component): /Users/wi/web3 health/apps/mobile/ios/Pods/ReactNativeCore-artifacts/reactnative-core-0.83.10-debug.tar.gz
The `React-Core-prebuilt` pod failed to validate
Missing required attribute `source`
```

The downloads succeeded and were cached. A staging project without spaces avoided that URI failure. The equivalent complete staging commands, from the source checkout, are:

```sh
mkdir -p /tmp/healthloop-native-build
cp -R apps/mobile/ios /tmp/healthloop-native-build/ios
cp apps/mobile/package.json apps/mobile/app.json apps/mobile/index.js /tmp/healthloop-native-build/
ln -s '/Users/wi/web3 health/apps/mobile/node_modules' /tmp/healthloop-native-build/node_modules
ln -s '/Users/wi/web3 health/apps/mobile/modules' /tmp/healthloop-native-build/modules
ln -s '/Users/wi/web3 health/apps/mobile/src' /tmp/healthloop-native-build/src
```

These files were actually staged in separate shell invocations. An intermediate attempt referenced nonexistent `app.config.ts`; the actual configuration is `app.json`, which was subsequently copied. An intermediate invocation with only `--project-directory` from the repository root could not resolve Expo; the successful invocation used the iOS working directory below.

Run with working directory `/tmp/healthloop-native-build/ios`:

```sh
PATH='/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin' COCOAPODS_DISABLE_STATS=true pod install > /tmp/healthloop-pod-install-nospace.log 2>&1
```

**Passed, exit 0.** CocoaPods reported: `96 dependencies from the Podfile and 95 total pods installed`. This includes `HealthLoopHealth` and `ExpoModulesCore`. It generated `/tmp/healthloop-native-build/ios/app.xcworkspace`.

Unsigned simulator compilation attempt, same working directory:

```sh
PATH='/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin' SKIP_BUNDLING=1 xcodebuild -workspace app.xcworkspace -scheme app -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/healthloop-ios-derived -jobs 6 CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build > /tmp/healthloop-xcodebuild.log 2>&1
```

**Failed, exit 70, before source compilation.** Xcode could not load `com.apple.dt.IDESimulatorFoundation` because `/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/CoreSimulator` is absent. This is a host prerequisite failure, not evidence that the app or its Swift code compiles or fails compilation.

The suggested setup command was attempted:

```sh
xcodebuild -runFirstLaunch > /tmp/healthloop-xcode-firstlaunch.log 2>&1
```

It produced no output and remained running. A pre-existing first-launch process had already been running for approximately 21 minutes. Only the new follow-up process (PID 61211) was terminated with `kill -TERM 61211`; the pre-existing process (PID 50841) was left untouched. First-launch setup is **not** verified.

A final local inspection expanded the bundled Xcode system-resource package into `/tmp/healthloop-xcode-system-resources` with `pkgutil --expand-full`; it was **not installed** into system directories and no build used these extracted files. Work stopped at the operator-prerequisite checkpoint.

## Next executable task

An operator must repair/complete Xcode's system prerequisite installation and verify the missing CoreSimulator framework is available. After that, rerun the unsigned build above from the staged workspace, or regenerate/install pods in a checkout path without spaces. Resolve actual compiler errors if they appear. Only after a successful native build should signing, installation and real-device read-only HealthKit acceptance be attempted under separately authorized operator setup.
