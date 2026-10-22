# Progress — infrastructure

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r2 (2026-10-22), master plan; r1 approved by the Owner 2026-10-22, r2 only renames the units (D11). |
| Current unit / checkpoint | U1 CI skeleton ([detail plan](implementation-plans/u1-ci/plan.md) r2), CP3 on [PR 11](https://github.com/khangnhoang/DevSpace/pull/11) (`chore/infra-ci`) |
| Status | CP1 and CP2 done (`7fdffcd`, `8789af7`, corrections `5ff8cc3`, `27cdca4`); Codex diff gate PASS in round 2. CP3: run 39821844267 (event `pull_request`, head `cf8031e`, checkout `refs/remotes/pull/11/merge`) passed all four jobs; build log shows the placeholder URL and no hosted host; lint step log shows 81 problems; Vercel passed. Lint-step docs corrected in `a977593` (Main review) |
| Completed evidence | Discovery on `50a3075` (2026-10-22): no `.github/`, no schema baseline (3 hotfix migrations only), hosted has 14 public tables, 4 public functions, 47 policies (3 on storage), 1 bucket, triggers on `comments`, `profiles` and `auth.users`, Postgres 17.6; `npm run lint` reports 81 problems (56 errors, 25 warnings); Docker 29.9.1 installed, daemon not running; Supabase CLI not installed. |
| Accepted deviations | AC5 says the lint step is marked failed; GitHub reports its conclusion as `success` under `continue-on-error`, and the result is only in its log (`##[error]` lines, "81 problems"). The guardrail G5 holds; the docs say so since `a977593` |
| Blockers / Owner decisions | U1 D12: the Owner upgraded GitHub to Pro on 2026-10-22 (the protection API now returns 404 "Branch not protected" instead of 403); protecting `main` waits for the U1 merge |
| Next action | After CI passes on the new head, the Owner decides the merge; after merge, CP4 (push run on `main`) and the branch protection step (D12, separate grant) |
| Current authority | Main: commit of the state records and a normal push of `chore/infra-ci` to PR 11 (granted 2026-10-23). Merge, branch protection, hosted writes and migrations are not granted. Main may run read-only hosted catalog queries (`.claude/rules.md` section 4) |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-22 Master plan r1 written, Codex plan gate PASS in round 2, approved by the Owner (`aa6e318`).
- 2026-10-22 Program created; agent-workflow entries AW-001 and FEAT-002 to FEAT-004, and backlog FEAT-001, moved in (`7969be9`).
- 2026-10-22 Plan PR merged (PR 7, `08f72f2`).
- 2026-10-22 Units renamed from I1-I7 to U1-U7 to follow the master-plan template (`435ca73`).
- 2026-10-22 U1 detail plan r2 written, Codex plan gate PASS in round 2, approved by the Owner (`139d35f`).
