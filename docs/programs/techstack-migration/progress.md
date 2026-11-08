# Progress — techstack-migration

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | TM-U1 [detail plan](implementation-plans/tm-u1-guardrails-backup/plan.md) r4 (the command hook withdrawn, Owner decision 13), approved by the Owner on 2026-11-08 and committed at `ab36f8e`; master [plan.md](plan.md) r3. |
| Current unit / checkpoint | TM-U1 delivered in PR 78 (`00327f1`); CP5 (first drill) passed on 2026-11-08. TM-U2 is not opened. |
| Status | In progress: TM-U1 is complete except that its drill fixes are local on branch `docs/backup-runbook-one-paste`, not merged. CP5 on the hosted backup `20261108-1628` passed all four `backup:check` comparisons (AC11): (a) 50 tables, (b) 17 tables equal to the hosted counts, (c) 12 migrations, (d) 31 objects with MD5 compared for 31. No scratch container or volume remained. |
| Completed evidence | Program opening merged (PR 77). Dependency check at opening (2026-11-08, Node v26.13.0): `npm outdated`, `npm audit` (10 findings: 1 low, 8 moderate, 1 critical) and `npm audit --omit=dev` (2: DM-P1 group B, unchanged); new minor and major rows recorded in dependency-maintenance DM-F2 and DM-F6. |
| Accepted deviations | The Storage commands need `--experimental` and a relative, existing destination in CLI 2.121.0 (an absolute Windows path fails), so the runbook uses `Resolve-Path -Relative`. `db dump --data-only` omits `supabase_migrations`, so the backup gains `history-schema.sql` and `history.sql` (`--schema supabase_migrations`, schema-only and data-only) for AC7 (c), as plan section 3 foresaw. The CLI publishes the database port on every interface with no option for the address, so `backup:check` recreates the scratch database container with the port on `127.0.0.1` once Auth and Storage have set up their schemas (G7). The run lock of `backup:check` reuses the generation lock of `scripts/test-stack/lock.mjs` in its own directory (`.supabase-backup-check/run/`) instead of a new exclusive-create record, and the AC9 and AC10/G9 corrections share one commit because they share one run flow. CP5 found three defects the invented fixtures could not show, fixed in the drill: `npx` in PowerShell is `npx.ps1`, which dropped the arguments of the backup block (now `npx.cmd`, and an empty dump is refused); the scratch stack was pinned to the checkout's stale `.temp` versions (now the `versions` of `hosted.json`, read from `supabase services`); the COPY row count split lines at U+2028 and U+2029 (now `\n` only). |
| Blockers / Owner decisions | None; TM-U1 Owner decisions 9 to 13 are recorded in its plan. |
| Next action | Deliver the drill fixes of branch `docs/backup-runbook-one-paste` under their own grants, with the Codex gate before the push; then open TM-U2. |
| Current authority | TM-U1 plan r4 approved; the Owner granted the hosted counts and `backup:check` for backup `20261108-1628` only (2026-11-08). No push, PR, merge or hosted write is granted. |

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
- 2026-11-08 TM-U1 CP3b corrected locally after implementation Codex gate rounds 2 and 3: a failed Docker query replaces the saved pass (289ce1d), and every non-final result write publishes without settling the names file (7fe52e3).
- 2026-11-08 TM-U1 implementation Codex gate passed and CP4 final regression passed: `npm test` 1101 tests, `npm run test:e2e` 170 tests, build, `tsc`, lint and `docs:check` (7fe52e3).
- 2026-11-08 TM-U1 `backup:check` rehearsed on real Docker with the invented CP2 fixtures after CP3b: pass, fail, refusal and kill-and-recover cases behaved as AC7 to AC10 require (43519a5).
- 2026-11-08 TM-U1 delivered: guardrails and backup drill merged after CI passed (PR 78, `00327f1`).
- 2026-11-08 TM-U1 CP5 first drill passed on hosted backup `20261108-1628` after the block, version-pin and COPY-count fixes (this commit).
