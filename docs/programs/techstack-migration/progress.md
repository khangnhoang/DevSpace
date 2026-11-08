# Progress — techstack-migration

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | TM-U2 [detail plan](implementation-plans/tm-u2-architecture-adr/plan.md) r3, approved by the Owner on 2026-11-08 after the Codex plan gate; master [plan.md](plan.md) r3. |
| Current unit / checkpoint | TM-U2, CP2 committed locally; CP3 (Codex gate, Owner acceptance) not started. |
| Status | In progress: ADR 0008 is written as `Proposed`. TM-U1 is complete (PR 78, PR 79). |
| Completed evidence | CP1: spikes S1 to S5 passed locally (results in ADR 0008 appendix C); cleanup confirmed (no `devspace-local` or `tm-u2` container or volume, dev stack stopped, tree clean). CP2: ADR 0008 and its index row; `npm run docs:check` passed. |
| Accepted deviations | One raw `supabase status` output reached a spike log file for a moment and was deleted at once (G2); no key was printed or stored. Spike S1 found that a `next.config` rewrite drops the refreshed cookie, so D5 puts the rewrite in `proxy.ts`. |
| Blockers / Owner decisions | Open for the Owner after the ADR: the Vercel plan (Hobby is non-commercial and DevSpace takes payments, ADR 0008 D1) and the file domain (D3). Owner decisions 14 to 17 are recorded in the TM-U2 plan. |
| Next action | Main runs the Codex gate on the ADR; the Owner accepts or amends it (CP3). |
| Current authority | Implementation of TM-U2 on branch `docs/tm-u2-architecture-adr` with local checkpoint commits. The grant for the hosted counts and `backup:check` covered backup `20261108-1628` only and is spent. No push, PR, merge, deployment or hosted write is granted. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-11-08 Program opened: master plan r3 approved after the Codex plan gate, 19 entries moved in, BL-F9 dropped, opening dependency check recorded (PR 77, `09399d3`).
- 2026-11-08 Opening dependency check on Node v26.13.0: `npm outdated`, `npm audit` 10 findings (1 low, 8 moderate, 1 critical), `npm audit --omit=dev` 2 (DM-P1 group B, unchanged); new minor and major rows in dependency-maintenance DM-F2 and DM-F6 (PR 77, `09399d3`).
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
- 2026-11-08 TM-U1 CP5 first drill passed on hosted backup `20261108-1628` after the block, version-pin and COPY-count fixes: 50 tables, 17 equal to the hosted counts, 12 migrations, 31 objects with MD5 compared for 31, no scratch container or volume left; hosted postgres 17.6.1.052, gotrue v2.197.0, storage-api v1.89.13 per `hosted.json` (this backup's `manifest.json` still names the stale Storage v1.80.2); backup `20261108-1622` held no dump and was retaken, and `backup:check` passed on its third run after failing on the stale Storage version and then the COPY count (9ad0ddc).
- 2026-11-08 TM-U1 accepted deviations: Storage commands use `--experimental` and a relative destination; `supabase_migrations` is dumped to `history-schema.sql` and `history.sql`; `backup:check` rebinds the scratch database port to `127.0.0.1` after setup, reuses the generation lock in its own directory, and takes the stack versions from `hosted.json` instead of G8's copy; the AC9 and AC10/G9 corrections share one commit because they share one run flow; `npx.cmd` in the backup block and `\n`-only COPY row counts (PR 79, `365a73c`).
- 2026-11-08 TM-U1 CP5 drill fixes merged; TM-U1 complete (PR 79, `365a73c`).
- 2026-11-08 TM-U2 detail plan r3 approved after the Codex plan gate (e212aa6).
- 2026-11-08 TM-U2 CP1 spikes S1 to S5 run locally and CP2 committed locally: ADR 0008 `Proposed` with D1 to D12, the cost table and the TM-U3 list (this commit).
