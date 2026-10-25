# Progress — agent-workflow

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `implementation-plans/u5-skill-authoring/plan.md` r7 (2026-10-26), approved by the Owner on 2026-10-26. |
| Current unit / checkpoint | U5 `skill-authoring` skill and the skill-shape check; CP1 and CP2 handed to the Sonnet implementor. |
| Status | Plan approved; implementation of CP1 and CP2 in progress. |
| Completed evidence | U5 plan: Codex plan review rounds 1 to 6, last PASS on r7; `npm run docs:check` 0 violations. U4 merged in PR 21 (`4fa5731`); the PR 21 CI run passed all six jobs and Vercel. U3: PR 14 and the milestones below. |
| Accepted deviations | none for U5. |
| Blockers / Owner decisions | none. |
| Next action | The Sonnet implementor delivers CP1 and CP2 with a local commit each; Main reviews them, then runs CP3 (AC8 and the Codex diff gate). |
| Current authority | The Owner approved U5 r7 and granted its plan commit and its implementation by the Sonnet implementor with local commits per checkpoint (2026-10-26). No push, PR or merge grant. |

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
- 2026-10-23 Reopened as an evergreen program: charter, U1 moved, U2 and U3 plans, AW-002 and FEAT-007 back from the backlog, FEAT-010 and FEAT-011 (`abfa4b3`).
- 2026-10-23 U3 merged (PR 14, `8606dcf`).
- 2026-10-25 U4 plan r5 approved after the Codex plan gate; AW-006 Direction records U4 D3 and D4 (`ca6a4a2`).
- 2026-10-25 U4 plan r6: the implementor updates State in its checkpoint commits (D8); AW-007 recorded (`05fdcb8`).
- 2026-10-25 U4 CP1: handoff template, section 7 one-task and docs-lag rules, Resources row (`ccef754`).
- 2026-10-25 U4 CP2: `migration new` allowed for implementors in section 4; permission and CI facts have one owner each (`af8b792`).
- 2026-10-25 U4 CP3: change-to-suite table and the manual-QA seed rule in `test-quality-strategy`, linked from the verify steps (`a01e34d`).
- 2026-10-25 U4 CP4: `npm run dev` runs on the local stack with a tested environment map, `devspace-dev` uses `127.0.0.1:3000`, manual QA docs run on the seeded local stack (`435fd3d`).
- 2026-10-25 U4 CP5: `playwright-cli` block covers the references, README current, stale pointers fixed (`1f13cef`).
- 2026-10-25 U4 Main review corrections: section 4 says implementors never open or update a PR or merge, `readLocalStack` messages are neutral, `migration new` wording (`7a1e240`).
- 2026-10-25 U4 Codex round 1: the dev env test asserts the Gmail placeholder literals (`af9bce9`).
- 2026-10-25 U4 Owner QA: `npm run dev` hides the typeless-package warning of its launcher import (`aab40ee`).
- 2026-10-25 U4 AC12 audit corrections: suite selection, CI facts and permission statements point to their owners (`efae00b`).
- 2026-10-25 U4 AC12 audit round 2: permission statements outside section 4 reduced to pointers, CI-fix scope moved into section 4 (`a3a2ce8`).
- 2026-10-25 U4 AC12 audit round 3: CLAUDE.md rule 10 names section 4 as the owner of git, remote and database permissions without restating them (`f6c1ea2`).
- 2026-10-25 U4 CP6: backlog entries BL-007, FEAT-015 and FEAT-016, AC12 audit PASS (`30b27dc`).
- 2026-10-25 U4 merged; AW-006 and BL-007 resolved (PR 21, `4fa5731`).
- 2026-10-26 U5 plan r7 approved after the Codex plan gate; PR 21 docs catch-up (this commit).
