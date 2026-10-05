# README GitHub section checks — 2026-10-05

Replaced the stale September/180-file delivery paragraph in `README.md` with the verified October/216-file record, source commit/CI links, documentation follow-up, current deliverables and proposal index. Read the existing remote ref and local delivery evidence; the workspace was clean before editing. `git diff --check` passed. A Python `pathlib`/`re` check asserted the October date, 216-file count, removal of `all180` from this section, existing relative-link destinations, and the recorded source commit/Actions run identifiers; it passed. This documentation-only change does not rerun application tests or create new acceptance evidence. The successful application CI result remains the explicitly linked prior source run. Upload uses a non-force documentation commit with `[skip ci]`; final remote content is checked against the local Git tree.

# GitHub publication checks — 2026-10-05

The operator explicitly requested uploading the latest version. Inspected the current brief/register, instructions, all changed paths, destination and existing remote history. The local pre-upload parent tree matched remote `main` exactly. All 78 changed paths were committed locally as `a6b8ab98d15d3b679c95092b037622b5dc10954d`; the GitHub integration published identical tree `e32258bbc78a5ec13572265dd31328797d2ffb93` at `b11b2f1369d164459e94180b94067d5ec48acfef`, using remote parent `4691db7fbcbe64cb3e0a418980d22ac2bfafbd45` and `force: false`. No source file changed during the checks.

Commands actually run in this upload session:

```sh
export PATH="/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
pnpm check
pnpm typecheck:edge
pnpm test:edge
pnpm mobile:bundle
git diff --check
git diff --exit-code -- docs/requirements.md docs/requirements.json
git add -A && git diff --cached --check
GIT_TERMINAL_PROMPT=0 git clone --branch main --single-branch https://github.com/stanleywongsk-svg/Health-web3.git .local/github-upload-20261005/verify
git -C .local/github-upload-20261005/verify fsck --full
python3 .local/github-upload-20261005/verify-snapshot.py --remote-commit b11b2f1369d164459e94180b94067d5ec48acfef --local-ref a6b8ab98d15d3b679c95092b037622b5dc10954d --output .local/github-upload-20261005/source-verification.json
```

All final checks above exited 0: **434 tests / 24 files**, zero-warning lint and root/mobile TypeScript; Edge TypeScript and **38 tests**; **35 client files / 58 requirement assignments / 46 reachable sources / 566 dependency manifests**; iOS export **856 modules**, real HealthKit bridge retained and excluded providers/fixtures absent. The usual Expo NO_COLOR/FORCE_COLOR warnings were informational. No local database, real-Auth, Xcode, physical-device, wallet or provider suite was rerun for this upload.

The candidate-path and credential-pattern scan covered all 216 project files, including Office XML/relationships. No excluded private/environment/build path, private key, provider token or JWT was found. Eleven credential-URL pattern hits were reviewed as existing local/example test fixtures, including deliberate rejection cases; sample environments contain empty credentials and public configuration placeholders. Existing reviewed archives and the processed recording were preserved. The immutable source snapshot and fresh public clone matched all **216 files / 9,847,834 bytes** by SHA-256, with identical file lists and Git tree, at **2026-10-05T10:23:56Z**. Local verification manifests/helper remain ignored under `.local/github-upload-20261005/`.

Corrections and limitations: `gh auth status` reported no CLI login and the noninteractive dry-run push failed to obtain credentials, so the connected GitHub integration performed the authorized upload. The first hash-comparison helper stopped on an empty filename from the trailing NUL separator; filtering empty entries fixed the helper and the complete comparison then passed. Git integrity and commit/tree checks had already passed; no source was changed or failure hidden.

