# Progress — techstack-migration

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | TM-U1 [detail plan](implementation-plans/tm-u1-guardrails-backup/plan.md) r4 (the command hook withdrawn, Owner decision 13), approved by the Owner on 2026-11-08 and committed at `ab36f8e`; master [plan.md](plan.md) r3. |
| Current unit / checkpoint | TM-U1 CP3b and its gate round 2 corrections implemented locally on branch `chore/tm-u1-guardrails-backup`; Main reviews them next, then CP4 (Main, final regression). CP5 (first drill) stays pending until after the merge. |
| Status | In progress: CP1 to CP3 are committed locally (the CP2 `backup:check` and the CP3 runbook stand; the CP1 hook and its CP3 settings entry are withdrawn). CP3b removed every hook artifact (the `hooks` key first, then the hook script, guard module, unit test, fault-switch ignore line, `.claude/rules.md` section 9 and the `AGENTS.md` hook bullet; TM-F6 is `Dropped`) and fixed locally the three `backup:check` findings of the implementation Codex gate (error reduction, atomic run with live-owner protection, unresolved paths with result replacement) plus the runbook path example. The six hook findings are withdrawn by Owner decision 13, not fixed. The implementation Codex gate round 2 (hook out of scope) found five Required defects in the `backup:check` fixes, now corrected locally: the run is released only after its result is published, every result is published by renaming a complete temporary file, so a failed write never leaves a half-written result, the run's start, a failed Docker query and an interrupt publish it without touching the names file, and only the final save settles that file first (a folder that cannot be written at all keeps its earlier file, and the run then exits 1), an interrupted run reports an unconfirmed teardown as unresolved (exit 2), Docker errors are reduced and a failed removal names its resource, and no Docker call is made before the run is owned. The corrections await Main's review; gate round 3 added a split of the result publish from the names-file settle. |
| Completed evidence | Program opening merged (PR 77). Dependency check at opening (2026-11-08, Node v26.13.0): `npm outdated`, `npm audit` (10 findings: 1 low, 8 moderate, 1 critical) and `npm audit --omit=dev` (2: DM-P1 group B, unchanged); new minor and major rows recorded in dependency-maintenance DM-F2 and DM-F6. |
| Accepted deviations | The Storage commands need `--experimental` and a relative, existing destination in CLI 2.121.0 (an absolute Windows path fails), so the runbook uses `Resolve-Path -Relative`. `db dump --data-only` omits `supabase_migrations`, so the backup gains `history-schema.sql` and `history.sql` (`--schema supabase_migrations`, schema-only and data-only) for AC7 (c), as plan section 3 foresaw. The CLI publishes the database port on every interface with no option for the address, so `backup:check` recreates the scratch database container with the port on `127.0.0.1` once Auth and Storage have set up their schemas (G7). The run lock of `backup:check` reuses the generation lock of `scripts/test-stack/lock.mjs` in its own directory (`.supabase-backup-check/run/`) instead of a new exclusive-create record, and the AC9 and AC10/G9 corrections share one commit because they share one run flow. |
| Blockers / Owner decisions | None; TM-U1 Owner decisions 9 to 13 are recorded in its plan. |
| Next action | Main reviews the CP3b correction of gate round 2 (and a further Codex round on it if Main decides), then CP4 (final regression); delivery follows under its own grants, and CP5 (first drill) after the merge. |
| Current authority | TM-U1 plan r4 approved and committed; CP3b implemented with local commits (Owner, 2026-11-08). No push, PR, merge, hosted read or hosted write is granted. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-11-08 Program opened: master plan r3 approved after the Codex plan gate, 19 entries moved in, BL-F9 dropped, opening dependency check recorded (PR 77, `09399d3`).
- 2026-11-08 TM-U1 detail plan r3 approved after the Codex plan gate (4c0496a).
- 2026-11-08 TM-U1 CP1 (hook, `15cb31b`, `24b9d64`) and the classifier correction committed locally (e60cfd1).
- 2026-11-08 TM-U1 CP2 committed locally: `backup:check` passed its rehearsal on a dev-stack dump and failed each of its checks on its own (75b1afb).
- 2026-11-08 TM-U1 CP3 committed locally: backup runbook, `AGENTS.md` and `supabase-migration` edits, TM-F6 fixed locally, and the `PreToolUse` hook entry in `.claude/settings.json` (0042fb0).
- 2026-11-08 TM-U1 detail plan r4 approved after its Codex plan gate: the command hook and TM-F6 withdrawn, Owner decision 13 (ab36f8e).
- 2026-11-08 TM-U1 CP3b committed locally: hook removed (e7e1f75), `backup:check` error reduction (686a1a1), atomic run and unresolved paths (37d2fe1), runbook path example (9f763fd).
- 2026-11-08 TM-U1 CP3b corrected locally after implementation Codex gate round 2: run kept until its result is published, atomic result, interrupted-run teardown reported, Docker errors reduced, no Docker call before the run is owned (0b76268).
- 2026-11-08 TM-U1 CP3b corrected locally after implementation Codex gate rounds 2 and 3: a failed Docker query replaces the saved pass (289ce1d), and every non-final result write publishes without settling the names file (this commit).
