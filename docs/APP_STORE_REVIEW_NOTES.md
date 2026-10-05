# Hong Kong iOS submission handoff — 2026-10-05

Status: implemented first-release behavior with local verification recorded in `TEST_EVIDENCE.md`; not uploaded, signed for distribution or reviewed by Apple. Use the following notes only after replacing operational prerequisites with verified real values. Do not submit the local test server, synthetic fixtures or a development build as a production service.

## Review Notes draft

HealthLoop (健康循环) is an adult health-habit app. It reads existing Apple Health activity only after permission, shows available data, and optionally sends a minimum daily activity summary after separate cloud-sync consent. Sleep and heart-rate display are optional, local-only and do not earn points. The app does not write HealthKit samples. Missing readings are shown as unavailable rather than invented values or a claim that access was denied.

Verified activity can earn capped, nontransferable points with no cash value. The achievements gallery displays personal milestones derived from server-posted activity awards: a first qualifying daily award and a qualifying three-day weekly award. Achievements do not spend points, are not blockchain assets and reflect approved accounting corrections. Rest has no penalty.

This build has no NFT purchase, wallet connection, cryptocurrency reward, token conversion, external purchase link, rewarded-ad SDK or paid-content flow. The backend and client enforce the same versioned release capability set. There is no review-only switch or post-review remote activation mechanism. Historical demonstration-redemption records can be inspected, reconciled and cancelled/refunded; this build cannot create new demonstration spending.

Account creation uses email OTP. Provide a reviewer-accessible mailbox and instructions through the private App Store Connect review fields, with a running approved backend. Do not add a master OTP, hard-coded account, hidden bypass or credentials to this repository. A reviewer with no available Health data can still inspect the honest empty state, rules, achievements, privacy controls and account support.

## Reviewer route through the current app

1. Sign in by email OTP. Read the adult confirmation and separate local-read/cloud-sync explanations. Marketing is not active in this version.
2. Open 首页 and 任务. With Health permission absent or no records, the app explains missing data. With existing permitted activity and cloud sync enabled, synchronize the minimum summary and request the server-evaluated daily/weekly award.
3. Open 积分与徽章 → 习惯徽章 to view milestone status and 积分流水 for the canonical ledger. No purchase or ad is needed. The app never creates qualifying activity for review.
4. Open 我的 to change consent, export own data, submit a correction request, manage the optional generic local reminder, or request deletion. Capability/network failures must not block these privacy/help controls. View/cancel any existing historical demonstration-redemption record through the retained history route.
5. Log out and reopen. User-specific badge/ledger state must not appear for another account.

## Release gates still requiring operator evidence

- Developer organization, correct bundle ID/HealthKit capability, signing profile and current accepted Xcode/SDK submission requirements.
- Two real iPhones: permission/withdrawal/missing data, phone/watch overlap, local-only sleep/heart rate, server award/retry/correction, deletion, reminders and accessibility. Simulator builds and synthetic tests do not satisfy these checks.
- Reachable production backend, SMTP, reviewer login, deletion/retention schedules and backup replay; approved privacy/support URLs and processor disclosure. No operator-approved hosted environment exists in this task.
- App icon, current real screenshots, final description/age rating, App Privacy answers and archive privacy report. Do not reuse the old demonstration-shop recording as proof of this new achievement interface.
- B/C cross-review, applicable legal/business approval and explicit permission for provisioning, deployment and submission.

Draft public description: “健康循环帮助成年人记录步行习惯、查看个人进度，并通过核实后的活动积累无现金价值积分与个人成就。健康资料读取和云端同步由你分别选择，休息不受惩罚。” Do not advertise money, token income, merchant benefits or providers that are not supplied.

Policy basis and future monetization options are in `APP_STORE_RELEASE_RESEARCH.md`. These design choices reduce the identified crypto-policy conflicts but cannot guarantee acceptance. [Apple review preparation](https://developer.apple.com/app-store/review/), [Apple submission guidance](https://developer.apple.com/app-store/submitting/)
