# Progress — infrastructure

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r2 (2026-10-22), master plan; r1 approved by the Owner 2026-10-22, r2 only renames the units (D11). |
| Current unit / checkpoint | U1 CI skeleton ([detail plan](implementation-plans/u1-ci/plan.md) r2), CP1 and CP2 implemented on `chore/infra-ci`, local only: `7fdffcd`, `8789af7`, corrections `5ff8cc3` and `27cdca4` |
| Status | U1 diff review done: Main review passed after one correction; the four job commands rerun in a clean `git archive 7fdffcd` copy match the plan (typecheck 0, build 0, docs 0, lint 1 with 81 problems). Codex diff gate PASS in round 2 (2026-10-23; round 1 had 1 Required, push concurrency, fixed in `27cdca4`). Not pushed; CP3 not started |
| Completed evidence | Discovery on `50a3075` (2026-10-22): no `.github/`, no schema baseline (3 hotfix migrations only), hosted has 14 public tables, 4 public functions, 47 policies (3 on storage), 1 bucket, triggers on `comments`, `profiles` and `auth.users`, Postgres 17.6; `npm run lint` reports 81 problems (56 errors, 25 warnings); Docker 29.9.1 installed, daemon not running; Supabase CLI not installed. |
| Accepted deviations | none |
| Blockers / Owner decisions | U1 D12: the Owner upgraded GitHub to Pro on 2026-10-22 (the protection API now returns 404 "Branch not protected" instead of 403); protecting `main` waits for the U1 merge |
| Next action | With push and PR grants, Main pushes `chore/infra-ci`, opens the U1 PR and runs CP3 (observe the four jobs, then resolve AW-001 and update FEAT-004 and State) |
| Current authority | Main: commit of this State update, normal push of `chore/infra-ci` and creation of the U1 PR (granted 2026-10-23); Main edits state records. Merge, branch protection, hosted writes and migrations are not granted. Main may run read-only hosted catalog queries (`.claude/rules.md` section 4). |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-22 Master plan r1 written, Codex plan gate PASS in round 2, approved by the Owner (`aa6e318`).
- 2026-10-22 Program created; agent-workflow entries AW-001 and FEAT-002 to FEAT-004, and backlog FEAT-001, moved in (`7969be9`).
- 2026-10-22 Plan PR merged (PR 7, `08f72f2`).
- 2026-10-22 Units renamed from I1-I7 to U1-U7 to follow the master-plan template (`435ca73`).
- 2026-10-22 U1 detail plan r2 written, Codex plan gate PASS in round 2, approved by the Owner (`139d35f`).
