# Progress — agent-workflow

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `implementation-plans/u3-program-kinds/plan.md` r5 (2026-10-23). |
| Current unit / checkpoint | U3 program kinds, on branch `docs/program-kinds`: CP1 (`7d95c32`), CP2 (`fd0bd6f`), Main's review correction (`6d0ccb7`), CP2b (`9cf6d2a`) and CP3 (this commit). |
| Status | automated checks passed; not pushed. CP1 to CP2b passed Main review and the Codex diff gate (2026-10-23). CP3 passed Main self-review and the Codex gate. |
| Completed evidence | On CP3: `npm run docs:check` 0 violations and 0 broken links, `npm run docs:check:test` 38 pass, `git diff --check` clean; on `9cf6d2a`: `npm run lint` 81 problems, `npx tsc --noEmit` exit 0. `git diff -M` shows the U1 move as a rename that changes only the title, the header pointer line and relative links. |
| Accepted deviations | The U2 plan is a retroactive record of PR 13's chat plan r3, committed after U2 merged (U3 D6). The five Sonnet commits of CP1 and CP2 were squashed into one per checkpoint at the Owner's request (U3 D10). |
| Blockers / Owner decisions | none. |
| Next action | The Owner decides on push and PR creation for `docs/program-kinds`; then Main watches CI and writes the result into the PR body. |
| Current authority | the CP3 commit (granted 2026-10-23). Push, PR creation and merge are not granted. |

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
- 2026-10-22 Program closed; open entries moved to `infrastructure`, `security-hotfix` and the backlog (`7969be9`).
- 2026-10-23 U2 merged: the CI result in the PR body, the PR template, hosted apply with `db push`, the migration and handoff rules (PR 13, `38d431b`).
- 2026-10-23 Reopened as an evergreen program: charter, U1 moved, U2 and U3 plans, AW-002 and FEAT-007 back from the backlog, FEAT-010 and FEAT-011 (this commit).
