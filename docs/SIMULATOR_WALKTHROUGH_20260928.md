# Recorded simulator login and interface walkthrough — 2026-09-28

## Environment and scope

The operator requested actual simulator login, interface operation and a recording. The desktop was unlocked on this retry. The clean repository checkpoint at the start was `46966c2`; no application source changed. The recording reused the configured, ad-hoc signed iPhone 17 / iOS 26.3 simulator Release app built from `5e61056`, as documented in NATIVE_BUILD_EVIDENCE. It is a native simulator binary with embedded JavaScript, not Expo Go or a browser preview.

The local Supabase launcher verified loopback-only ports. Actual Auth, Mailpit, Edge and PostgreSQL were used; the compiled public configuration matched the running local stack, and the server credential was absent from the bundle. The seed's `demo_mode=true` remained unchanged. No health synchronization was attempted. The account used a disposable `local.invalid` mailbox; no external email provider, real user or real health data was involved.

## Actual observed results

| Operation | Observed result |
|---|---|
| Request email code and submit it in the native app | The app showed the sent notice, then entered onboarding after the local email code was verified. No login bypass was used. |
| Save first-use choices | Adult confirmation was enabled; local health reads, cloud synchronization and marketing remained off. The app entered the home page. |
| Home | Steps displayed an em dash and the explicit no-data message. History, sleep and heart-rate sections remained empty; reads and synchronization were disabled. No samples were fabricated or inserted. |
| Missions | Daily and weekly rules, server-created instances, `steps-v1`, Hong Kong deadlines and zero awarded points were visible. Refresh completed. Unlike the earlier planned walkthrough, instances were present even without a health upload. |
| Points and rewards | Zero available/pending/refunded/correction points and an empty ledger were visible. The demonstration badge cost20points; redemption was disabled. No award or redemption was performed. |
| Account/privacy | The same disposable mailbox and the saved optional choices were visible. Correction/deletion entries and privacy help were inspected without submitting either action through the UI. |
| Reminder preferences | The default-off reminder setting and quiet hours were visible. Saving returned the success notice and left reminders unarranged; no OS permission or notification-delivery check was performed. |
| Account export | A real request opened the native iOS share sheet. It was dismissed without selecting a recipient or sharing externally. |
| Authenticated cold restart | The app process was terminated with the developer `simctl` lifecycle command, then reopened by clicking its SpringBoard icon. It returned to the authenticated home page; the profile confirmed the same test account and choices. |
| Logout and another cold restart | The app's logout control returned to empty login fields. After another process termination and UI relaunch, the app remained logged out. No expired-session error banner appeared. |

All in-app actions used the computer-use interface. Initial simulated typing truncated the mailbox and the clipboard operation timed out; the complete address was then set through the exposed accessibility text field and checked before submission. Wheel/coordinate gestures did not reliably advance the simulator content; clicking the already-exposed accessibility headings brought the relevant sections into view. These input-tool limitations were not hidden or described as successful gestures.

The raw recording was captured with `xcrun simctl io <owned-device> recordVideo --codec=h264`, then finalized with SIGINT. The simulator identifier and any credentials are omitted from this report. Deliverable media is retained in the Git-ignored `artifacts/recordings/simulator-login-20260928/` directory; the raw capture is private and must not be shared because it contains the OTP-entry frames.

## Delivered recording and validation

- File: `artifacts/recordings/simulator-login-20260928/HealthLoop-simulator-walkthrough.mp4`.
- Duration396.033seconds (6:36), size5,296,388bytes, H.264/yuv420p, 720×1638, 30fps /11,881frames, no audio. Original simulator display:1206×2622. No cuts or speed changes were applied; interaction/wait time remains in the recording.
- A persistent Chinese banner identifies the simulator/local-account context and absence of physical-device acceptance. The OTP area is obscured from68–114seconds before scaling; no login result or post-login behavior was substituted.
- Local Apple Vision OCR located the code inside the masked region. Independent OCR of the final video sampled51frames over66–116seconds and36frames at0.1-second intervals over102–105.5seconds: zero six-digit matches, zero OCR/process errors. This is sampled validation, not a claim of exhaustive OCR over every frame.
- FFmpeg encoding exited0. It emitted one output-buffer queue warning; the subsequent **entire-video decode** (`ffmpeg -v error -i <final.mp4> -f null -`) exited0 with no errors. FFprobe confirmed the metadata above. A contact sheet of the final recording was visually inspected, including the obscured-code frame and both restart outcomes.
- SHA-256: `842262f0345ab62b10c4d6b97b078db2ea1fcc66736ff0737299147c63337b42`.
- The shareable MP4, a contact sheet, local README and metadata JSON are retained with restricted local permissions. They were not uploaded or published. Only the processed MP4 is offered to the operator; the raw MOV remains private.

## Test fixture cleanup

After recording and the final logged-out restart, a scoped backend cleanup verified the exact test account had no activity summaries/submissions, ledger entries or redemptions. A fresh local OTP with account creation disabled was used only inside the cleanup process to invoke the normal account-deletion endpoint. The production worker received only that account's deletion-job allowlist. Auth removal and the inactive tombstone were confirmed; the tombstone's account key was cleared. No other account or deletion job was processed. This cleanup is **not** evidence of deletion through the simulator UI.

The foreground Edge process was interrupted intentionally, and the guarded `local:stop` command passed exit0. Project containers and the launcher processes stopped; both project volumes remain. The seed mode was never changed and no database reset ran. The task-owned simulator and temporary Mailpit browser tab were closed; the installed app, source, dependencies and recording artifacts were retained. No application test suite was rerun for this UI/evidence-only change.

## Evidence boundary

This adds actual simulator evidence for P01/P02/P04–P06/P10/P15/P16/P25/P29/P31 interface behavior and the tested session lifecycle. It does not complete those requirements or constitute B/C human review. It does not test wrong/expired codes, resend timing, long-running token refresh, account switching, offline recovery, VoiceOver/large text, real HealthKit, health-summary synchronization, point awards, redemption, deletion through the UI or notification delivery. Two-iPhone acceptance and physical-device signing remain open. The SpringBoard icon is still the unconfigured blank icon already noted by the earlier build. No dependency installation, application code change, publication, spending or blockchain operation was performed.

Next executable acceptance work: use eligible physical-device signing and a separately configured development backend for the documented two-iPhone read-only HealthKit workflow. Further simulator error-state and accessibility cases can proceed independently; the recorded empty-data path must not be reported as real-health reward acceptance.
