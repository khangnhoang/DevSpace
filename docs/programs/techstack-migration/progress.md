# Progress — techstack-migration

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [plan.md](plan.md) r3; Codex plan gate PASS in round 3 and approved by the Owner on 2026-11-08. |
| Current unit / checkpoint | TM-U1 CP1 done (hook), CP2 next: [detail plan](implementation-plans/tm-u1-guardrails-backup/plan.md) r3 on branch `chore/tm-u1-guardrails-backup`. |
| Status | In progress: TM-U1 plan r3 passed the Codex plan gate and was approved by the Owner on 2026-11-08, hook settings included; CP1 implemented locally (guard module, hook script, rules binding, unit tests; the settings entry waits for CP3); the live hook proof (CP4) is Main's. |
| Completed evidence | Program opening merged (PR 77). Dependency check at opening (2026-11-08, Node v26.13.0): `npm outdated`, `npm audit` (10 findings: 1 low, 8 moderate, 1 critical) and `npm audit --omit=dev` (2: DM-P1 group B, unchanged); new minor and major rows recorded in dependency-maintenance DM-F2 and DM-F6. |
| Accepted deviations | The `PreToolUse` entry of `.claude/settings.json` lands in the CP3 commit, not CP1, because the app reloads settings mid-session and the hook would prompt in every running session (Owner decision, 2026-11-08); CP1 added it and a correction commit removed it again. `db push --help` and the other help or version calls are allowed before the always-ask words (G2 rule 3 moved first). |
| Blockers / Owner decisions | None; TM-U1 Owner decisions 9 to 12 are recorded in its plan. |
| Next action | The implementor continues with CP2 (`backup:check`) and CP3 (runbook and instruction edits). |
| Current authority | TM-U1 plan r3 approved and committed; implementation of CP1 to CP3 with one local commit per checkpoint, including read-only dumps and counts on the dev stack for the CP2 rehearsal (Owner, 2026-11-08). No push, PR, merge, hosted read or hosted write is granted. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-11-08 Program opened: master plan r3 approved after the Codex plan gate, 19 entries moved in, BL-F9 dropped, opening dependency check recorded (PR 77, `09399d3`).
- 2026-11-08 TM-U1 detail plan r3 approved after the Codex plan gate (this commit).
