# Progress — agent-workflow

Plan: `plan.md`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r3 (2026-10-22). |
| Current unit / checkpoint | The program has one unit. CP1-CP6 are done on `chore/agent-workflow`. |
| Status | CP1-CP6 done: CP1-CP4 passed Main review and the Codex gate with the D24 parity review, CP5 passed AC8, CP6 passed AC9 after the AW-005 fix and two Owner rule decisions; every change after the gate passed a Codex re-review (G9). |
| Completed evidence | `npm run docs:check` and `npm run docs:check:test` pass after CP4 (checks run by the implementor, 2026-10-22). `npm run lint` still reports the 81 existing problems. The translated `security-hotfix` docs were compared with `e499408` by an uncommitted script (heading numbers, IDs and code blocks); the script is not in the repo. CP5 and CP6 results are in Main's scratchpad report (2026-10-22); the planner run kept a partial on P6 (self-review present, not in the `Tự review:` block shape). |
| Accepted deviations | The Owner added a rule after the plan was approved: when the auto-mode classifier denies a call, ask the Owner for that exact action and retry once (`.claude/rules.md` section 4, `89478e0`, widened to both roles in the round 1 corrections). `FEAT-008` and `FEAT-009` record the never-port list as closed `Dropped` entries because the plan names no other home for it. The Owner added a temporary rule (2026-10-22) in `.claude/rules.md` section 4: implementors run no database, hosted or local, even to check syntax; it is removed when the infrastructure program provides a local database (FEAT-003). The Owner also decided (2026-10-22) that Main may run read-only catalog and metadata queries on the hosted project without asking; reading user data rows and any write need approval first (`.claude/rules.md` section 4). The Owner decided (2026-10-22) that Main edits program state records (`progress.md`, `problems.md`, `future-features.md`) without an implementor or a review round, including under G9 (`.claude/rules.md` section 2); that rule was itself added without a Codex round at the Owner's instruction. |
| Blockers / Owner decisions | none |
| Next action | The Owner grants push, PR and merge; after the merge Main applies the AC2 memory mapping. |
| Current authority | Local commits on `chore/agent-workflow`. Push, PR and merge are not granted. Implementors, and the CP6 simulated sessions (which run under temporary deny rules), make no Supabase MCP call; Main's hosted access follows `.claude/rules.md` section 4 (read-only catalog queries are allowed, data rows and writes need the Owner). No `.env*` read, no edit of `C:\VocaSpace`, no edit of the Claude memory files. |

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
- 2026-10-22 CP5 passed AC8 and CP6 passed AC9; AW-004 and AW-005 resolved (this commit).
