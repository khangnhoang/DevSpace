# Progress — techstack-migration

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | TM-U2 [detail plan](implementation-plans/tm-u2-architecture-adr/plan.md) r3, approved by the Owner on 2026-11-08 after the Codex plan gate and frozen; master [plan.md](plan.md) r3. Owner decisions 18 and 19 were made after it and are recorded below and in ADR 0008. |
| Current unit / checkpoint | TM-U2, CP2 corrected locally after Main's review and the Codex gate (CHANGES REQUIRED, 13 items); CP3 (Codex re-gate, Owner acceptance) not started. |
| Status | In progress: ADR 0008 is `Proposed`. TM-U1 is complete (PR 78, PR 79). |
| Completed evidence | CP1: spikes S1 to S5 passed locally (results and exact versions in ADR 0008 appendix C); cleanup confirmed (no `devspace-local` or `tm-u2` container or volume, dev stack stopped, tree clean). CP2: ADR 0008 and its index row; `npm run docs:check` passed. The correction commit changes only the ADR, its index row and this file; no new spike was run. |
| Accepted deviations | Spike S1 found that a `next.config` rewrite drops the refreshed cookie, so D5 puts the rewrite in `proxy.ts`. **G2 breach, kept visible:** during CP1, raw `supabase status -o json` output, including the keys of the local `devspace-local` stack, was written to a spike log file and then printed into this session's tool output when the file was tailed. The file was deleted at once. The keys belong to that throwaway local stack (since stopped, seed data only). What can be shown: the file no longer exists, `git status` showed a clean tree after CP1, and a pattern search of the three changed docs finds no key. What cannot be shown: that no copy remains elsewhere, for example in this session's own transcript. |
| Blockers / Owner decisions | None open. Owner decision 18 (2026-11-08): the frontend stays on Vercel Hobby on the condition that DevSpace is a graduation project collecting no real money; the Owner accepts that Vercel may disable a Hobby project without notice; before real money is collected the Owner decides again (Pro at 20 USD per seat outside the cap, or a move). Owner decision 19 (2026-11-08): R2 is public at `devspace-assets.vocaspace.com` on the Owner's Cloudflare zone `vocaspace.com`, no domain bought, the DevSpace bucket separate from VocaSpace's, only public-allowed files served, the Owner creates the bucket and DNS record, and no agent touches VocaSpace resources. Owner decisions 14 to 17 are in the TM-U2 plan. |
| Next action | Main re-runs the Codex gate on the corrected ADR; the Owner accepts or amends it (CP3). |
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
- 2026-11-08 TM-U2 CP1 spikes S1 to S5 run locally and CP2 committed locally: ADR 0008 `Proposed` with D1 to D12, the cost table and the TM-U3 list (a430d5e).
- 2026-11-08 TM-U2 ADR 0008 corrected locally after Main's review and the Codex gate: 13 items (backup split, deploy order, rollback phases, server-side CSRF, transport limits, DB keep-alive, cost formula and alerts, Render and Koyeb, fallbacks, versions, Neon Launch, double session check) and Owner decisions 18 and 19 (this commit).
