# Progress — infrastructure

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r2 (2026-10-22), master plan; U3 detail plan `implementation-plans/u3-vitest-rls/plan.md` r3 (2026-10-23), approved by the Owner. |
| Current unit / checkpoint | U3 Vitest and RLS tests (branch `test/infra-vitest`): CP1 (`2f4abfb`), CP2 (`94b1426`), the `@types/node` correction (`3905e9a`), CP3 (`58fe82b`), Codex corrections (`1e4401a`, `76b4b42`), state records (this commit); CP4 done, CP5 next |
| Status | CP1 to CP4 done; Codex diff gate PASS in round 3 on `a024531..76b4b42`; not pushed. |
| Completed evidence | On `76b4b42`: `npx supabase db reset` exit 0; `npm test` 9 files and 94 tests (30 unit, 64 rls), twice with no reset between; `npx tsc --noEmit` exit 0; `npm run lint` 81 problems; `git diff 8606dcf -- app lib proxy.ts next.config.ts supabase/migrations supabase/rollbacks` empty. CP4 mutations on the local stack: an `anon` grant on `lessons` fails [C3] twice, a `using (true)` SELECT policy on `profiles` fails [P1] and [P2], dropping `prevent_role_escalation` fails [P7]; a permissive UPDATE policy on `chapters` fails the [C7] chapter update and leaves no marker row. CI not run yet (CP5). |
| Accepted deviations | U3: `vitest.config.mts` instead of `.ts` (no ESM warning); an extra `__tests__/rls/setup.test.ts` (Vitest 5 skips a global setup with no test file); `@types/node` `^22` to match production's Node 22.x (Vitest 5 needs `^22` or `>=24`); [N4]'s admin insert has no returning clause (the admin has no SELECT policy on another user's notification); several matrix rows split into several named tests; the [C7] update and delete targets are marker rows the test creates, not seed rows, so a regression cannot cascade through the seed; the skill is 88 lines plus two references; under an agent environment Vitest uses its minimal reporter, so `knownBug` also prints `known bug <id>` on stdout. U2's accepted deviations (the `lessons.word_count` literal, the baseline's hosted CR bytes, local Postgres 17.11.0.004 against hosted 17.6) are recorded in PR 12 and the baseline header. |
| Blockers / Owner decisions | none. U3 decisions D15 to D18 taken on 2026-10-23 (in the U3 plan). Dependency findings and the Node 26 decision are in INF-001 and FEAT-001. |
| Next action | With the Owner's push and PR grants, Main pushes `test/infra-vitest`, opens the PR, watches CI (CP5: the `db` log shows the tests and the `known bug P3/P4/P28` lines) and writes the result into the PR body. |
| Current authority | the plan commit and the U3 implementation, with local checkpoint commits (granted 2026-10-23). Push, PR creation and merge are not granted; U3 has no hosted step. |
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
- 2026-10-23 U3 detail plan r3 written, Codex plan gate PASS in round 3, approved by the Owner (`a024531`).
- 2026-10-23 U3 CP1 to CP4: Vitest unit and rls projects, the RLS matrix with P3, P4, P28 as known bugs, the `db` job step and the `test-quality-strategy` skill; mutation check passed; Codex diff gate PASS in round 3 (this commit).
