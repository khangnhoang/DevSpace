# Progress — infrastructure

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r2 (2026-10-22), master plan; the U3 detail plan is not written yet. |
| Current unit / checkpoint | U3 Vitest and RLS tests (branch `test/infra-vitest`), no checkpoint |
| Status | not started |
| Completed evidence | none for U3. U2 evidence is in PR 12 and the milestones below. |
| Accepted deviations | none for U3. U2's accepted deviations (the `lessons.word_count` literal, the baseline's hosted CR bytes, local Postgres 17.11.0.004 against hosted 17.6) are recorded in PR 12 and the baseline header. |
| Blockers / Owner decisions | none |
| Next action | Main writes the U3 detail plan; the Codex plan gate and the Owner's approval follow. The U3 gate is met: U2 merged and `db reset` passes in CI. |
| Current authority | none for U3: implementation, commit, push, PR, merge and any hosted step are not granted |
| Hosted state | baseline recorded as applied by `migration repair`; hosted lists 4 versions, `20261021000000_baseline` first (`list_migrations`, 2026-10-23). U3 has no hosted step. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-22 Master plan r1 written, Codex plan gate PASS in round 2, approved by the Owner (`aa6e318`).
- 2026-10-22 Program created; agent-workflow entries AW-001 and FEAT-002 to FEAT-004, and backlog FEAT-001, moved in (`7969be9`).
- 2026-10-22 Plan PR merged (PR 7, `08f72f2`).
- 2026-10-22 Units renamed from I1-I7 to U1-U7 to follow the master-plan template (`435ca73`).
- 2026-10-22 U1 detail plan r2 written, Codex plan gate PASS in round 2, approved by the Owner (`139d35f`).
- 2026-10-23 U1 merged; push run on `main` passed and `main` protection set (PR 11, `8f9ea0a`).
- 2026-10-23 U2 detail plan r2 written, Codex plan gate PASS in round 3, approved by the Owner (`2589413`).
- 2026-10-23 U2 CP1: Supabase CLI 2.121.0 pinned, local config added (`7b48688`).
- 2026-10-23 U2 CP2: pre-H1 baseline added, Codex gate PASS, first `db reset` matches hosted (`36ff6a7`).
- 2026-10-23 U2 CP3: minimal invented seed; both users sign in on the local stack (`2aa1f44`).
- 2026-10-23 U2 CP4: blocking CI job `db` and the local-stack rules and docs; Codex diff gate PASS (`3161c7d`).
- 2026-10-23 U2 merged; the push run on `main` passed all five jobs, lint 81 problems (PR 12, `49006a9`).
- 2026-10-23 U2 CP6: the Owner recorded the baseline on hosted with `migration repair` (4 hosted versions); `db` added to the required checks on `main` (PR 12, `49006a9`).
