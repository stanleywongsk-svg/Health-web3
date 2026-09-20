# Native build evidence — 2026-09-18

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
