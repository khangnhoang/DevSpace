# Progress — techstack-migration

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [plan.md](plan.md) r3; Codex plan gate PASS in round 3 and approved by the Owner on 2026-11-08. |
| Current unit / checkpoint | TM-U1 CP3 done (runbook, instruction edits, hook entry), CP4 (Main) next: [detail plan](implementation-plans/tm-u1-guardrails-backup/plan.md) r3 on branch `chore/tm-u1-guardrails-backup`. |
| Status | In progress: TM-U1 plan r3 passed the Codex plan gate and was approved by the Owner on 2026-11-08, hook settings included; CP1 implemented locally (guard module, hook script, rules binding, unit tests; the settings entry waits for CP3), the classifier then corrected to judge the commands that run and not text that mentions them, CP2 implemented locally (`backup:check`, unit tests, local rehearsal) and CP3 implemented locally (runbook, `AGENTS.md`, `supabase-migration` and TM-F6 edits, then the `PreToolUse` entry in `.claude/settings.json` as the last edit); the live hook proof (CP4) and the first drill (CP5) are Main's and the Owner's. |
| Completed evidence | Program opening merged (PR 77). Dependency check at opening (2026-11-08, Node v26.13.0): `npm outdated`, `npm audit` (10 findings: 1 low, 8 moderate, 1 critical) and `npm audit --omit=dev` (2: DM-P1 group B, unchanged); new minor and major rows recorded in dependency-maintenance DM-F2 and DM-F6. |
| Accepted deviations | The `PreToolUse` entry of `.claude/settings.json` lands in the CP3 commit, not CP1, because the app reloads settings mid-session and the hook would prompt in every running session (Owner decision, 2026-11-08); CP1 added it and a correction commit removed it again. `db push --help` and the other help or version calls are allowed before the always-ask words (G2 rule 3 moved first). The classifier parses each command, resolves wrappers and judges only `supabase` and libpq tools where they run (correction commit `e60cfd1`). The Storage commands need `--experimental` and a relative, existing destination in CLI 2.121.0 (an absolute Windows path fails), so the runbook uses `Resolve-Path -Relative`. TM-F6 is `Fixed locally, awaiting delivery` and closes as `Done` once the PR exists (`program-docs`, Backlog). `db dump --data-only` omits `supabase_migrations`, so the backup gains `history-schema.sql` and `history.sql` (`--schema supabase_migrations`, schema-only and data-only) for AC7 (c), as plan section 3 foresaw. The CLI publishes the database port on every interface with no option for the address, so `backup:check` recreates the scratch database container with the port on `127.0.0.1` once Auth and Storage have set up their schemas (G7). |
| Blockers / Owner decisions | None; TM-U1 Owner decisions 9 to 12 are recorded in its plan. |
| Next action | Main reviews the TM-U1 diff and runs the implementation Codex gate, then the live hook proof (CP4); CP5 (first drill) follows the merge. |
| Current authority | TM-U1 plan r3 approved and committed; implementation of CP1 to CP3 with one local commit per checkpoint, including read-only dumps and counts on the dev stack for the CP2 rehearsal (Owner, 2026-11-08). No push, PR, merge, hosted read or hosted write is granted. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-11-08 Program opened: master plan r3 approved after the Codex plan gate, 19 entries moved in, BL-F9 dropped, opening dependency check recorded (PR 77, `09399d3`).
- 2026-11-08 TM-U1 detail plan r3 approved after the Codex plan gate (4c0496a).
- 2026-11-08 TM-U1 CP1 (hook, `15cb31b`, `24b9d64`) and the classifier correction committed locally (e60cfd1).
- 2026-11-08 TM-U1 CP2 committed locally: `backup:check` passed its rehearsal on a dev-stack dump and failed each of its checks on its own (75b1afb).
- 2026-11-08 TM-U1 CP3 committed locally: backup runbook, `AGENTS.md` and `supabase-migration` edits, TM-F6 fixed locally, and the `PreToolUse` hook entry in `.claude/settings.json` (this commit).