[GitHub Actions run 37296169894](https://github.com/stanleywongsk-svg/Health-web3/actions/runs/37296169894) for source commit `b11b2f1` completed with **success** at **2026-10-05T10:24:41Z**. The public run API reported `event: push`, `status: completed`, `conclusion: success` when checked at **10:26:11Z**. This workflow includes frozen-lockfile installation, `pnpm check`, Edge checks, iOS export, `pnpm test:db && pnpm test:integration`, and the manual-gate reminder. The reminder does not fulfill its listed human gates. The subsequent verification record changes only three Markdown files and uses `[skip ci]` to avoid repeating the already successful source pipeline.

This is source publication, not runtime deployment, Apple approval or new B/C acceptance. All requirement IDs/assignments and local files are retained. Current-source native UI and signed two-iPhone acceptance remain the next executable engineering work with operator setup; no automatic continuation was scheduled.

# Business proposal split and deletion checks — 2026-10-05

Documentation-only revision: the main Traditional Chinese proposal is now four pages; the new independent Web3/Tokenomics Word file is five pages. This entry supersedes the earlier eight-page artifact checks below. Read the current brief/register, instructions, release policy, badge source and prior proposal; preserved concurrent app work and the existing editable slide deck. No application, device, wallet or ad-provider tests were run and no requirement acceptance, external approval or audit was completed by this document task.

Commands actually run from `/Users/wi/healthloop`:

```sh
/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /Users/wi/.codex/plugins/cache/openai-primary-runtime/documents/26.909.12148/skills/documents/container_tools/mark_artifact_operation_started.mjs --operation-kind edit --expected-output-count 2 --output-format docx
/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/build-business-proposal-tc.py
FONTCONFIG_FILE=/Users/wi/healthloop/.local/business-proposal/fontconfig.xml PATH=/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override:/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH /Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /Users/wi/.codex/plugins/cache/openai-primary-runtime/documents/26.909.12148/skills/documents/render_docx.py docs/proposals/HealthLoop_Business_Proposal_TC.docx --output_dir .local/proposal-split/final/HealthLoop_Business_Proposal_TC --emit_pdf
FONTCONFIG_FILE=/Users/wi/healthloop/.local/business-proposal/fontconfig.xml PATH=/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override:/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH /Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /Users/wi/.codex/plugins/cache/openai-primary-runtime/documents/26.909.12148/skills/documents/render_docx.py docs/proposals/HealthLoop_Web3_Tokenomics_TC.docx --output_dir .local/proposal-split/final/HealthLoop_Web3_Tokenomics_TC --emit_pdf
/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/build-business-proposal-tc.py --document web3
FONTCONFIG_FILE=/Users/wi/healthloop/.local/business-proposal/fontconfig.xml PATH=/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override:/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH /Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /Users/wi/.codex/plugins/cache/openai-primary-runtime/documents/26.909.12148/skills/documents/render_docx.py docs/proposals/HealthLoop_Web3_Tokenomics_TC.docx --output_dir .local/proposal-split/final2/HealthLoop_Web3_Tokenomics_TC --emit_pdf
/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 .local/proposal-split/verify.py
```

The verifier invokes bundled Poppler `pdftotext` in layout/raw modes and checks both outputs. Passed: valid ZIP/XML; no comments, tracked revisions or placeholders; four/five rendered pages; three/five editable tables; four/two hyperlink instances; every body/table paragraph present in rendered text; all seven requested sections absent; deleted business pricing/pilot/resource numbers absent from the main proposal. Candidate allocation totals 100% and 100,000,000 units, reward examples each total 300,000 within a 60-unit personal cap, and team vesting examples total 5,000,000 at month 24 and 15,000,000 at month 48.

All four main pages and five companion pages were inspected at original resolution. The companion review found one NFT acronym split across two lines on page one; revised wording resolved it. The final page one was re-inspected, and byte comparisons proved pages two through five unchanged from the reviewed images. Refund wording also distinguishes unused authorization from already-transferred tokens. Final results and SHA-256 are in ignored `.local/proposal-split/validation.json`; QA PDFs/PNGs are not deliverables. Pre-edit proposal files are retained in that ignored task directory.

SHA-256 preservation checks passed for AGENTS.md, MEGA_PROMPT.md, both requirement registers and `HealthLoop_Business_Proposal_Editable.pptx`. `git diff --check` and `git diff --exit-code -- docs/requirements.md docs/requirements.json` passed (exit 0). Official Apple, AdMob and Base references were checked on 2026-10-05. Existing engineering counts are cited as prior records, not newly run tests. The current first-release native product has no wallet/NFT reward boost; the independent synthetic Lab and candidate token model remain distinct. No remaining document blocker or automatic continuation; the next document action is a requested source revision and rebuild.

# Partner business proposal document — 2026-10-05

Delivered `docs/proposals/HealthLoop_Business_Proposal_TC.docx` with editable Markdown and `scripts/build-business-proposal-tc.py`. These checks concern the document only; no application test, physical-device HealthKit check, wallet/provider validation, human acceptance, legal approval or independent audit was newly completed. Prior engineering counts in the proposal are explicitly attributed to the existing 2026-10-05 record.

Commands actually run from `/Users/wi/healthloop`:

```sh
/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /Users/wi/.codex/plugins/cache/openai-primary-runtime/documents/26.909.12148/skills/documents/container_tools/mark_artifact_operation_started.mjs --operation-kind create --expected-output-count 1 --output-format docx
/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/build-business-proposal-tc.py
FONTCONFIG_FILE=/Users/wi/healthloop/.local/business-proposal/fontconfig.xml PATH=/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override:/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH /Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /Users/wi/.codex/plugins/cache/openai-primary-runtime/documents/26.909.12148/skills/documents/render_docx.py docs/proposals/HealthLoop_Business_Proposal_TC.docx --output_dir .local/business-proposal-tc/delivery --emit_pdf
/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin/pdftotext -layout .local/business-proposal-tc/delivery/HealthLoop_Business_Proposal_TC.pdf .local/business-proposal-tc/delivery/text.txt
/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin/pdftotext -raw .local/business-proposal-tc/delivery/HealthLoop_Business_Proposal_TC.pdf .local/business-proposal-tc/delivery/text-raw.txt
/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 .local/business-proposal-tc/verify.py
```

Final verification passed: 8 A4 pages, 8 editable tables, 6 preserved external hyperlinks, valid ZIP/XML, no tracked revisions/comments/placeholders, and every body/table paragraph present in the rendered PDF text. Recomputed unit contributions (11,400 / 7,800), monthly scenario (130,000 revenue / 125,000 cost), cost sensitivity (-5,400), resource scenario (342,000), and token allocation (100% / 100,000,000). All eight rendered pages were inspected at original resolution; after final number-wrap copy fixes, pages 4/6 were re-inspected and byte comparisons proved pages 1/2/3/5/7/8 unchanged from inspected images. Results and SHA-256 are in ignored `.local/business-proposal-tc/validation.json`.

Corrections before delivery: the initial render lacked Chinese glyphs; exposing existing system fonts through the task-local fontconfig resolved this. Initial font-corrected output had excess/blank pages; explicit leading, no grid snapping and heading-based page breaks produced eight clean pages. A paragraph-completeness check initially failed because layout extraction interleaved table columns; raw PDF reading order preserved complete cell paragraphs and passed the same full-text assertion. An optional `fitz` probe and an incorrect `pdftotext` wrapper path failed; the bundled renderer and discovered native Poppler executable completed the checks without new dependencies. Internal PDFs/PNGs are QA only.

Official Apple review rules, AdMob rewards policy and Base network documentation were read live on 2026-10-05. Source and final copy review kept NFT/wallet reward boosts conditional and outside the proposed Hong Kong iOS first release. No market traction, platform approval or real partner relationship was invented. The next proposal task is a partner-specific pilot statement of work and pricing worksheet; existing technical acceptance remains open.

Final repository checks: `git diff --check` and `git diff --exit-code -- docs/requirements.md docs/requirements.json` passed (exit 0). A bundled-Python check of the new Markdown and builder confirmed final newlines and no trailing whitespace. No application source or requirement register changed in this document task.

# App Store policy research — 2026-10-05

Research/documentation only. Read the current brief/register, AGENTS amendment, git status, implementation checkpoint, mobile environment/bundle guards and HealthKit configuration. Checked live official Apple review guidelines, HealthKit privacy, ATT FAQ, IAP, US storefront update and submission guidance, plus Google AdMob reward policy. Independent research passes compared NFT/storefront and health/advertising rules. Findings distinguish express rules from proposed HealthLoop designs and do not establish App Review approval.

Delivered `docs/APP_STORE_RELEASE_RESEARCH.md`; preserved existing code and proposal edits. No application, database, device, wallet or ad SDK tests were run in this task. No technical requirement or human acceptance was completed. No service was provisioned, payment made, transaction broadcast, Apple contact initiated or app submitted.

Executed document checks: `git diff --check -- docs/IMPLEMENTATION_STATUS.md docs/TEST_EVIDENCE.md` passed (exit 0), rerun after this entry; `git diff --exit-code -- docs/requirements.md docs/requirements.json` passed (exit 0), preserving the register. `git diff --no-index --check -- /dev/null docs/APP_STORE_RELEASE_RESEARCH.md` returned exit 1 for the new-file difference, with no whitespace diagnostics. A separate `python3`/`pathlib` check read that new report, asserted its final newline and absence of trailing spaces/tabs, and printed `New report whitespace check passed` (exit 0).

# Business research presentation checks — 2026-10-05

Documentation/artifact work only. Inspected the brief, all 58 requirements, existing source and concurrent changes, the prior business proposal, implementation status and dated application evidence. Official Hong Kong DH, Apple Support, Sweatcoin and Apple review-guideline sources were checked for the deck. The separate application's newly recorded 5 October evidence was incorporated; the older recording remains dated. This proposal session did not run primary research, an application suite, a native/device test, legal review or external deployment.

Delivered `docs/proposals/HealthLoop_Business_Proposal_Research_Report.pptx`: **19 editable slides with 19 populated notes pages**. The 17-slide template was filled and two backup slides added for economics and readiness. Its exact original is retained in `docs/proposals/templates/Business_Proposal_Research_Report_Template.pptx`; SHA-256 matched the attachment. Speaker notes contain full source locations and limitations. The builder and generated Markdown preserve the content; `python-pptx==1.0.2` is pinned in the separate proposal requirements.

Actual final commands, run from `/Users/wi/healthloop`:

```sh
/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/build-research-proposal.py
FONTCONFIG_FILE=/Users/wi/healthloop/.local/business-proposal/fontconfig.xml /Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/soffice -env:UserInstallation=file:///Users/wi/healthloop/.local/business-proposal/lo-charter --headless --convert-to pdf --outdir /Users/wi/healthloop/.local/business-proposal docs/proposals/HealthLoop_Business_Proposal_Research_Report.pptx
/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm -scale-to 1440 -png /Users/wi/healthloop/.local/business-proposal/HealthLoop_Business_Proposal_Research_Report.pdf /Users/wi/healthloop/.local/business-proposal/slide
/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 .local/business-proposal/check_presentation.py
```

All four final commands passed with exit 0. The task-local checker matched **289 text shapes** to actual PDF text, found no text/frame overflow or divider intersections, parsed **93 Office XML/relationship parts**, confirmed **5 external source hyperlinks**, found no unresolved content placeholders and checked every slide's notes. Independent recalculation of the three financial scenarios, both break-even counts and two sensitivities passed. `.local/business-proposal/qa.json` records zero final issues.

Initial rendering used unsuitable fallback fonts, including a distorted plus sign. Visual/geometry checks also identified overlong frames and a divider crossing on slide 17. Corrected these before delivery by using macOS `Charter` for the template's Charter typography, exposing system fonts only through a task-local renderer configuration and adjusting affected copy/frames. Every rendered slide was visually inspected. Later copy edits changed only slides 12/13, which were re-inspected. The final evidence refresh changed only slides 8/16, which were also re-inspected; PNG hashes confirmed the remaining previews were identical to reviewed versions. Internal PDF/PNG/checker files stay ignored; the requested deliverable is the PPTX. `git diff --check` passed with exit 0 after the checkpoint write.

No technical requirement acceptance, human review or external approval was advanced. Primary-research findings, prices, future pilots and economic results remain labelled as proposed or unvalidated. Next proposal task: prepare the consent/recruitment protocol before fieldwork. Current app and optional-incentive changes belonging to other sessions were preserved.

# X to Earn mobile revision — 2026-10-05

Scope: current Simplified Chinese onboarding and four mobile tabs, canonical mission progress, accepted-summary claim recovery, and the existing core reward/privacy flow. No real health values were used. No external deployment, provisioning, publication, wallet connection or transaction broadcast occurred. No B/C human acceptance is inferred.

Environment: macOS26.3, Xcode26.3/17C529, bundled Node24.19.0, pnpm11.19.0, PostgreSQL17.11. Expo55.0.31/React Native0.83.10 and the dependency lockfile are unchanged. Commands use:

```sh
export PATH="/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
pnpm check
pnpm typecheck:edge
pnpm test:edge
pnpm mobile:bundle
git diff --check
```

| Executed check | Actual outcome / boundary |
|---|---|
| `pnpm check` | Exit0: zero-warning lint, root/mobile TypeScript, **355 tests / 20 files**, **34 client files / all 58 B/C requirement assignments**. Includes missing-vs-zero data, highest-tier top-up previews, accepted-summary claims, rollover, offline/consent/review actions, original-key recovery and stale-account/cancelled results. |
| `pnpm typecheck:edge` | Exit0 for core handler and deletion worker. |
| `pnpm test:edge` | Exit0: **34 tests** (30 core HTTP/schema/Auth-boundary tests + 4 worker-scope tests). |
| `pnpm mobile:bundle` | Exit0: **853 modules**, one iOS Hermes bundle; real `HealthLoopHealth` present, synthetic provider/policies absent. Metro emits its existing NO_COLOR/FORCE_COLOR warnings; no build failure was suppressed. |
| `pnpm test:db` | Exit0: **68 SQL groups**, including 100-way concurrency, immutable accounting, RLS, consent/deletion, exact cutoff, reviewed corrections, and six new canonical-progress groups. |
| `pnpm test:integration` | Final exit0: **25 tests** through the real handler/client/PostgreSQL with explicitly injected synthetic Auth/transport. Added direct claim recovery proves original-key replay after response loss, no new activity upload and exactly one ledger award. |
| `HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm test:local --reporter=verbose --disableConsoleIntercept` | Exit0: **one sequential scenario / six groups**, actual local OTP/Auth (ES256), Edge, PostgREST, claim/ledger, RLS, preferences/export, refresh/logout and scoped durable deletion retry. Generated accounts/activity are synthetic and cleaned up. This is not native HealthKit evidence. |
| Expo prebuild / CocoaPods | `pnpm --filter @healthloop/mobile exec expo prebuild --platform ios --no-install` passed; package manifest unchanged. `pod install` passed with **97 Pods** in the ignored generated iOS project. Existing no-app-icon warning remains a release-artwork task. |
| Xcode simulator Release | Fresh ad-hoc simulator build passed exit0 in **148seconds** with zero compiler-error lines; the final incremental rebuild passed exit0 in **18seconds** and includes the final claim/UI changes. Exact command and final artifact are below. No physical-device signature or install was performed. |
| Simulator UI walkthrough | **Not run.** `cua.getApp('Simulator')` reported the Mac locked and automatic unlock unavailable. The operator was asked to unlock while independent work continued. No screenshot or interaction was fabricated or substituted. |

The database runner was pointed only at a newly created disposable `healthloop_test_earn_20261005` database in the existing `.local/pg17` cluster, bound to `127.0.0.1:55432`. It loaded every migration in order including `202610050001_mission_progress.sql`. Exact environment for the two SQL-backed suites:

```sh
HEALTHLOOP_TEST_DATABASE_URL=postgres://healthloop_local@127.0.0.1:55432/healthloop_test_earn_20261005 HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:db
HEALTHLOOP_TEST_DATABASE_URL=postgres://healthloop_local@127.0.0.1:55432/healthloop_test_earn_20261005 HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:integration
```

The new SQL groups verify a null unread summary and zero balance; distinct accepted dates without posting points during reads; weekly progression independent of daily claims; pending downward/excessive revisions preserving canonical history; cross-user isolation; exact Hong Kong midnight/Monday rollover; pinned weekly goals across later versions; and inactive/anonymous rejection. Original accounting tests remain unchanged and passed.

Two initial checks failed and were repaired, then rerun: ESLint discovered the old ignored `.local/proposals/github-verify-20260928` checkout and could not infer one TSConfig root; the config now names this root and excludes only ignored local/artifact copies. Edge typecheck exposed its older import map targeting only `schema.ts`; the map now targets the domain public `index.ts` which exports the new mission contract. An initial newly written test fixture also needed a literal error-code type; no production validation was loosened.

The first `local:start` attempt failed because Docker Desktop was stopped (no Docker socket). After starting installed Docker Desktop, the guarded launcher passed and verified that this project's API54321/DB54322/Mailpit54324 bindings are loopback only. `pnpm exec supabase migration up --local` successfully applied the one new forward migration without resetting the stack. The real local HTTP suite then passed against `local:serve`, restoring the original seed demo mode. The synthetic stack is not a physical-device health backend.

Native build command, from `apps/mobile/ios`, with the public-only loopback development/real configuration supplied to the child process:

```sh
xcodebuild -workspace app.xcworkspace -scheme app -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /Users/wi/healthloop/.local/earn-20261005/derived -jobs 4 CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES DEVELOPMENT_TEAM= build
```

The local helper reads the guarded CLI status in memory, verifies the public key's `anon` role, strips any service/private-secret environment variables and bounds the build process. No key was printed or persisted in mobile source/env files. Native application: `.local/earn-20261005/derived/Build/Products/Release-iphonesimulator/app.app`; build log and verification JSON are retained in `.local/earn-20261005/`. `codesign --verify --deep --strict` passed. Embedded bundle checks confirm the public loopback configuration, real native HealthKit module and new claim UI/recovery code; the service-role key and synthetic provider are absent. Final main.jsbundle SHA-256: `f192a3128e0a0907f2412114c27cb2d95e9b2a3b399b20800b9ea2221a0d40fa`. This proves compilation/bundle/signature checks only, not native runtime, authorization, layout or Keychain behavior.

Cleanup completed: the real local stack contained **0 Auth users, 0 active profiles, 0 health summaries and 0 pending deletion jobs**, with seed `demo_mode=true`, after the HTTP test cleanup. The task-owned Edge serve process ended with the intentional SIGINT exit130. `pg_ctl -D .local/pg17 stop -m fast` and `HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm local:stop` both completed; the latter verified the HealthLoop stack stopped with volumes preserved. Source, dependencies, generated native project, simulator artifact and disposable database files are retained. Docker Desktop itself was not shut down globally. No background task runner or automatic continuation remains.

The concurrently edited root AGENTS.md, scope-status note and business-proposal files were preserved. The optional NFT/wallet/rewarded-ad amendment is scope documentation, not functionality tested in this revision. Final `git diff --check` passed; package manifests and pnpm-lock.yaml remain unchanged.

Remaining manual acceptance: unlocked simulator navigation, form/keyboard access, failed request/recovery UI, very large text and VoiceOver; actual HealthKit read/source metadata/lifecycle on two iPhones; physical-device signing; real operator review. Prior 2026-09-28 UI evidence belongs to the earlier source and is not reused as acceptance of these changed screens. The next executable check is the current-source simulator walkthrough described in IMPLEMENTATION_STATUS.

# Optional activity incentive instruction amendment — 2026-10-05

Documentation-only change requested by the user: root `AGENTS.md` now permits optional NFT purchase, verified wallet connection and completed rewarded ad views to unlock or increase capped rewards for verified activity goals. `DECISIONS.md` and `IMPLEMENTATION_STATUS.md` record the scope override, unchanged privacy/accounting/external-action boundaries and next implementation slice. No requirement ID is newly implemented or accepted. Pre-existing mobile/backend edits belong to other work and are not evidence for this amendment.

Executed checks:

- `git diff --check -- AGENTS.md docs/IMPLEMENTATION_STATUS.md docs/DECISIONS.md docs/TEST_EVIDENCE.md` — passed, exit 0; rerun after this evidence entry was added.
- `git diff --exit-code -- docs/requirements.md docs/requirements.json` — passed, exit 0; the original 58-ID register and owner/reviewer assignments were not edited. The amendment explicitly takes precedence over conflicting historical scope text.
- Reviewed the scoped document diff. No application, database, native, wallet or advertising-provider tests were run for this documentation-only change. No external provisioning, purchase, deployment or transaction was performed. Feature implementation, provider configuration and real device/wallet evidence remain outstanding.

# Proposal and source delivery checks — 2026-09-28

Application source was unchanged in this documentation and publication session. `PATH='<bundled Node24 bin>:/opt/homebrew/bin:$PATH' pnpm check` completed with exit0: zero-warning ESLint, root/mobile TypeScript, **322 tests / 17 files**, and **27 client files / 58 requirement assignments**. Database, Edge, native build and device suites were not rerun; their earlier results retain their recorded dates and scope. Two new Simplified Chinese proposals are decision documents, not implemented Web3 functionality or approval to issue a token. Final artifact and upload checks are recorded in GITHUB_BACKUP.

The pre-upload audit inspected all261 reachable historical blobs, including Office XML; no likely live credentials/private keys were found. Contextual matches were local CI/test fixtures. The original history bundle remains unchanged. CLI push dry-run failed because no noninteractive login credential was available; the authorized GitHub connector is used for the snapshot transfer. This focused pattern review is not an independent security audit. Only the processed, OTP-masked recording and its public metadata are eligible for upload; raw recordings, local environment files, ignored runtime data, dependencies and generated native build output are excluded.

Both Word documents were generated with the bundled Python3.12 / python-docx1.2.0 using `scripts/build-proposals.py`, and rendered with the documents skill's `render_docx.py` and bundled LibreOffice. The first preview failed the visual gate because Chinese fonts were missing; selecting the bundled `FONTCONFIG_FILE` with system font directories and removing theme-font overrides resolved it. The template's title border and several awkward number/Latin line breaks were also corrected before delivery. Final **8-page business** and **12-page tokenomics** documents passed inspection of every rendered page at original resolution; amended tokenomics pages2/8/10 were re-inspected and all other pages were pixel-identical to the inspected version. Internal PNG/PDF previews stay ignored. Allocation totals, business scenarios, sensitivities, vesting and reward/cash arithmetic were independently checked. Document ZIP/XML/hyperlink checks and `git diff --check` passed. These checks validate the proposals, not real customers, revenue, token issuance or native health integration.

# Successful simulator login and recorded walkthrough — 2026-09-28

The desktop was unlocked on retry. The actual native app completed local email OTP login, adult-only onboarding with optional choices off, all four tabs, reminder preference save, export share-sheet opening/cancellation, authenticated cold restart, logout and a second cold restart that stayed logged out. The recorded path used a disposable local account, real local Auth/Edge/PostgreSQL and no health readings or uploads. Source under the reused simulator binary remains `5e61056`; no application code changed. Detailed operations, input-tool limitations and untested cases are recorded in [SIMULATOR_WALKTHROUGH_20260928](SIMULATOR_WALKTHROUGH_20260928.md). Prior failed attempts remain below as history.

The processed MP4 is6:36 /5.3MB with an OTP-area mask and a persistent simulator-test label. FFprobe metadata, full-video decode and visual contact-sheet checks passed;87 sampled final frames had zero six-digit OCR matches. The exact synthetic account was removed through normal local deletion plus a single-job-scoped worker after recording; this is not a UI deletion test. Backend processes/project containers and only the task-owned simulator were stopped, with database volumes/source/app/media retained. `demo_mode=true` remained unchanged. No application suites were rerun; `git diff --check` passed for this documentation-only checkpoint.

# Simulator walkthrough recording attempt — 2026-09-24

The operator requested an actual simulator login, interface walkthrough and video. Starting source was `8261afc`, with a clean tracked worktree. The existing configured, ad-hoc signed simulator app passed `codesign --verify --deep --strict`; the dedicated `HealthLoop Native Smoke 20260924` simulator was verified by its saved local state and booted successfully using `simctl boot` / `bootstatus -b`. The installed `simctl recordVideo` interface and local FFmpeg tools were inspected, and an ignored recording directory was prepared.

**The UI walkthrough and recording did not run.** Both attempts to connect the computer-use tool to Simulator returned that the Mac was locked and automatic unlock was unavailable. The operator was asked to unlock the Mac manually. No alternative input mechanism was used to bypass the lock. No OTP was requested or entered, no new account or consent was created, and no health query, points claim or video evidence was produced by this attempt. Prior HTTP-suite and startup evidence below retain their original scope; they do not establish mobile login success.

`HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm local:start` passed: the three published ports were loopback-only and the database was healthy. Read-only counts showed zero Auth users, active profiles, summaries/submissions and pending deletions; four historical deleted profiles remained. Seed `demo_mode=true` was unchanged. `local:serve` was not started. `pnpm local:stop` with the same local-only guard passed exit0, removed the project containers and retained both project data volumes. Only the task-owned simulator was shut down; its installed app, source and dependencies were retained. `git diff --check` passed for this documentation-only checkpoint; no application test suite was rerun.

Resume after the Mac is unlocked: start the loopback backend, use a disposable `local.invalid` account through the real email-code UI, confirm adulthood with optional health/cloud/marketing choices off, inspect all four tabs and empty-data states, restart to verify secure-session restoration, then log out and restart again. Record the simulator display, redact any OTP-entry frames before sharing, and verify the resulting video. Real HealthKit and reward completion remain outside this empty-data simulator walkthrough. B/C review remains pending.

# Actual local Auth and native app checkpoint — 2026-09-24

Continued locally from `5e61056` on `codex/resume-core`. P01/P08/P13–P15/P25/P26/P29/P31/P36 now have evidence from real local Auth/PostgREST/Edge services with synthetic accounts/activity; P03/P32 additionally have successful native compilation and simulator startup evidence. All B/C owners and pending human reviews are preserved. This is **not** physical-device HealthKit acceptance, a completed product or permission to release.

## Executed checks

Node24.19.0 and pnpm11.19.0 were used throughout. Supabase CLI is now pinned to **2.117.0** in the root manifest/lockfile. Docker Desktop4.92.0 / Engine29.8.0 / CLI29.8.1 and Deno2.7.1 were available. The standalone SQL suite used PostgreSQL17.11; the full Supabase stack used its pinned `postgres:17.6.1.167` image, Auth `v2.196.0`, PostgREST `v16.2`, Edge runtime `v1.74.3`, Mailpit `v1.30.2` and Kong `2.8.1`.

| Actual command / operation | Result and evidence boundary |
|---|---|
| `pnpm install --frozen-lockfile --offline` | Passed with the updated pinned CLI dependency and lockfile |
| `pnpm check` | Passed: zero-warning ESLint, root/mobile TypeScript, **322 tests / 17 files**, **27 client files / 58 requirement assignments** |
| `pnpm test:db` | Passed: **62 PostgreSQL groups**, including two 100-way claims, 100-way approval replay and preference retry |
| `pnpm test:integration` | Passed: **23 tests** through the shipped controllers/client/handler and real SQL; these older tests still inject Auth/PostgREST adapters |
| `pnpm typecheck:edge` | Passed for the core handler and actual deletion worker |
| `pnpm test:edge` | Passed: **32 tests**, including four new deletion-scope regressions |
| `pnpm mobile:bundle` | Passed: real iOS Hermes export and synthetic/Lab isolation; 845 modules, about3.4MB |
| `pnpm mobile:preflight` | Passed on this Mac: Xcode first-launch/CoreSimulator prerequisites now available |
| Fresh iOS prebuild / `pod install` | Passed: 98 dependencies / 97 installed Pods; HealthKit retained, APNs excluded |
| Actual unsigned generic iPhoneOS Debug build | Passed: real Swift/C compilation and link, including HealthLoopHealth; unsigned, JS bundling deliberately skipped for this device artifact |
| Actual iOS Simulator Release builds, install, launch | Passed with embedded JavaScript. Unconfigured guard and then **configured Chinese login screen** inspected. The final simulator build uses local ad-hoc signing; this is not physical-device signing. |
| Initial unwrapped Supabase start | Migrations/seed succeeded, but actual ports bound to all interfaces despite the network default. Stopped before test accounts/data were created. |
| `HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm local:start` | Passed with the project adapter, including an idempotent repeat after the network-ownership patch. Actual API54321, DB54322 and Mailpit54324 bindings all `127.0.0.1`. |
| `HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm local:serve` | Started the actual core Edge runtime using the ignored test/real local environment |
| `HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm test:local` | Passed: **one sequential real HTTP scenario / six labeled groups**, first run7.60s |
| Same local test with `--reporter=verbose --disableConsoleIntercept` | Passed again in3.91s, without resetting the DB; six PASS groups captured in ignored `.local/local-http-evidence.log` |
| Post-run SQL/JWKS inspection | **0 Auth users, 0 active profiles, 0 pending deletions, 0 summaries; demo_mode restored to true**. Auth signing algorithm observed: **ES256**. No keys, OTPs, JWTs, email contents or subject identifiers were printed. |

The standalone resettable SQL suite used only `postgres://healthloop_local@127.0.0.1:55432/healthloop_test_flow` with `HEALTHLOOP_ALLOW_DB_RESET=local-only`. Its task-owned `.local/pg17` cluster was started on loopback with max_connections160 and stopped successfully after the 62+23 checks. It was never pointed at the Docker Auth database.

Exact native commands, source (`5e61056`, app code unchanged by this continuation), build paths, screenshots and limitations are in [NATIVE_BUILD_EVIDENCE](NATIVE_BUILD_EVIDENCE.md). The isolated native worktree is `/Users/wi/healthloop-worktrees/native-build-20260924`. At the readiness check this Mac had **zero valid code-signing identities**; no signing identity/device ID was logged.

## What the new real HTTP suite actually proves

`scripts/local-stack.http.mjs` calls real local HTTP endpoints using the production typed API client; it does not inject the handler, an Auth shim or pre-made authenticated claims. The service-role key is used only inside the trusted test/worker process for narrowly scoped synthetic setup/recovery. Ordinary business requests use actual Auth-issued user tokens.

1. Local OTP email delivery to Mailpit; wrong and consumed codes rejected; correct OTP produces a recent signed OTP AMR. A changed token signature and anonymous account/table access are rejected. ES256 was observed. The core's `verify_jwt=false` remains deliberate: handler `getUser` validates the token and PostgREST validates the same bearer token. The gateway verification switch is **not** claimed enabled.
2. Consent → **synthetic native-shaped** 3,000-step minimum summary → server mission →10points → exact retry → one reconciled ledger entry. No HealthKit source was read or fabricated on a device.
3. Actual PostgREST user-A/user-B isolation, direct-ledger-write denial, foreign mission rejection and consent withdrawal blocking further upload/awards.
4. Default-off reminder preferences, exact retries, stale revision rejection and isolated export work independently of health consent. No OS notification delivery was tested here.
5. Real refresh and logout revoke the refresh session; the cleared caller cannot make another authenticated request. This does not claim issued access JWTs instantly expire on logout.
6. Recent real OTP authorizes durable deletion. Business APIs immediately reject the inactive account. The test pauses after actual core purge/Auth removal, then invokes the production Deno worker. An explicit job allowlist completes A while B remains pending and present in Auth; a later run finishes B, tolerates the interrupted Auth deletion, and repeated execution is safe. Auth and core reject the old tokens. Cleanup deletes only this run's tagged synthetic accounts.

The suite refuses an occupied or remote stack, serializes its runs, restores the seed mode and does not reset schemas. Its error boundary withholds raw HTTP/PG/process details. `HEALTHLOOP_DELETION_JOB_IDS` narrows the actual worker after reading the queue, closing the check-then-run race identified during review; explicitly empty/malformed scopes fail closed. The default worker still processes its ordinary pending queue when no scope is configured.

## Actual environment issues and fixes

- Initial image pulls blocked in six old `docker-credential-desktop` helpers. The root-owned `/usr/local/bin` link still referenced the retained Docker4.49 backup. Only this task's stalled processes were stopped; a user-owned `/opt/homebrew/bin/docker-credential-desktop` link to the verified current Docker app restored pulls. No Docker login, password, factory reset or global settings change occurred.
- CLI2.117 deprecates `[inbucket]`; config now uses `[local_smtp]` with the same local port/template. The old asymmetric-JWT rationale was removed from the core gateway comment without weakening its handler/RLS authentication.
- The documented Docker network default did not constrain actual Desktop port forwarding. The project-only `scripts/local-backend.mjs` / `docker-loopback.mjs` adapter sets explicit bindings, checks project/network ownership and selected Docker state, rejects unsupported publication and filters credential-bearing CLI output before private logging. **48** focused guard regressions are included in the322-test total. Original task-owned CLI logs were sanitized in place; no credentials were committed.
- The first unauthenticated HTTP probe returned503 while Edge runtime setup was still underway. No success was inferred from that probe; both complete HTTP runs subsequently passed.
- The configured but completely unsigned simulator build showed an expired-session banner. Runtime evidence identified Keychain OSStatus-34018/missing application-identifier entitlements. Rebuilding the **simulator only** with local ad-hoc signing fixed the startup; before/after JavaScript bundles are byte-identical. SecureStore/auth code was not weakened. Actual build/signature/screenshot evidence is in NATIVE_BUILD_EVIDENCE.

## Remaining evidence gates

**Zero real-iPhone HealthKit acceptance and zero wallet acceptance were added.** The final configured simulator displayed a clean initial login screen after local ad-hoc signing. No OTP was entered on the simulator, so it does not prove native authenticated session persistence. Signed iPhone installation, native configured account/session lifecycle, HealthKit reads/source metadata, real notification delivery, VoiceOver and large text remain device work. OTP expiry/resend throttling, access-token expiry, real MFA/operator enrollment and external SMTP delivery are not covered by these six groups.

P20/P22 admin/version-publishing UI and role management, P25/P27 retention scheduling/backup-deletion replay, metadata cleanup, sponsor isolation, first-party metrics, store/privacy materials and the independent Lab remain incomplete. No human B/C acceptance, legal approval, independent audit or remote CI run is claimed. Full local test success does not make the retained `demo_mode=true` stack suitable for real-device health data.

The foreground Edge serve process was intentionally interrupted (exit130); `HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm local:stop` then passed exit0. Final `docker ps` was empty and the two project data volumes remained. The task-owned simulator and standalone PostgreSQL cluster were stopped. Docker Desktop itself remains available. No background continuation is running. The final launcher stop-exit check also passed focused ESLint and all48 guard tests.

Sources/dependencies and new local commits are retained. No public push, paid action, production change, remote provisioning or chain broadcast occurred. See [LOCAL_STACK_TESTING](LOCAL_STACK_TESTING.md) for exact safe start/test/stop commands and [CONTINUE_PROMPT](CONTINUE_PROMPT.md) for the next executable work.

The records below retain their original dates and scope.

---

# Docker host prerequisite recovered — 2026-09-22

Docker Desktop **4.92.0**, Engine **29.8.0**, normal-shell CLI **29.8.1** and Compose **5.5.1** are installed and working. `docker version`, `docker info`, `docker desktop status`, Compose version and an actual `docker run --rm --network none hello-world` passed. The Desktop UI showed Engine running. Installation integrity, permission/launch repairs, rollback location and exact evidence are in [DOCKER_SETUP_EVIDENCE.md](DOCKER_SETUP_EVIDENCE.md).

This removes the previously observed Docker startup blocker. **No HealthLoop application tests, full Supabase Auth/Edge, native build or real-device checks were run in this environment-only session.** Docker remains running; the smoke-test container was removed. Source/dependencies were preserved. The earlier sudo replacement request is obsolete; do not rerun it. The results below retain their original dates and scope.

---

# Local app reminders and native readiness — 2026-09-20

Continued locally from `0e42001` on `codex/resume-core`. Applicable AGENTS instructions were supplied again by the user and followed. P29 is now implemented through the account API/database, the shipped mobile controller/settings and the iOS local notification driver; P25/P26/P31/P36 protections and P03/P32 native diagnosis were advanced. **This is not a completed app release or device acceptance.** B/C ownership and all 58 requirements are unchanged. Source/dependencies are retained; no public push, production change, paid build or blockchain action occurred.

## Final executed checks

Root commands used Node **24.19.0** from `/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`, pnpm **11.19.0**, PostgreSQL **17.11** and Deno **2.7.1**. Added only pinned `expo-notifications` **55.0.27** and its lockfile dependencies, as specified by the installed Expo SDK55 compatibility metadata and [versioned official API](https://docs.expo.dev/versions/v55.0.0/sdk/notifications/).

| Actual command / check | Outcome and limit |
|---|---|
| `pnpm install --frozen-lockfile --offline` | Passed, exit0; final manifests/lockfile consistent with locally cached dependencies |
| `pnpm check` | Passed, exit0; ESLint zero warnings, root/mobile strict TypeScript, **269 tests / 15 files**, **27 client files / 58 requirement assignments** in boundary checks |
| `pnpm test:db` | Passed, exit0; **62 PostgreSQL groups**; two 100-way claim runs, 100-way approval replay and 100-way identical preference retry |
| `pnpm test:integration` | Passed, exit0; **23 tests**, including the shipped reminder controller → typed client → actual Edge handler → real PostgreSQL with an injected native driver |
| `pnpm typecheck:edge` | Passed, exit0; core and deletion-worker checks |
| `pnpm test:edge` | Passed, exit0; **28 tests** |
| `pnpm mobile:bundle` | Passed, exit0; **845 modules**, 3.4 MB Hermes bundle; real HealthLoopHealth module present, synthetic provider/policy excluded |
| `pnpm mobile:preflight` | **Exit1**, correctly reports incomplete host prerequisites; Xcode first-launch status exit69, missing XcodeSystemResources receipt and CoreSimulator framework. Final inspection: 152 GiB free, zero existing first-launch processes. Device `.env` was not supplied/validated. |
| Fresh Expo iOS prebuild | Passed twice in the native-readiness worktree; final generation excludes APNs entitlement, remote-notification background mode and Push capability, retains read-only HealthKit |
| Fresh `pod install` | Passed; 98 Podfile dependencies / **97 installed Pods**, including HealthLoopHealth and ExpoNotifications55.0.27 |
| Actual unsigned generic iPhoneOS `xcodebuild` | **Exit70 before source compilation**; missing CoreSimulator prevents loading IDESimulatorFoundation. No compile/link/install success. |
| Bounded `docker info --format '{{.ServerVersion}}'` | **12-second timeout**; server readiness not established. Supabase CLI lookup: not installed. Full local Auth/Edge stack was not started. |
| `git diff --check` | Passed for current source/document changes |

Exact root database execution:

```sh
export PATH="/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
export HEALTHLOOP_TEST_DATABASE_URL="postgres://healthloop_local@127.0.0.1:55432/healthloop_test_flow"
export HEALTHLOOP_ALLOW_DB_RESET=local-only
pnpm test:db
pnpm test:integration
```

The task restarted its existing disposable `.local/pg17` cluster with loopback-only port55432 and max_connections160. Root used only `healthloop_test_flow`; backend/API worktrees used a newly created `healthloop_test_preferences`. Those are dedicated synthetic test databases; resetting schemas is not safe for a real device or shared database. After final checks, `/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D /Users/wi/healthloop/.local/pg17 stop -m fast` succeeded. No startup service/background continuation was enabled. Sources, dependencies and local database files remain available.

## Newly exercised behavior and actual fixes

- Default-disabled account preferences work without health/cloud/marketing consent. Strict HH:mm, overnight/daytime quiet boundaries, own-account RLS, direct-write denial, identical replay, stale/future revisions, competing changes, rate-budget-safe disable, rollback, export and deletion/old-session rejection passed actual SQL tests. No client-defined reward amount or completion flag was added.
- The shipped controller requests permission only after explicit enable/save, installs a reminder only after the server confirms preferences, and never treats a draft as authorization. Local stop survives offline relaunch and lost responses; generation/edit/read guards prevent late enabled results, older canonical reads and account-A native operations from replacing B's state. Native scheduling/permission tests use injected drivers, not OS delivery.
- Optional notification storage/permission/invalid-response/network failures stay scoped to reminders. Real Auth/session failures still propagate. The actual consent controller remains online in the notification-only failure regressions. Partial native scheduling failures trigger cancellation and show an unconfirmed state.
- Authenticated deletion continues after optional reminder cancellation fails while preserving mandatory reauthentication and health-withdrawal checks. A delayed optional cleanup cannot advance deletion against a replacement account.
- Read-only review identified incomplete SecureStore chunks being treated as absent markers. The shared storage adapter now rejects corrupt, mixed-key/version, missing and truncated records without exposing contents. A regression uses the actual chunked storage implementation, removes the stop-marker chunk and restarts storage/controller; no reminder is installed.
- The first combined `pnpm check` failed mobile TypeScript on newly added storage test indices (`string | undefined`). The test fixtures were narrowed correctly; final strict typecheck and all tests passed. The check was not suppressed or weakened.
- Expo's automatic notifications configuration initially added APNs. A local-only config plugin removed that capability and a second actual prebuild verified the generated result. Current source has no push-token registration or remote notification service.

Detailed native commands, package receipt observations, logs and operator repair steps are in [NATIVE_BUILD_EVIDENCE](NATIVE_BUILD_EVIDENCE.md) and [DEVICE_SETUP](DEVICE_SETUP.md). `xcodebuild -runFirstLaunch` can agree to a license and needs administrator component installation on this Mac; it was not invoked by this follow-up. No unrelated installer or Docker process was killed. The native build worktree used the then-current dependency/config/plugin copies; generation does not prove the latest mobile UI compiles natively.

## Evidence boundary and next action

**Zero real-iPhone acceptance, zero native compile/link/install, zero true OTP/MFA end-to-end and zero wallet acceptance results were added.** Integration authentication/PostgREST are injected test adapters; OS permissions/scheduling and SecureStore driver IO are injected. Real PostgreSQL transactions and the production handler/client/controllers were executed. None of these tests substitute for a signed app, actual HealthKit readings, APNs (unused), notification delivery or human B/C review.

Next: operator completes Xcode's supported first-launch installation; rerun `pnpm mobile:preflight`, synchronize/regenerate current native code, install Pods and perform actual compilation. Restore responsive Docker/local Supabase, configure a real local Auth session, then sign/install with an available Team and run the two-iPhone core/reminder matrix. No iPhone/signing availability was confirmed in this session. Independent remaining code work includes P20/P22 admin/version publishing, P25/P27 retention/restore, sponsor separation, first-party metrics and the isolated Lab after core dependencies. Current paths and continuation instructions are recorded in IMPLEMENTATION_STATUS, UNFINISHED_REPORT and CONTINUE_PROMPT.

The following entries are historical and retain their original results.

---

# Restored local development checkpoint — 2026-09-20

The user changed strategy after the verified GitHub backup/cleanup and requested continued work on this computer. Restored remote base: `659580f11e263fde551e49f63dbab0df6a18dd32`. Current working tree is `/Users/wi/healthloop`, branch `codex/resume-core`; `/Users/wi/web3 health` is a compatibility symlink. Source and dependencies are retained. This continuation is local; no new public push, paid action, production change or blockchain broadcast occurred.

## Executed final checks

All Node commands used `/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` first in PATH; verified Node **24.19.0**, pnpm **11.19.0**, unchanged lockfile. Separate accounting/API/mobile worktrees were reviewed and integrated. New code is in migration `202609200002_appeal_adjustments.sql`, shared schemas/client/Edge, mobile reward/appeal screens/controllers and `scripts/vertical-slice.db.test.mjs`.

| Executed command / check | Actual outcome |
|---|---|
| `pnpm install --frozen-lockfile` | Passed, exit0; 681 packages reused, no dependency upgrade |
| `pnpm check` | Final pass, exit0; zero-warning ESLint, root/mobile strict TypeScript, **200 tests / 12 files**; boundary checks: **23 client files, all 58 B/C assignments** |
| `pnpm test:db` | Passed, exit0; **48 PostgreSQL groups**, including two 100-way claim batches and one 100-way approval replay batch |
| `pnpm test:integration` | Final pass, exit0; **16 tests**, including the shipped reward controller through real SQL after simulated restart/response loss |
| `pnpm typecheck:edge` | Passed, exit0; core and deletion-worker Deno checking |
| `pnpm test:edge` | Passed, exit0; **22 tests** |
| `pnpm mobile:bundle` | Final pass, exit0; **783 modules**, 3.3 MB iOS Hermes export; real HealthLoopHealth reference present, synthetic provider/policy excluded |
| `git diff --check` | Passed for the continuation changes |
| `xcodebuild -checkFirstLaunchStatus` | Exit69; native host setup remains incomplete |
| Required CoreSimulator framework | Absent at `/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/CoreSimulator` |
| Bounded `xcrun simctl list devices available` | Timed out after 15 seconds |
| Bounded `docker info --format '{{.ServerVersion}}'` | Timed out after 15 seconds |

Final root database/integration commands:

```sh
export PATH="/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
export HEALTHLOOP_TEST_DATABASE_URL="postgres://healthloop_local@127.0.0.1:55432/healthloop_test_flow"
export HEALTHLOOP_ALLOW_DB_RESET=local-only
pnpm test:db
pnpm test:integration
```

This newly created disposable PostgreSQL17 cluster is at `.local/pg17`, loopback-only port55432, test-only local trust role `healthloop_local`, max_connections160. After all final checks, `pg_ctl -D /Users/wi/healthloop/.local/pg17 stop -m fast` completed successfully. Source, dependencies and disposable database files are retained; no startup service was enabled. Root used `healthloop_test_flow`; worker accounting used `healthloop_test_adjustments`; restored baseline used `healthloop_test_core`. The runners restore the original server clock after fixtures. Never run the resetting test runner against shared development, device, production or remote data.

## Newly exercised behavior

- P21/P12/P13/P19/P22: stored pending-revision proposal, separate server operator/reviewer and signed assurance checks, self-review denial, exact replay/body conflicts, daily/weekly compensation, first positive correction with no prior entry, true negative balances after spending, stale proposals, rejected/paused/withdrawn/deleted boundaries, independent reviewer/claim/redemption races, forced second-post rollback, ordered reciprocal account locks, cursor ties, latest-revision risk resolution and complete-week retention. Ordinary sync/claim can safely restore a previously reversed entitlement through posting epochs without exceeding its net cap.
- P16/P17/P15: real server catalog/stock, demo-only codes, exact debit/reservation, last-item contention, own-account history, cancellation/refund after withdrawal and existing-key recovery without permitting new spend. Mobile persists only account-scoped operation UUIDs; restart recovery uses the original key. The shipped controller, typed client, HTTP handler and real SQL were exercised together.
- P25: review export excludes reviewer identities/snapshots; subject purge/retention removes review reasons/evidence while preserving immutable ledger/audit. Review snapshots expire when the earliest captured week date expires. These tests do not approve retention policy or prove the live Auth deletion worker.
- Client concurrency: delayed SecureStore chunk reads now serialize with writes/removes. A→B→A and offline/reconnect intent recovery, slower duplicate restore, and outdated accounting reads have targeted regressions. Device-native lifecycle behavior still requires real hardware evidence.
- Independent read-only SQL review found no blocking accounting/privilege flaw within its scope. It found demo admin schema mismatch; those new administrative routes now explicitly return `404 NOT_SUPPORTED` in the isolated demo Edge build, with a regression test. Real schemas remain native-source-only. This review is not an external audit.

## Actual intermediate failures and resolution

The first restored `pnpm check` found 192 lint errors because temporary worktrees were nested under the main checkout and discovered as extra TypeScript roots. Worktrees moved outside the source tree to `/Users/wi/healthloop-worktrees`; the unchanged lint gate then passed. A new response-loss integration fixture initially dropped a successful **GET** history read instead of only its intended redemption POST; narrowed the fault injector to POST and the full 16-test suite passed. Neither failure was suppressed.

Review found that chunked storage reads waited for an existing write but were not themselves queued, allowing a following remove to delete chunks during the read. Per-key FIFO now covers the entire read and its regressions pass. Accounting refreshes now reject stale results after newer accounting is applied; uncertain operations retain their original request/refresh intent. All final affected checks were rerun after these code changes.

## Evidence boundary and remaining work

**Zero native compile/link/install records, zero real-iPhone acceptance records, zero real OTP/MFA end-to-end records and zero wallet acceptance records were added.** PostgreSQL and cross-layer tests use synthetic users/values and privileged injected Auth claims. The actual HTTP handler runs in process with an injected Auth/PostgREST adapter; it is not a deployed gateway or true signed-session verification. Mobile controller tests use in-memory storage or a delayed storage driver, not real device Keychain. JavaScript export is not native compilation.

Disk pressure is resolved (about159 GiB free at restore), but missing CoreSimulator/first-launch setup and an unresponsive Docker server still block native and full local Supabase evidence. Browser admin/version publishing, real MFA and operator walkthrough, privacy scheduling/backup restore, sponsor separation, notifications/metrics, device accessibility and the independent testnet-only Lab remain open. All 58 requirements and B/C reviewers remain in IMPLEMENTATION_STATUS; no human acceptance, legal review or release readiness is claimed.

The previous evidence below is historical and has not been rewritten as current results.

---

# Executed continuation verification — 2026-09-20

This continuation strengthens the executable core; it does not complete all 58 requirements or confer B/C acceptance. UI remains Simplified Chinese. There are still **zero real-iPhone acceptance records, zero real OTP end-to-end records, and zero wallet acceptance records**. The original September 18 evidence is retained below as historical results.

All final root Node commands used `/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` first in PATH (Node24.19.0), pnpm11.19.0 and the existing lockfile. No dependency upgrade was made. Work was developed in isolated worktrees and cherry-picked after review.

| Executed check | Actual final outcome |
|---|---|
| `pnpm install --frozen-lockfile --offline` | Passed, exit0; existing cached dependency set |
| `pnpm check` | Passed, exit0; zero-warning ESLint, root+mobile strict TypeScript, **159 tests across 10 files**, boundaries for 20 client files and all 58 B/C assignments |
| `pnpm test:db` with the disposable loopback environment below | Passed, exit0; **28 grouped real PostgreSQL checks**, including two 100-request concurrent claim runs |
| `pnpm test:integration` with the same DB | Passed, exit0; **10 tests**, rerun after the final API schema restriction |
| `pnpm typecheck:edge` | Passed, exit0; core/deletion-worker Deno checking |
| `pnpm test:edge` | Passed, exit0; **12 tests** |
| `pnpm mobile:bundle` | Final pass, exit0; 780 modules, 3.3MB iOS Hermes bundle; HealthLoopHealth reference present and synthetic provider/policy excluded |
| `git diff --check` | Passed before checkpoint commit |
| Bounded `docker info --format '{{.ServerVersion}}'` | Timed out after 20 seconds; no local Supabase Auth/Edge stack executed |
| Required CoreSimulator framework existence | Still absent; no repeat native compile or device test attempted |

Database environment:

```sh
export PATH="/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
HEALTHLOOP_TEST_DATABASE_URL=postgresql://wi@127.0.0.1:55432/healthloop_test_core \
HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:db
HEALTHLOOP_TEST_DATABASE_URL=postgresql://wi@127.0.0.1:55432/healthloop_test_core \
HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:integration
```

The runner now loads **all migrations in filename order**. New migration `202609200001_consent_weekly_cutoff.sql` was applied after the unchanged original schema. Separate worker DBs `healthloop_test_security` and `healthloop_test_flow` also passed their targeted/full checks; final root results above used `healthloop_test_core`. The owner-only injected fixture clock was restored by the runners. `pg_ctl -D /tmp/healthloop-pg17 stop` completed after final verification; no PostgreSQL startup service was enabled.

## What the new evidence covers

- The live mobile hook uses ConsentController and its tested secure-storage protocol: only a server-confirmed adult/profile/version can permit local offline reads; drafts cannot grant access; withdrawal overrides old confirmation; reconnect disables cloud work; Auth/403/deleted/invalid/corrupt-record failures fail closed.
- The tested ActivitySyncCoordinator is used by today's/previous-day mobile sync buttons. It derives observation time from eligible pinned-source samples, preserves exact pending summary/revision/key in memory, serializes same-day work, clears on withdrawal/account switch, and only displays refreshed server missions/points/ledger. Successful sync/claim followed by a lost response replays safely; refresh failure does not repeat a completed claim.
- SyntheticHealthProvider → aggregation/coordinator → typed API client → actual HTTP handler → actual PostgreSQL: normal completion, response-loss replay, a single persisted submission/claim/ledger award, withdrawal between sync and claim, and previous-day sample timestamps. **Provider data and authentication are synthetic**; Auth validation/PostgREST transport are injected test adapters. This is not real HealthKit, real Supabase JWT/OTP, a running HTTP gateway, or real device evidence.
- Regression tests cover exhausted consent rate budgets permitting pure withdrawal but rejecting upgrades, and weekly bonuses granted before their own pinned deadline but denied exactly at/after it, even when a daily task has a later cutoff.
- A read-only review reproduced an old-account error cleanup blocking a new account. The controller fix and exact delayed-storage/account-switch regression passed. Account-sequence tests also ensure a late withdrawal write or DELETE response cannot advance deletion/cleanup against a replacement account. These are utility/flow tests; a mounted React/native account-switch walkthrough remains required.
- API requests now settle within a 15-second deadline across token lookup, fetch and JSON decoding, propagate caller cancellation, distinguish storage errors, and never auto-retry writes. The typed health summary rejects demo sources in the real core client.

## Failures encountered and remaining limits

An initial `pnpm mobile:bundle` exported JavaScript but failed its isolation gate because the new API response schema contained a `synthetic_demo` enum member. The real client schema was restricted to `apple_phone`/`apple_watch`, a demo-response rejection test was added, and the full check and bundle commands were rerun successfully. The isolation check was not weakened.

An earlier worktree install/source write failed with ENOSPC. Only this task's previously generated staging Pods were removed, recovering space; source and user files were preserved. Historical CocoaPods installation remains documented, but Pods must be installed again before a future native build. Current host recheck details are in ENVIRONMENT_RECHECK.md.

Docker and Xcode remain external prerequisites. No new Swift compilation, signed install, native runtime, email delivery, live deletion worker, device accessibility, two-wallet exercise, hosted CI, legal review or deployment is claimed. Full admin correction/approval, rewards UI, sponsor separation, retention/restore operations and the independent Lab remain open in IMPLEMENTATION_STATUS. Pending operations survive only within one process; there is no persistent health upload queue or automatic source-pin recovery across installations/devices. Local pin/revision metadata cleanup remains unfinished.

No costs, public publishing, production changes, external provisioning or blockchain transactions were initiated. The user-supplied kit and `docs/DEVELOPMENT_KIT.md` were preserved without staging them.

---

# Executed verification — 2026-09-18

This checkpoint records actual local results, not acceptance of the complete product. Human reviewers remain B/C as assigned in IMPLEMENTATION_STATUS. No legal approval, independent audit, signed install, device acceptance, wallet acceptance or remote CI run is claimed.

## Environment

macOS26.3 (25D125); Xcode26.3 (17C529), iPhoneSimulatorSDK26.2; Node24.19.0; pnpm11.19.0; TypeScript5.9.3; Vitest4.1.11; PostgreSQL17.11; Deno2.7.1. CocoaPods1.17.0/Ruby4.0.7 were installed during native verification. PostgreSQL was installed locally and used only in a disposable loopback cluster. No login/startup PostgreSQL service was enabled. The disposable cluster was stopped after successful verification with `pg_ctl -D /tmp/healthloop-pg17 stop`; restart commands are in BACKEND_NOTES.

The system's default Node is25.6.1. Final root commands used the bundled pinned runtime:

```sh
export PATH="/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
```

Earlier worker/unit checks used system Node25; all final root unit/type/bundle and PostgreSQL/client checks were rerun with Node24.19.0. Deno has its own runtime.

## Final executed checks

| Command | Actual outcome | What it establishes |
|---|---|---|
| `pnpm install --frozen-lockfile` | Passed, exit0 | Workspace resolves from committed package manifests and lockfile |
| `pnpm check` | Passed, exit0 | ESLint with zero warnings; root+mobile strict TypeScript; **114 tests across7 files passed**; boundary checks passed for17 client files and58 IDs |
| `pnpm test:db` with disposable DB environment below | Passed, exit0; **26 grouped PostgreSQL checks** | Real RLS/permissions/locking/transactions, including two 100-request concurrency runs, mixed tiers, rollback, weekly accepted days, pending-revision replay, cutoff equality, inventory/refund races, pause and deletion/old-token checks |
| `pnpm test:integration` with same environment, after DB runner | Passed, exit0; **5 tests** | Typed API client → actual HTTP handler → real PostgreSQL RPCs, consent/sync/top-ups/ledger/pagination/export/user isolation/cloud withdrawal |
| `deno check --config supabase/functions/core/deno.json supabase/functions/core/index.ts supabase/functions/deletion-worker/run.ts` | Passed, exit0 | Edge and deletion worker typechecking |
| `deno test --config supabase/functions/core/deno.json supabase/functions/core/handler.test.ts` | Passed, exit0; **12 tests** | HTTP schemas/body limits/CORS/auth call ordering/errors/config guards using injected Auth/RPC doubles |
| `pnpm mobile:bundle` | Passed, exit0 | Actual Expo iOS JavaScript/Hermes export; real native-module reference present, synthetic provider/policy excluded |
| `pnpm --filter @healthloop/mobile exec expo prebuild --platform ios --no-install` (`CI=1`) | Passed, exit0 | Generated iOS project/configuration. Warning: no app icon yet |
| `xcrun swiftc -frontend -parse apps/mobile/modules/healthloop-health/ios/HealthLoopHealthModule.swift` | Passed, exit0 | Swift syntax only; **not typechecking or linking** |
| CocoaPods installation in no-space staging project | Passed, exit0;95 pods | Native dependencies resolved, including HealthLoopHealth and ExpoModulesCore |
| Unsigned simulator `xcodebuild` | **Blocked, exit70 before compilation** | Host is missing CoreSimulator framework; no app build evidence |
| `git diff --check` | Passed | No whitespace errors in tracked changes |

Exact database environment used at root:

```sh
HEALTHLOOP_TEST_DATABASE_URL=postgresql://wi@127.0.0.1:55432/healthloop_test_core \
HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:db

HEALTHLOOP_TEST_DATABASE_URL=postgresql://wi@127.0.0.1:55432/healthloop_test_core \
HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:integration
```

The database runner creates an isolated Supabase-compatible Auth helper shim and explicitly injects claim fixtures. The client/handler integration uses unpredictable **synthetic test tokens** mapped only to synthetic users by an injected validator. It exercises the real HTTP handler and real SQL, but does **not** establish real Supabase JWT verification, email OTP, SMTP delivery, expiry, throttling or an Edge gateway deployment.

The owner-only database test fixture substitutes a fixed server clock inside the disposable test DB and restores it afterward. Production migration code reads the actual database clock and offers no client clock override. No real health data, production records or live credentials were used.

## Defects found and corrected

- Unified consent/source field names and mission version across client/domain/SQL.
- Replaced `.js` imports of TypeScript source with explicit `.ts` imports supported by Metro and Deno; enabled TypeScript source-extension imports. Initial Metro export failure is resolved.
- Anchored private-network URL checks and rejected credential/query-bearing endpoints; disguised remote demo hosts now fail startup.
- Serialized Keychain writes and coalesced health reads; stale consent saves/account switches cannot re-enable withdrawn in-memory upload permission or race two source pins.
- Weekly entitlement now counts accepted qualifying dates without requiring separate daily claims.
- Journaled proposed minimum revisions so changed reuse of a pending revision conflicts.
- Added subprocess tests rejecting unsafe database-reset targets, including query-string host overrides, before a connection is created.
- Preserved revision history in typed account exports; corrected redemption cursor ties.
- Initial plugin lint and API strict-indexing failures were corrected; final lint/typechecking pass.

## Outstanding infrastructure and acceptance

Docker returned HTTP500, so the complete local Supabase Auth/Edge stack was unavailable. No end-to-end OTP or live Auth deletion worker execution is recorded. The worker was typechecked and its SQL purge/retry paths were integration-tested separately.

CocoaPods first failed because React Native's prebuilt-core URI handling rejected the workspace path containing spaces. A temporary no-space staging directory resolved that step. Xcode then failed to load its missing CoreSimulator framework before compilation. First-launch setup stalled. Exact commands/logs and the operator repair step are in [NATIVE_BUILD_EVIDENCE](NATIVE_BUILD_EVIDENCE.md). Neither a native executable nor a signed install exists from this session.

There are **zero real-iPhone acceptance records** and **zero MetaMask/Trust Wallet acceptance records**. VoiceOver, large text, real HealthKit source metadata/manual records/authorization behavior and actual device account switching remain unverified. [NATIVE_VERIFICATION](../apps/mobile/NATIVE_VERIFICATION.md) specifies device evidence to collect without exposing health records.

Full admin approvals, sponsor separation/packet capture, retention scheduling, backup restore/tombstone replay, complete mobile demo rewards, offline relaunch UX and the independent Lab remain unfinished. GitHub Actions is configured for feasible checks but has not run remotely. No remote provisioning, public publishing, payments, wallet broadcasts or mainnet work occurred.

## Archive preparation checks — 2026-09-20

Documentation/source-material archiving only; application code was not changed or retested in this step. `PATH='<bundled Node24 bin>:$PATH' pnpm boundaries` passed: 20 client files, all 58 requirement assignments, no core fixture/Lab imports. `git diff --check` passed. The original attached prompt (49,028 bytes) was copied byte for byte into `docs/source-materials/HealthLoop_Codex_Mega_Prompt.txt` with SHA-256 `4a2fd53736d344c4dbf6d678c06fdf91d2cd806908b1dfe99185aa1041d7f635`. Historical environment JSON, native Podfile.lock and logs are preserved under `docs/archive/environment-evidence`; their dates/outcomes are not new test runs.

GitHub upload and local deletion remain pending a private destination and verified remote backup. Source-backup integrity checks do not replace the unrun P27 database restore/deletion replay or real-device/native/Auth acceptance.

The bounded pre-upload scan covered 41 reachable commits / 150 Git blobs, four unreferenced blobs, and 28 added/working archive/source/README files, including 40 DOCX/XLSX XML parts and 11 archived logs. No likely live credential, private key or personal health-record match was found. Matches were explicit disposable local database/test-key fixtures or public dependency metadata; no secret values were printed. This was a focused pattern/context review, not a complete security/privacy audit. All 58 report IDs and README/report/prompt relative links were checked successfully. Four orphaned source/document drafts were archived by object ID to avoid losing them during later cleanup.

The later full staged whitespace check reported two formatting findings in the verbatim historical `healthloop-pod-install.txt` log (trailing whitespace and an extra final blank line). These original evidence bytes were intentionally preserved; the check was not a clean pass. `git diff 27604e5 HEAD --check -- . ':!docs/archive/environment-evidence/logs'` then passed for source/docs outside the raw log archive. The archive manifest preserves exact hashes of those raw files.

## Public GitHub source-backup verification — 2026-09-20

After explicit public-upload approval, all 138 tracked files were uploaded to `https://github.com/stanleywongsk-svg/Health-web3`. Initial complete remote commit: `38c0425e01a440727f702d356ad507d8f36cbccb`; tree: `4dc233e418125aadbef639b2196581a8e40f1507`, exactly equal to local checkpoint `7ee8f5e29a1d1bc2eca61d40dde84913a7cddb59`. A fresh public `git clone` passed `git fsck --full`; all 136 source-file size/SHA-256 values and the history-bundle size/SHA-256 matched the downloaded manifest. `git bundle verify`, a separate bare clone of that downloaded bundle, `git fsck --full` and comparison of all seven branch refs passed. These checks downloaded from GitHub rather than reusing the original local files.

The GitHub Actions runs endpoint reported `total_count: 0` after the archive commit, which used `[skip ci]`; no remote CI pass is claimed. This archival step reran no application, native, Auth or database acceptance tests. Public source publication was authorized; production changes, costs and blockchain broadcasts were not performed. The prior destination-pending note is historical. See GITHUB_BACKUP.md for the cleanup result.
# App Store first-release implementation — 2026-10-05

Implemented the user-adopted Hong Kong health/points/achievement plan across the native app, strict API contract, PostgreSQL enforcement, release guards and privacy/review handoff. Preserved existing uncommitted app/proposal work, all 58 requirement IDs and B/C assignments. No real health data, hosted provisioning, external email, spending, deployment, publication, wallet connection or chain transaction was used. No Apple approval, independent audit or human B/C acceptance is inferred.

Environment: bundled Node **24.19.0**, pnpm **11.19.0**, PostgreSQL **17.11**, Xcode **26.3**, Expo **55.0.31** / React Native **0.83.10**. Dependency manifests and lockfile are unchanged. Root final commands used this PATH prefix (preserving the existing pnpm fallback directory):

```sh
export PATH="/Users/wi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
pnpm mobile:preflight
pnpm check
pnpm typecheck:edge
pnpm test:edge
pnpm mobile:bundle
pnpm --filter @healthloop/mobile exec expo prebuild --platform ios --no-install
git diff --check
git diff --exit-code -- apps/mobile/package.json pnpm-lock.yaml docs/requirements.md docs/requirements.json
```

| Executed final check | Actual result and scope |
|---|---|
| `pnpm check` | Exit 0: lint, root/mobile TypeScript, **434 tests / 24 files**, all **58** requirement assignments; release graph checked **46** source files and **566** installed production dependency manifests. Final rerun includes the mobile race fixes and local Docker wrapper regression tests. |
| Edge checks | `typecheck:edge` exit 0; `test:edge` **38 passed** (34 handler + 4 deletion-worker scope tests). |
| PostgreSQL | `test:db` exit 0, **75 groups** including 100-way claim/approval/preference concurrency, corrected badge retraction, consent/deletion, fresh-spend rejection and legacy refunds/replays. Privileged fixture injects synthetic Auth claims; this alone is not real OTP evidence. |
| Handler/client/SQL | `test:integration` exit 0, **27 tests** using the real SQL/handler/client with explicitly synthetic Auth/transport. |
| Actual local HTTP | `test:local --reporter=verbose --disableConsoleIntercept` final exit 0, one sequential scenario / **7 groups**: real local ES256 OTP/JWT, claims, canonical private badges, fixed capabilities, blocked new demo spending, RLS, consent, reminders/export, refresh/logout and scoped durable Auth deletion/retry. Generated activity/accounts are synthetic and cleaned up. |
| iOS JavaScript | Final `mobile:bundle` exit 0: **856 modules**, Hermes bundle `index-f25a27459a9c64c71eb3b658eea0a37d.hbc`; real HealthLoopHealth present, Lab/synthetic/deferred provider markers excluded. |
| Native preflight/prebuild | Both exit 0. Xcode/SDK/CoreSimulator/Pods prerequisites passed; prebuild reused the ignored native project with no package change. It warned that no icon is configured and skipped a duplicate privacy-file reference; app artwork remains a release gate. |
| Native simulator Release | Current-source incremental Xcode build exit 0 in **36 seconds**, `BUILD SUCCEEDED`, zero compiler-error lines. Ad-hoc simulator signature verified with `codesign --verify --deep --strict`. This is not a signed physical-device/archive submission. |
| Embedded app checks | Public loopback config, release-policy marker, badge-gallery copy and native HealthKit bridge present; service-role value and synthetic provider absent. Built-app privacy plist matches six linked functionality categories; no tracking declaration, HealthKit write usage description, ATT usage request or remote-push background mode. Four existing React Native/Pods required-reason API categories retained. This is configuration/artifact inspection, not network/processor audit. |
| Native UI | **Not run:** `cua.getApp("Simulator")` reported the Mac locked and automatic unlock unavailable. Requested manual unlock while independent work continued; no unlocked response or current-source UI evidence was obtained. Older recordings do not verify this gallery. |

The root final SQL suites used a new, exclusive disposable database in the loopback PostgreSQL cluster:

```sh
/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D /Users/wi/healthloop/.local/pg17 -l /Users/wi/healthloop/.local/pg17-store-release.log -o '-h 127.0.0.1 -p 55432 -c max_connections=160' start
/opt/homebrew/opt/postgresql@17/bin/createdb -h 127.0.0.1 -p 55432 -U healthloop_local healthloop_test_store_20261005_final
HEALTHLOOP_TEST_DATABASE_URL=postgres://healthloop_local@127.0.0.1:55432/healthloop_test_store_20261005_final HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:db
HEALTHLOOP_TEST_DATABASE_URL=postgres://healthloop_local@127.0.0.1:55432/healthloop_test_store_20261005_final HEALTHLOOP_ALLOW_DB_RESET=local-only pnpm test:integration
```

The backend worker separately used `healthloop_test_store_20261005_backend`; final pinned-Node DB/integration/client checks also passed there. Neither SQL reset was aimed at the Auth stack. For real local HTTP:

```sh
HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm local:start
pnpm exec supabase migration up --local
HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm local:serve
HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm test:local --reporter=verbose --disableConsoleIntercept
```

Applied only the new forward migration `202610050002_store_release.sql` to the existing local Supabase volume; no shared-stack reset. Wrapper verified API54321/DB54322/Mailpit54324 bound solely to 127.0.0.1. The HTTP harness restores its prior private demo setting, so this synthetic stack is not a ready real-device health environment.

Native command (run from `apps/mobile/ios` by ignored `.local/store-release-20261005/build.mjs`):

```sh
xcodebuild -workspace app.xcworkspace -scheme app -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /Users/wi/healthloop/.local/earn-20261005/derived -jobs 4 \
  CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES DEVELOPMENT_TEAM= build
```

The helper obtains only guarded local status in memory, injects public development/real URLs and the anon key, strips service/private-key environment names, and writes a private log. `verify-build.mjs` verified the embedded bundle and ad-hoc signature without printing keys. Artifact: `.local/earn-20261005/derived/Build/Products/Release-iphonesimulator/app.app`; `main.jsbundle` SHA-256 **89c83c2f4863e35db4e43c85dbdba9c89a87cf70fb0a379a95f913a26b3e196b**. Logs and JSON verification remain under ignored `.local/store-release-20261005/`. The derived directory was reused, not a fresh dependency compilation.

Failures/corrections before final passes: an initial PATH replacement omitted pnpm's existing fallback and exited127; using the prefix above fixed it. Initial worker mobile checks used system Node25, so root reran the full suite with Node24. Cross-review found a demo handler attesting the shipping policy; it now returns `NOT_SUPPORTED`. Mobile review found stale auth failures could affect a switched account, a concurrent policy failure could allow sync→claim, and older compound reads could overwrite newer accounting; captured account/epoch guards, per-mutation release checks and snapshot generation now cover these paths with 14 added regressions. A test-only lint warning was corrected before the final suite.

Two initial `local:serve` attempts failed while Docker replaced the Edge container between list/inspect. The wrapper stopped its owned stack rather than bypass isolation. This also made the first native helper stop before compilation and one premature local HTTP attempt fail safely. The wrapper now retries only exact missing-container races, validates partial inspection results immediately, caps retries and reports credential-free operation categories; six new tests cover this fix. Final start/serve/HTTP/native runs then passed. Expected Expo color-variable warnings remain informational. No failed check was suppressed or relabelled as passed.

Cleanup completed: interrupted the verified owned `local-backend.mjs serve` process, then `HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm local:stop` exited 0 and preserved volumes; `pg_ctl -D /Users/wi/healthloop/.local/pg17 stop` exited 0. The worker's exec-session ID was not pollable from root, so shutdown used the observed exact owned process followed by the guarded stop command. Source, dependencies, disposable databases and build artifacts were retained. Final diff/register/package/lockfile and release-document whitespace checks passed.

Next executable task: current-source native UI walkthrough after Mac unlock, then signed two-iPhone HealthKit acceptance with operator setup. Provider integrations, App Store artwork/metadata, actual processor/legal approvals, hosted services, deletion/retention/backup operations and submission remain open. See `APP_STORE_REVIEW_NOTES.md`. No automatic continuation was scheduled.
