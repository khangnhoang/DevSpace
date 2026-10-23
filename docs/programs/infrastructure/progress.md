# Progress — infrastructure

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r2 (2026-10-22), master plan; U5 detail plan r1 (2026-10-24), [u5-payment-flow/plan.md](implementation-plans/u5-payment-flow/plan.md). |
| Current unit / checkpoint | U5 Payment-flow tests, CP1 to CP4 done; CP5 (PR and CI) not started. Branch `test/infra-payment-flow` from `main` at `34b80d9`, local only. |
| Status | CP1 to CP3 implemented by Sonnet in local commits up to `71fbf06`; CP4 mutation check passed; Codex diff gate PASS in round 4. |
| Completed evidence | On `71fbf06`: tsc 0, lint 82, unit 87, `npm test` 152, e2e 46 with `known bug` P5, P6 and P25 lines, local tables restored to the seed and the guard record empty (Main, 2026-10-24). |
| Accepted deviations | The lint baseline is 82 problems since INF-001 (Owner decision 2026-10-23); U6 fixes them. |
| Blockers / Owner decisions | none. |
| Next action | With the Owner's grants, push the branch and open the U5 PR (CP5). |
| Current authority | Implementation of CP1 to CP3 with local commits (granted 2026-10-24). Committing these state records, push, PR creation and merge are not granted. |
| Hosted state | baseline recorded as applied by `migration repair`; hosted lists 4 versions, `20261021000000_baseline` first (`list_migrations`, 2026-10-23). INF-001 has no hosted step. |

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
- 2026-10-23 U3 detail plan r3 written, Codex plan gate PASS in round 3, approved by the Owner (`a024531`).
- 2026-10-23 U3 CP1 to CP4: Vitest unit and rls projects, the RLS matrix with P3, P4, P28 as known bugs, the `db` job step and the `test-quality-strategy` skill; mutation check passed; Codex diff gate PASS in round 3 (`eeea2be`).
- 2026-10-23 U3 merged; CI on head `eeea2be` passed all five jobs, lint 81 problems (PR 15, `adb3262`).
- 2026-10-23 INF-001 resolved: `next` 16.4.3 and `npm audit fix`; lint baseline 82 by Owner decision (`1a13906`).
- 2026-10-23 INF-001 merged; CI on head `9abad27` passed all five jobs, lint 82 problems (PR 16, `fcf4a27`).
- 2026-10-23 U4 detail plan r2 written, Codex plan gate PASS in round 2, approved by the Owner (`96668d7`).
- 2026-10-23 U4 CP1 to CP4: Playwright smoke (22 tests), the `e2e` job, the vendored `playwright-cli` skill; plan r3 adds D23; mutation check passed; Codex diff gate PASS in round 3 (`1ba8712`).
- 2026-10-23 U4 merged; CI on head `06560e6` and the push run on `main` passed all six jobs, `e2e` included, lint 82 problems (PR 17, `34b80d9`).
- 2026-10-24 U4 rollout: the Owner added `e2e` to the required checks on `main` (`6258b7f`).
- 2026-10-24 U5 detail plan r1 written, Codex plan gate PASS in round 2, approved by the Owner (`9b3cbca`).
- 2026-10-24 U5 CP1 to CP4: server guard and mail record, direct server action calls, PF, AP, H and K4 to K8 rows; mutation check passed; Codex diff gate PASS in round 4 (`71fbf06`).
