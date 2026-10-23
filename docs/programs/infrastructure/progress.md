# Progress — infrastructure

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r2 (2026-10-22), master plan; U4 detail plan r3 (2026-10-23), [u4-playwright-smoke/plan.md](implementation-plans/u4-playwright-smoke/plan.md). |
| Current unit / checkpoint | U4 Playwright smoke, CP1 to CP3 committed (`9695dde`, `29de673`, `a2b772c`) with corrections `86d4027`, `209924b` and `f91ff02`; CP4 done. |
| Status | Plan r2 approved (Codex plan gate PASS in round 2); r3 adds D23, approved by the Owner. CP4 mutation check passed; Codex diff gate PASS in round 3 (round 1: redirect hops and AC1 evidence; round 2: the S5 exception in the Spec and its matcher). Not pushed. |
| Completed evidence | After `f91ff02` and `db reset` (implementor), and again by Main: `npm run test:e2e` 22 passed; S5 20 of 20 under `--repeat-each=20`. After `209924b` and `db reset`: `npm run test:e2e` 22 passed twice, then `npm test` 114 passed; no learner course-1 enrollment or `enrollment` notification left. tsc 0, lint 82, `docs:check` 0 new broken links. Mutation check: the student enrollment removed fails T1, T2 and A1 dashboard; admin role set to `user` fails the 7 admin tests; a learner enrollment in course 2 fails L2. |
| Accepted deviations | The `next build` runs inside the Playwright `webServer` command; the vendored `LICENSE` keeps CRLF through `.gitattributes`; one upstream link inside a code fence is in `scripts/docs/link-baseline.txt`; ESLint ignores the Playwright output folders; A1 chapters selects the course first; Chromium runs with `--host-resolver-rules` because Playwright does not route redirect hops. The lint baseline is 82 problems since INF-001 (Owner decision 2026-10-23); U6 fixes them. |
| Blockers / Owner decisions | none. |
| Next action | With the Owner's grants: commit this State and plan r3, push `test/infra-playwright`, open the PR; then CP5 (CI result in the PR body, FEAT-002 and FEAT-004 status). |
| Current authority | U4 r3 implementation, CP1 to CP3 and their corrections, local commits only; Main's plan commit. Push, PR creation and merge are not granted. |
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
- 2026-10-23 U4 CP1 to CP4: Playwright smoke (22 tests), the `e2e` job, the vendored `playwright-cli` skill; plan r3 adds D23; mutation check passed; Codex diff gate PASS in round 3 (this commit).
