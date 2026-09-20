# HealthLoop Codex kit — start here

This folder is an implementation specification, **not an already-built app**.

## Files

- `MEGA_PROMPT.md`: complete self-contained Codex implementation brief, including all 58 requirement IDs.
- `AGENTS.md`: concise persistent repository guidance.
- `docs/requirements.md`: readable Simplified Chinese acceptance register.
- `docs/requirements.json`: machine-readable version of that register, with B/C owners and review assignments.
- `docs/SOURCES.md`: source entry points retained from the planning documents.
- `LAUNCH_PROMPT.txt`: opening instruction for Codex.
- `CONTINUE_PROMPT.txt`: resumption instruction using repository evidence, not a new project plan.
- `planning/`: amended Simplified Chinese report and workbook, when included in this distribution.

## Use in an empty repository

Place the kit contents in your chosen project folder, open that folder/repository in your available Codex workspace, and submit `LAUNCH_PROMPT.txt`. The complete brief is already in `MEGA_PROMPT.md`; it does not need to fit into `AGENTS.md`.

## Use in an existing repository

Copy `MEGA_PROMPT.md` and the relevant `docs/` files without overwriting existing work. Review and merge the HealthLoop guidance into the applicable `AGENTS.md` rather than replacing unrelated project instructions. Open the correct repository in Codex, then submit the launch instruction.

Alternatively, paste the entire contents of `MEGA_PROMPT.md` into a Codex task with access to the intended repository. It includes the requirement register and does not depend on prior chat history.

## Expected first result

Codex should inspect the repository, identify genuine environment prerequisites, establish a short dependency-based plan and start implementing a tested slice. It should not only return another business plan or a attractive mocked dashboard.

Native HealthKit validation needs a compatible native build, a real device and the applicable build/signing setup. Missing device access must be reported as a blocker. Do not send health records, production secrets or wallet recovery phrases into the coding conversation.

The core app uses points. The wallet experiment is separate and testnet-only. Any mainnet token work remains a future human decision with legal, platform and independent security prerequisites.

## No project calendar

There are no delivery dates, fixed-week plans, weekly staffing commitments or calendar token-release models in this kit. Daily/weekly activity rules, authentication expiry, retention windows and monthly financial units remain because they are product or accounting definitions, not development schedules.

The kit is written in English for implementation; the app UI, report, workbook and requirement register use Simplified Chinese. No particular current Codex interface or plan entitlement is assumed. Official repository-instruction guidance is referenced in `docs/SOURCES.md`.
