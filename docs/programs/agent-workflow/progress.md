# Progress — agent-workflow

Plan: `plan.md`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r3 (2026-10-22). |
| Current unit / checkpoint | none active; the program's one unit (CP1-CP6) merged in PR 6. |
| Status | completed (2026-10-22). CP1-CP6 done: CP1-CP4 passed Main review and the Codex gate with the D24 parity review, CP5 passed AC8, CP6 passed AC9 after the AW-005 fix and two Owner rule decisions; every change after the gate passed a Codex re-review (G9). |
| Completed evidence | `npm run docs:check` and `npm run docs:check:test` pass after CP4 (checks run by the implementor, 2026-10-22). `npm run lint` still reports the 81 existing problems. The translated `security-hotfix` docs were compared with `e499408` by an uncommitted script (heading numbers, IDs and code blocks); the script is not in the repo. CP5 and CP6 results are in Main's scratchpad report (2026-10-22); the planner run kept a partial on P6 (self-review present, not in the `Tự review:` block shape). |
| Accepted deviations | The Owner added a rule after the plan was approved: when the auto-mode classifier denies a call, ask the Owner for that exact action and retry once (`.claude/rules.md` section 4, `89478e0`, widened to both roles in the round 1 corrections). `FEAT-008` and `FEAT-009` record the never-port list as closed `Dropped` entries because the plan names no other home for it. The Owner added a temporary rule (2026-10-22) in `.claude/rules.md` section 4: implementors run no database, hosted or local, even to check syntax; it is removed when the infrastructure program provides a local database (FEAT-003). The Owner also decided (2026-10-22) that Main may run read-only catalog and metadata queries on the hosted project without asking; reading user data rows and any write need approval first (`.claude/rules.md` section 4). The Owner decided (2026-10-22) that Main edits program state records (`progress.md`, `problems.md`, `future-features.md`) without an implementor or a review round, including under G9 (`.claude/rules.md` section 2); that rule was itself added without a Codex round at the Owner's instruction. |
| Blockers / Owner decisions | none. Open entries moved when the program closed: AW-001, FEAT-002 to FEAT-004 to `infrastructure`; AW-003 to `security-hotfix`; AW-002 and FEAT-005 to FEAT-007 to `docs/backlog/` (backlog reviewed with the Owner, 2026-10-22). |
| Next action | none; the program is closed. The remote branch `chore/agent-workflow` still exists, and deleting it needs its own Owner grant. |
| Current authority | none: the program is closed. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-22 CP1: `CLAUDE.md`, `.claude/rules.md`, `docs/agent-loops.md`, `.gitignore` and tracked `launch.json` (`062fdd2`).
- 2026-10-22 CP2: the eight project skills with references and templates (`ad0912a`).
- 2026-10-22 Rule added: ask the Owner when the auto-mode classifier denies an action (`89478e0`).
- 2026-10-22 CP3: docs structure and link checks with tests and npm scripts (`404f483`).
- 2026-10-22 CP3 follow-ups: skills aligned with the checks and the future-features template cleaned (`f42698d`).
- 2026-10-22 CP4: docs index, roadmap ADR, backlog, program docs and the English security-hotfix docs (`797b856`).
- 2026-10-22 Main review round 1 corrections: CI and Codex rules pointed to their owners, classifier rule covers both roles, PR reference form unified (`d1203c8`).
- 2026-10-22 Codex round 1 corrections: skills `ad7474d`, rules and loops `4bf2ae4`, docs checker `5476649` (`2ceb405`).
- 2026-10-22 Codex round 2 corrections: docs checker declaration scan `3e15869`, skills GET callback and target size `8760b92` (`95866a2`).
- 2026-10-22 AW-005 fix on exp/aw-005: the implementor loads git-pr-workflow before committing and code-review for self-review; AW-004 and AW-005 recorded (`b99315e`).
- 2026-10-22 AW-005 fix adopted into chore/agent-workflow after the CP6-I rerun loaded both skills (`b99315e`).
- 2026-10-22 Temporary rule: implementors run no database; FEAT-003 removes it (`505f103`).
- 2026-10-22 Owner rule: Main may run read-only hosted catalog queries without asking (`157672d`).
- 2026-10-22 Current authority aligned with the hosted-query rule (`bcc0406`).
- 2026-10-22 Owner rule: Main edits program state records without a review round (`f040387`).
- 2026-10-22 CP5 passed AC8 and CP6 passed AC9; AW-004 and AW-005 resolved (`3ab2604`).
- 2026-10-22 Merged to `main` and the AC2 memory mapping applied (PR 6, `50a3075`).
- 2026-10-22 Program closed; open entries moved to `infrastructure`, `security-hotfix` and the backlog (this commit).
