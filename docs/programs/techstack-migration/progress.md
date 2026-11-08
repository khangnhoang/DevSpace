# Progress — techstack-migration

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | Master [plan.md](plan.md) r3. TM-U3 detail plan [r7](implementation-plans/tm-u3-backend-foundation/plan.md), approved. |
| Current unit / checkpoint | TM-U3 Backend foundation on branch `feat/tm-u3-backend-foundation`: CP1 and CP2 committed locally, CP3 next. |
| Status | In progress: TM-U1 and TM-U2 are complete (PR 78, PR 79, PR 80); ADR 0008 is `Accepted`; TM-U3 is planned and approved, CP1 and CP2 are committed locally. |
| Completed evidence | TM-U1 and TM-U2 evidence is in Milestones. TM-U3 CP1 on Node v26.13.0: root `tsc`, `npm run lint`, `npm run lint:api`, `npm run typecheck:api`, `npm run build` and `npm run build:api` pass; the API build starts and `GET /api/health` answers 200; `npm run dev` served both servers on the dev stack. TM-U3 CP2 on Node v26.13.0: `npm test -- --reset` replayed the `devspace_api` migration and its seed password, then `npm test` on the retained stack passed (66 files, 1137 tests, `rls` role rows API-R1 to API-R6 and `api` rows for AC4, AC13 and AC15); `npm run api:schema:check` matched the test stack, with the dev-stack pull equal to it; root `tsc`, both lints, `typecheck:api` and `docs:check` pass. |
| Accepted deviations | TM-U3 CP1: the workspace install moved three transitive packages in `package-lock.json` (`@standard-schema/spec` 1.0.0 to 1.1.0, `side-channel` 1.1.0 to 1.1.1, `side-channel-list` 1.0.0 to 1.0.1), shared with root dependencies; no direct dependency of the root changed. The through-rewrite half of AC3 is checked at CP4, where the rewrite lands. `drizzle-kit` 0.31.11 `pull` needs a mechanical repair (doubled quotes, an `auth.users` stub) and a canonical form (sorted blocks, no policies) before its output is stable across stacks. The TM-U2 deviations are in Milestones. |
| Blockers / Owner decisions | None open. Owner decisions 20 to 25 are in the TM-U3 plan. The first deploy and every Railway setting stay with the Owner. |
| Next action | The implementor does CP3 to CP5 of the TM-U3 plan; Main reviews each report and the real diff. |
| Current authority | Implementor: CP1 to CP5 on local stacks under G1, with local commits per checkpoint; the dev stack was started and the local role password set once (G1). Main: Railway CLI reads under G10. No push, PR, merge, deployment or hosted write is granted. |

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
- 2026-11-08 TM-U2 ADR 0008 corrected locally after Main's review and the Codex gate: 13 items (backup split, deploy order, rollback phases, server-side CSRF, transport limits, DB keep-alive, cost formula and alerts, Render and Koyeb, fallbacks, versions, Neon Launch, double session check) and Owner decisions 18 and 19 (f792e99).
- 2026-11-08 TM-U2 ADR 0008 corrected locally after Codex round 2: server-side caller rules for the CSRF helper, an upload and long-call gate with pass conditions for TM-U5, TM-U8 and TM-U10, rollback order before and after the restriction, a usable alert or substitute and fallback for every limit with a recommended uptime monitor, and Koyeb priced and rejected on evidence (7216f88).
- 2026-11-08 TM-U2 CP3 committed locally: the Codex gate passed in round 3 at `7216f88` and the Owner accepted ADR 0008, so its status is `Accepted`; TM-U2 completes when its PR is merged (`1128080`).
- 2026-11-08 TM-U2 accepted deviation: spike S1 found that a `next.config` rewrite drops the refreshed cookie, so D5 puts the rewrite in `proxy.ts` (PR 80, `4646e5a`).
- 2026-11-08 TM-U2 G2 breach, kept visible: during CP1, raw `supabase status -o json` output with the keys of the local `devspace-local` stack was written to a spike log and printed into that session's tool output; the file was deleted at once, the keys belong to that throwaway local stack (since stopped, seed data only), `git status` was clean after CP1 and a pattern search of the three changed docs found no key; that no copy remains elsewhere, for example in that session's transcript, cannot be shown (PR 80, `4646e5a`).
- 2026-11-08 Owner decision 18: the frontend stays on Vercel Hobby on the condition that DevSpace is a graduation project collecting no real money; the Owner accepts that Vercel may disable a Hobby project without notice and decides again before real money is collected (Pro at 20 USD per seat outside the cap, or a move) (PR 80, `4646e5a`).
- 2026-11-08 Owner decision 19: R2 is public at `devspace-assets.vocaspace.com` on the Owner's Cloudflare zone `vocaspace.com`, no domain bought, the DevSpace bucket separate from VocaSpace's, only public-allowed files served; the Owner creates the bucket and DNS record, and no agent touches VocaSpace resources (PR 80, `4646e5a`).
- 2026-11-08 TM-U2 delivered: ADR 0008 accepted, CI passed with `db` and `e2e` skipped as docs-only; TM-U2 complete (PR 80, `4646e5a`).
- 2026-11-08 TM-U3 detail plan r7 approved after the Codex plan gate; ADR 0008 Context records decision 23; Railway CLI 5.71.0 installed globally as machine setup for this unit (`9332601`).
- 2026-11-08 TM-U3 CP1 committed locally: `backend/` workspace, health route, backend lint and build, and the two-server dev launcher (`bc77e67`).
- 2026-11-08 TM-U3 CP2 committed locally: `devspace_api` migration and rollback, local role password in the seed, pool, `/api/health/db` with one probe per 10 seconds, startup checks, Drizzle schema generation and diff check, and the `api` Vitest project under a network guard (this commit).
