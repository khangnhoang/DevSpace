# Progress — infrastructure

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r2 (2026-10-22), master plan; r1 approved by the Owner 2026-10-22, r2 only renames the units (D11). |
| Current unit / checkpoint | U1 CI skeleton, planning: [detail plan](implementation-plans/u1-ci/plan.md) r2 on `chore/infra-ci`; implementation of CP1 and CP2 next. |
| Status | U1 planning: detail plan r2 written, self-review done, Codex plan gate PASS in round 2 (`gpt-6.1-sol`, high, read-only; round 1 had 6 Required findings, all fixed; one Nit fixed after). Approved by the Owner 2026-10-22. |
| Completed evidence | Discovery on `50a3075` (2026-10-22): no `.github/`, no schema baseline (3 hotfix migrations only), hosted has 14 public tables, 4 public functions, 47 policies (3 on storage), 1 bucket, triggers on `comments`, `profiles` and `auth.users`, Postgres 17.6; `npm run lint` reports 81 problems (56 errors, 25 warnings); Docker 29.9.1 installed, daemon not running; Supabase CLI not installed. |
| Accepted deviations | none |
| Blockers / Owner decisions | U1 D12 (2026-10-22): the Owner upgrades GitHub to Pro so `main` can require the U1 checks after merge. U1 detail plan r2 approved 2026-10-22. |
| Next action | Main writes the Sonnet brief for CP1 and CP2 and starts the implementor on `chore/infra-ci`. |
| Current authority | Implementation of U1 CP1 and CP2 by one Sonnet session on `chore/infra-ci`, local commits only (granted 2026-10-22). Main edits state records. Push, PR, merge, hosted writes and migrations are not granted. Main may run read-only hosted catalog queries (`.claude/rules.md` section 4). |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-22 Master plan r1 written, Codex plan gate PASS in round 2, approved by the Owner (`aa6e318`).
- 2026-10-22 Program created; agent-workflow entries AW-001 and FEAT-002 to FEAT-004, and backlog FEAT-001, moved in (`7969be9`).
- 2026-10-22 Plan PR merged (PR 7, `08f72f2`).
- 2026-10-22 Units renamed from I1-I7 to U1-U7 to follow the master-plan template (`435ca73`).
- 2026-10-22 U1 detail plan r2 written, Codex plan gate PASS in round 2, approved by the Owner (this commit).
