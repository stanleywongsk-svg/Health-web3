# HealthLoop development materials

Imported on 2026-09-18 from `HealthLoop_Codex_开发资料包.zip`. The user confirmed that these materials belong to the existing HealthLoop project; they do not create a separate app or implementation branch.

## Where to read

| Material | Working location | Purpose |
| --- | --- | --- |
| Repository instructions | `../AGENTS.md` | Persistent implementation and evidence rules |
| Complete implementation brief | `../MEGA_PROMPT.md` | Product scope, architecture, privacy, accounting, and acceptance gates |
| Readable requirement register | `requirements.md` | All 58 requirements and B/C ownership |
| Machine-readable requirement register | `requirements.json` | IDs, dependencies, priorities, acceptance criteria, owners and reviewers |
| Reference sources | `SOURCES.md` | Official documentation and research entry points |
| Original package and launch/resume prompts | `../HealthLoop_Codex_Kit/` | Preserved source materials |
| Product and business specification | `../HealthLoop_Codex_Kit/planning/HealthLoop_商业计划与产品规格_Codex开发版.docx` | Supporting planning document |
| Requirement workbook | `../HealthLoop_Codex_Kit/planning/HealthLoop_需求清单_两人负责_Codex开发版.xlsx` | Supporting responsibility and acceptance workbook |

The existing repository's initial commit (`80d1000`) stored the full mega prompt at `docs/requirements.md`. Its bytes exactly match the imported `MEGA_PROMPT.md`. The current `docs/requirements.md` is the shorter register supplied in the ZIP; the complete original brief remains available at the root and in the preserved package. No product scope was changed by that path distinction.

## Import checks actually performed

- ZIP integrity check passed for all 10 archive members.
- All extracted files were compared byte for byte against the ZIP entries.
- The register contains exactly 58 unique IDs: P01–P36, L01–L08, F01–F08, T01–T06.
- Owner/reviewer pairs are B/C or C/B for every requirement and agree across the JSON, readable register, and complete brief.
- Root working copies matched their original package files at import.
- Both Office documents passed archive integrity checks and XML parsing. This verifies file structure, not visual rendering or approval of their contents.

Original ZIP SHA-256:

`ec27076dc5bc6d5759d660a3ddb06bfc8a70938ae5b3bfe7ecff5e402ba5a08c`

These are material-import checks, not app, database, native-device, or wallet acceptance tests. The source register's initial statuses are preserved; track actual implementation in `IMPLEMENTATION_STATUS.md` and executed application checks in `TEST_EVIDENCE.md` as required by the brief. Human B/C review remains separate from automated consistency checking.

## Development handoff

Continue the existing implementation against `../MEGA_PROMPT.md` and the requirement register. The first acceptance path is email login → separate consent choices → native health reads → minimum consented summary synchronization → server-side mission evaluation → atomic points posting → reconciled ledger display. Retain the independent synthetic-only Lab boundary and the conditional P1/P2 backlog.

This import does not provision services, publish builds, broadcast transactions, or establish any release approval.
