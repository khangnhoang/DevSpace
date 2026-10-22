# Progress — agent-workflow

Plan: `plan.md`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r3 (2026-10-22). |
| Current unit / checkpoint | The program has one unit. CP1-CP4 are implemented and committed locally on `chore/agent-workflow`; CP5 and CP6 belong to Main. |
| Status | CP1-CP4 implemented and corrected after Main review round 1; waiting for re-review, then the Codex gate. |
| Completed evidence | `npm run docs:check` and `npm run docs:check:test` pass after CP4 (checks run by the implementor, 2026-10-22). `npm run lint` still reports the 81 existing problems. The translated `security-hotfix` docs were compared with `e499408` by an uncommitted script (heading numbers, IDs and code blocks); the script is not in the repo. |
| Accepted deviations | The Owner added a rule after the plan was approved: when the auto-mode classifier denies a call, ask the Owner for that exact action and retry once (`.claude/rules.md` section 4, `89478e0`, widened to both roles in the round 1 corrections). `FEAT-008` and `FEAT-009` record the never-port list as closed `Dropped` entries because the plan names no other home for it. |
| Blockers / Owner decisions | none |
| Next action | Main reviews CP1-CP4, sends corrections, then runs the Codex gate and the D24 parity review; after that CP5 and CP6. |
| Current authority | Local commits for CP1-CP4 on `chore/agent-workflow`. Push, PR and merge are not granted. No Supabase MCP call, no `.env*` read, no edit of `C:\VocaSpace`, no edit of the Claude memory files. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-22 CP1: `CLAUDE.md`, `.claude/rules.md`, `docs/agent-loops.md`, `.gitignore` and tracked `launch.json` (`062fdd2`).
- 2026-10-22 CP2: the eight project skills with references and templates (`ad0912a`).
- 2026-10-22 Rule added: ask the Owner when the auto-mode classifier denies an action (`89478e0`).
- 2026-10-22 CP3: docs structure and link checks with tests and npm scripts (`404f483`).
- 2026-10-22 CP3 follow-ups: skills aligned with the checks and the future-features template cleaned (`f42698d`).
- 2026-10-22 CP4: docs index, roadmap ADR, backlog, program docs and the English security-hotfix docs (`797b856`).
- 2026-10-22 Main review round 1 corrections: CI and Codex rules pointed to their owners, classifier rule covers both roles, PR reference form unified (this commit).
