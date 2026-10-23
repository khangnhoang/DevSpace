# U3 detail plan — Vitest and RLS tests

Revision: r3, 2026-10-23 (r2 and r3 fix the Codex round 1 findings: K rows prove the persisted change, P10 reads the catalog, a malicious sign-up row, E3, N2 and C7 isolate their policy, the missing `rpc-trigger-concurrency.md` line, the CP1 grep against AC3; seed identity ids and per-test restore; round 2: K1's insert precondition, service-role verification reads in G1, a separate P12 client). Owner approval: 2026-10-23 (r3). Master plan: [plan.md](../../plan.md) (unit U3, decisions D5, D6, D7 and D9; rollout order step 4).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: Vitest runs unit tests and RLS tests against the local Supabase stack, on the Owner's machine and in the blocking CI job `db`. The RLS tests lock in the security boundaries that H1 and H2-1 set and the per-user ownership rules, and they record the known bugs P3, P4 and P28 as expected failures. A DevSpace `test-quality-strategy` skill, `CLAUDE.md` and the skills that mention testing describe this tooling and nothing that does not exist yet.

| ID | Observable result |
| --- | --- |
| AC1 | On the Owner's machine, after `npx supabase start` and `npx supabase db reset`, `npm test` exits 0 and runs both projects, `unit` and `rls`. Running `npm test` a second time with no reset in between also exits 0. |
| AC2 | With Docker stopped, `npm run test:unit` exits 0 and runs only the `unit` project. |
| AC3 | The `rls` project takes its API URL and keys only from `npx supabase status -o json`. When the stack is down, or the reported API URL's host is not `127.0.0.1` or `localhost`, the run fails in setup with a message that names the local stack, and no test request is sent. A unit test of the host check accepts `http://127.0.0.1:54321` and `http://localhost:54321` and rejects `https://lkvxxrxojjlkchzzqidu.supabase.co`, `http://127.0.0.1.evil.example` and an empty value. No test or config reads `.env*` or `NEXT_PUBLIC_SUPABASE_URL`. |
| AC4 | The CI job `db` runs `npm test` after `npx supabase db reset`, on every pull request to `main` and every push to `main`. A failing test, an unexpectedly passing known bug, or a setup failure fails the job. The job id stays `db`, so `main`'s required checks need no change. |
| AC5 | Every row of the RLS matrix (Appendix A) is one named test that sends the request as that actor through the local API with `@supabase/supabase-js` and asserts the observable result: rows returned, an empty result, or an error with its PostgreSQL code. A denied write asserts the RLS or privilege code `42501` (or zero affected rows where Appendix A says so) and that nothing was written, so a constraint error such as `23505` or `23503` never counts as a denial. A select that must return no rows first proves, through the service role or the owner, that the hidden rows exist. The one exception is P10, a catalog check (`has_function_privilege`) run through a local Postgres connection, because `handle_new_user` returns `trigger` and an API call would fail before any privilege check. |
| AC6 | The known bugs P3, P4 and P28 (Appendix A, rows K1 to K3) each run as a test whose name starts with its ID. Each first asserts its preconditions as normal checks: for K2 and K3 (updates) the target row exists, belongs to the expected user and holds its initial value; for K1 (an insert) the student's enrollment in course 2 exists and no review by the learner on course 2 exists yet; after the request it reads the persisted state back through the service role, and only the assertion that this state is unchanged (the correct behavior: the K2 and K3 row keeps its value, no K1 review exists) is the bug assertion. While the bug exists, the test passes and is reported as a known bug. If the bug's assertion starts to hold (the bug was fixed), the test fails with a message telling the reader to turn it into a normal test. If anything else fails (sign-in, network, a setup query, a precondition, an unexpected error code such as `23505`), the test fails. A unit test of the helper shows all three outcomes. |
| AC7 | After `db reset`, the seed also holds `student@devspace.test` (role `user`), enrolled in the paid course with an approved payment, and the rows Appendix A needs (Appendix B). The U2 rows (both users, both courses, their chapters and lessons) are unchanged. All three users get an access token from the local Auth endpoint with the password written in `seed.sql`. |
| AC8 | `__tests__/unit` holds a unit test of `safeNextPath` (`lib/safe-next-path.ts`): both allowlisted paths are returned unchanged; `null`, `""`, an unknown path, `https://evil.example`, `//evil.example`, `javascript:alert(1)` and `/auth/reset-password?x=1` return `/`. |
| AC9 | A skill `.claude/skills/test-quality-strategy/SKILL.md` exists with `name`, `description`, "Use when", "Do not use when", a read condition for each reference, and about 150 lines. It describes the unit and RLS layers, placement, naming, the known-bug pattern, test data and cleanup, the commands and how to report evidence; Playwright smoke tests (U4) and server action tests (U5) are named once as deferred. |
| AC10 | `CLAUDE.md` Commands lists `npm test` and `npm run test:unit`, says the `db` job runs the tests, and no longer says there are no automated tests; rule 9 points to the skill. `supabase-migration` (`SKILL.md` hard rules and Workflow step 3, `references/rls-and-storage.md` Verification details) says a policy or grant change adds or updates RLS tests and runs them locally before any hosted step, and that Main's hosted postflight stays. `code-review` `references/domain-dimensions.md`, `planning` `SKILL.md` step 9 and `references/qa-matrix.md`, `supabase-migration` `references/rpc-trigger-concurrency.md`, `docs/agent-loops.md` Sizing condition 4 and `git-pr-workflow` `references/pr-and-ci.md` Watch CI match the new tooling. `grep -rn -i "no automated tests\|later tests\|deferred to U3\|do not exist yet" CLAUDE.md .claude docs/agent-loops.md` finds nothing; the "no automated browser or frontend test" lines stay, since they are still true until U4. |
| AC11 | No product behavior changes: `git diff 8606dcf -- app lib proxy.ts next.config.ts supabase/migrations supabase/rollbacks` is empty. `npx tsc --noEmit` exits 0, `npm run lint` still reports 81 problems, and the `build` job passes on the PR. |

### 1.2 Scope and non-goals

- In scope (implementor): the `vitest`, `pg` and `@types/pg` devDependencies and lockfile; `vitest.config.ts`; the `test` and `test:unit` scripts; `__tests__/unit` and `__tests__/rls` with their helpers; the seed additions in `supabase/seed.sql`; the `npm test` step in the `db` job; the new skill and the doc edits in AC10.
- In scope (Main): reading the VocaSpace source (D15); the mutation check (CP4); the state records: infrastructure `progress.md`, FEAT-002, FEAT-003 and FEAT-004 status, and the agent-workflow `progress.md` State lag that the Owner folded into this PR (2026-10-23): status merged, no initiative open, next action none, authority none, and the milestone "U3 merged (PR 14, `8606dcf`)".
- Non-goals: fixing P3, P4, P28 or any other security-hotfix problem; tests of P10 (Storage), P11 (GraphQL) and P27; server action, component or browser tests (U4, U5); counting RLS function calls or other performance checks (D18); coverage targets; tests against hosted; new migrations; any product code change; a separate CI job for unit tests.

### 1.3 Execution guardrails

Only guardrails whose omission causes a concrete failure.

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The `rls` setup reads the API URL, the database URL and the keys from `npx supabase status -o json` only, refuses either URL when its host is not `127.0.0.1` or `localhost`, and Vitest loads no env file (`.env.local` points at hosted). The service-role key is used only to prepare fixtures, to read state back for verification, and to clean up; it never sends the request under test. | A test run writes to or reads from production (shared invariant 1), or a test passes because the service role bypassed RLS. |
| G2. A known bug is an expected failure only through the AC6 helper; plain `test.fails` and skipped tests are not used for it. Any other surprising behavior found while writing tests is reported to Main, who records it in `security-hotfix/problems.md`; it is not encoded as expected. | A sign-in or network error counts as "bug reproduced" and the suite stays green while it tests nothing (shared invariant 6, master plan risk "characterization tests freeze bugs"). |
| G3. A test that writes removes the rows it added and restores the rows it changed (a role, a note, a soft-delete) through the local service role, even when the test fails: in `afterEach` for a shared seed row (a role, the seed note, comment or progress row), in `afterAll` only for rows the file itself created; the `rls` files run one at a time. A test never depends on another file's writes. | A failed P9 leaves the learner an admin and every later learner test is wrong; AC1's second run fails; results depend on file order. |
| G4. Each actor signs in once per run, in the global setup, and the tokens are handed to the tests; P12 is the only sign-up. | The local Auth limit (`sign_in_sign_ups = 30` per 5 minutes) answers 429 and the second local run fails. |
| G5. Seed additions are invented, use `.test` addresses and passwords marked as local test values, and do not change any U2 row or id; new rows use explicit ids above the U2 ones and the sequences are moved past them. | Real data enters the repo, or U2's evidence and U4's planned flows break. |
| G6. No file under `app`, `lib`, `supabase/migrations` or `supabase/rollbacks` changes, nor `proxy.ts` or `next.config.ts` (AC11). | An infrastructure PR hides a behavior change (shared invariant 4). |
| G7. Rules, skills and `CLAUDE.md` state only the tooling this PR adds; the VocaSpace text is rewritten for DevSpace, with English test-plan headers (`.claude/rules.md` section 1) and no VocaSpace layer DevSpace does not have. | Agents follow instructions for tools that do not exist (shared invariant 7). |

### 1.4 Owner decisions that bind this unit

- D5: U3 follows U2; D6: the seed is invented and grows with the tests; D7: no hosted secret in CI; D9: skills, rules and `CLAUDE.md` change in this PR (FEAT-002 test-quality-strategy part, FEAT-003 RLS part, FEAT-004 U3 part).
- D14 (from U2): U3 adds its tests after the reset in the `db` job.
- D15 (2026-10-23, new, binds this unit only): Main reads `C:\VocaSpace\.agents\skills\test-quality-strategy\` read-only at commit `10995b265b448ef725ec0abba687b24387ec51b5` and rewrites it for DevSpace. This is the only exception to "VocaSpace is off limits" (`.claude/rules.md` section 4); nothing in VocaSpace is changed, and the implementor gets Main's notes, not the VocaSpace path.
- D16 (2026-10-23, new, binds this unit only): the RLS tests cover the security boundaries: the H1 and H2-1 boundaries, the per-user tables (enrollments, payments, notes, user progress, notifications) and admin content writes, with P3, P4 and P28 as expected failures (Appendix A).
- D17 (2026-10-23, new, binds this unit only): the seed grows to serve the tests: one enrolled learner `student@devspace.test` and the rows in Appendix B.
- D18 (2026-10-23, new, binds this unit only): counting RLS function calls (`pg_stat_user_functions`) is not part of U3; performance checks stay deferred with agent-workflow FEAT-011.

## 2. Repository facts

Only facts that justify a Spec item or expose a conflict. Frozen after approval.

Baseline: `8606dcf`, checked 2026-10-23.

- `package.json` has no test runner and no `test` script; `@supabase/supabase-js` `^2.83.0` is already a dependency; `npm view vitest` reports 5.0.5 with engines `^22.12.0 || ^24.0.0 || >=26.0.0`; CI and the Owner's machine run Node 24 — justifies AC1, AC2 and the dependency choice.
- `ci.yml` job `db` runs `npx supabase start -x ...` then `npx supabase db reset`, with a comment that later units extend it; `timeout-minutes: 20` — justifies AC4 and D14.
- `npx supabase status -o json` on the local stack reports `API_URL` `http://127.0.0.1:54321` and the CLI's published demo keys — justifies AC3 and G1.
- `supabase/config.toml:208` sets `sign_in_sign_ups = 30` — justifies G4.
- `supabase/seed.sql` holds two users, two courses (ids 1 and 2, course 2 paid), two chapters and four lessons, and no enrollment, exercise, coupon, payment, note, progress, notification, review or comment — justifies D17 and AC7.
- Policies after the published migrations: `profiles` SELECT self or admin; `profile_cards` view readable by `anon` and `authenticated` with writes revoked; no SELECT policy on `coupons`; `lessons` SELECT limited to the columns granted in H2-1b; `exercises` SELECT for enrolled learners or admin; `prevent_role_escalation` on `profiles`; `handle_new_user` not executable by `anon` or `authenticated`; `enrollments` INSERT only for oneself into a course with price 0; `payments` SELECT own only and no INSERT policy — justifies Appendix A.
- `reviews` INSERT checks only that `auth.uid()` is enrolled in the course, not `user_id` (P3). `comments` UPDATE has `USING (auth.uid() = user_id or admin)` and no `WITH CHECK`, so the check on the new row reuses `USING`: the owner cannot hand a comment to another user but can move it to another lesson. `security-hotfix/problems.md` P4 says the owner "can change `user_id`", while `supabase-migration` `references/rls-and-storage.md` names the lesson move — a conflict: K2 asserts the reachable form, and Main corrects the P4 wording in `problems.md` as a state record. `profiles` UPDATE lets a user change their own `email` (P28) — justifies K1 to K3.
- `handle_new_user` returns `trigger` (H1 line 9) and H1 revokes its execute grant (line 87); the baseline version read the role from `raw_user_meta_data` (baseline line 97), which H1 replaced with a fixed `'user'`; `enable_confirmations = false` in `config.toml`, so a local sign-up returns a session at once — justifies P10 as a catalog check and P12.
- `comments`, `coupons`, `enrollments`, `notes`, `notifications`, `payments` and `reviews` have `GENERATED ALWAYS` identity ids; `exercises` and `user_progress` are `BY DEFAULT`; `user_progress` is unique on `(user_id, lesson_id)` and `enrollments` on `(user_id, course_id)` — justifies Appendix B and the E3 and N2 data choices.
- `lib/safe-next-path.ts` exports `safeNextPath`, a pure function with no server import — justifies AC8. `lib/auth.server.ts` imports `server-only` and needs a request context, so it is not a unit target here.
- Stale text U3 must rewrite: `CLAUDE.md:15` ("There are no automated tests"), `CLAUDE.md:13` (the `db` job only runs `db reset`), `CLAUDE.md:35` (rule 9 "When tests exist"), `code-review` `references/domain-dimensions.md:19`, `supabase-migration` `SKILL.md:23` ("Automated RLS tests are deferred to U3") and `:65`, `references/rls-and-storage.md:27` (RLS checks run on hosted after approval), `references/rpc-trigger-concurrency.md:34` ("Automated RLS tests do not exist yet"), `planning` `SKILL.md:29`, `references/qa-matrix.md:5` ("two users"), `docs/agent-loops.md:21` ("later tests"), `git-pr-workflow` `references/pr-and-ci.md:33` (what a red `db` job means) — justifies AC10.
- VocaSpace `test-quality-strategy` at `10995b2` is 413 lines plus 4 references; its layers include Zod schemas, components, server actions and smoke E2E, which DevSpace does not have; its test-plan header is Vietnamese; it puts tests under `__tests__/<layer>` — justifies AC9, G7 and the placement hypothesis.

## 3. Bounded implementation hypotheses

Each names what may change and which Spec or guardrail facts must stay true.

- `vitest` `^5.0.5`, and `pg` `^8.23.1` with `@types/pg` for the P10 catalog check, as devDependencies. `vitest.config.ts` defines two projects: `unit` (`__tests__/unit/**/*.test.ts`, Node environment) and `rls` (`__tests__/rls/**/*.test.ts`, a global setup, `fileParallelism: false`), an `@` alias to the repo root, and env-file loading turned off. Scripts: `"test": "vitest run"`, `"test:unit": "vitest run --project unit"` — may change if AC1 to AC3, G1 and G3 hold.
- The `rls` global setup runs `npx supabase status -o json`, checks the host, signs in `learner`, `student` and `admin` once, and hands the API URL, database URL, anon key, service key and tokens to the tests through Vitest's `provide` and `inject`. A helper builds one client per actor (`anon`, `learner`, `student`, `admin`) with sessions off; P12 uses its own client that shares no storage or session with them, because `signUp` keeps the new session in memory even with `persistSession: false` and the shared `anon` client would then send a user token — may change if G1 and G4 hold.
- `knownBug(id, title, fn)` wraps a plain `it` and passes `fn` a `bug(check)` function that marks the one assertion describing the correct behavior. Only an assertion failure inside `bug(...)` counts as "still reproduces": the test passes and logs `known bug <id>`. An ordinary `expect` failure or any thrown error fails the test, so each K row first asserts with plain `expect` that the request reached the database (no error, or only the expected `42501`), and a `23505` or a sign-in error cannot pass as the bug. If `bug(...)` holds, the test fails with "`<id>` no longer reproduces: turn this into a normal test". Its own unit test lives in `__tests__/unit` — may change if AC6 and G2 hold.
- RLS test files by area: `profiles.test.ts` (profiles, `profile_cards`, role escalation, `handle_new_user`, P28), `content.test.ts` (courses, chapters, lessons, exercises, admin writes), `learner-data.test.ts` (enrollments, payments, notes, progress, notifications), `community.test.ts` (reviews, comments, P3, P4), `coupons.test.ts`. Each starts with an English test-plan header (goal, actors, allowed and denied paths, known bugs); it records no "last result", which would go stale — may change if AC5 holds.
- The seed additions follow Appendix B, after the U2 statements, reuse the U2 user insert shape, and insert explicit ids into `GENERATED ALWAYS` tables with `overriding system value` — may change if AC7 and G5 hold.
- The CI change is one step `- run: npm test` after `npx supabase db reset`, with a comment; `timeout-minutes` stays 20 unless CP5 shows the job above 15 minutes — may change if AC4 holds.
- The skill is `SKILL.md` plus at most two references (test-plan header and known-bug pattern; RLS test design), each with a read condition — may change if AC9 and G7 hold.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 (Sonnet) | Vitest, config, scripts, the `rls` global setup with its host check, the `knownBug` helper and its unit test, the `safeNextPath` test (AC2, AC3, AC6 helper part, AC8, G1, G4). | `npm run test:unit` exits 0 with Docker stopped and includes the host-check, `knownBug` and `safeNextPath` tests; with the stack stopped `npm test` fails in setup with the local-stack message; `grep -rn "\.env\|NEXT_PUBLIC_SUPABASE_URL\|process\.env" vitest.config.ts __tests__` finds nothing; a hosted URL appears only as rejected input in the host-check unit test, and the setup calls the host check before creating any client; `npx tsc --noEmit` exits 0; `npm run lint` 81 problems. |
| CP2 (Sonnet) | Seed additions and every Appendix A row, K1 to K3 included (AC1, AC5 to AC7, G2, G3, G5). | `npx supabase db reset` exits 0; `npm test` exits 0 twice in a row with no reset between; SQL counts of the Appendix B rows through `psql` on `127.0.0.1:54322`; `grep -n "@" supabase/seed.sql` shows only `.test` addresses; `git diff 8606dcf -- supabase/seed.sql` shows only additions after the U2 statements; tsc and lint as CP1. |
| CP3 (Sonnet) | The CI step, the skill and the doc edits (AC4, AC9, AC10, G7). | `git diff --check`; `grep -n "secrets\.\|--linked\|--db-url\|db push" .github/workflows/ci.yml` finds nothing; the AC10 grep; `wc -l` of the skill; `npm run docs:check` and `npm run docs:check:test` pass. |
| CP4 (Main) | Review of CP1 to CP3 and a mutation check that the tests catch regressions. | On the local stack only, Main applies each throwaway change with `psql` and runs `npm test`, expecting at least one named failure: grant `select` on `lessons` back to `anon`; recreate a `profiles` SELECT policy `using (true)`; drop the `prevent_role_escalation` trigger. `npx supabase db reset` after each. Then the Codex diff gate on CP1 to CP3. |
| CP5 (Main, on the PR) | AC4 and AC11 observed in CI; state records updated. | `gh pr checks <n>` shows `typecheck`, `build`, `docs`, `lint`, `db` and Vercel; the `db` log shows the test summary with K1 to K3 reported as known bugs; the lint step shows 81 problems; `npm run docs:check`. |

The implementor does CP1 to CP3 as local commits, one per checkpoint after its self-review passes (`docs/agent-loops.md` Self-review, `git-pr-workflow` Commit), and edits no state record. The Codex gate runs on this plan and on the CP1 to CP3 diff before push. Commit, push, PR and merge are separate grants.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| An expected failure hides a broken setup and the suite tests nothing. | G2 and the AC6 helper; CP4's mutation check proves real failures surface. |
| Tests depend on each other's writes or on file order, so a rerun or a new test breaks unrelated tests. | G3; AC1's second run; files run one at a time. |
| A PostgREST error shape differs from the assumption (for example a column denial returns an error, not an empty row). | AC5 asserts the observed result per row; CP2 runs every row against the real stack before it is committed; a row whose real result contradicts Appendix A is returned to Main, never adjusted silently. |
| The seed grows into a second copy of production. | D6 and D17: only the rows Appendix B lists; G5. |
| `next build` type-checks `__tests__` and `vitest.config.ts` (`tsconfig.json` includes `**/*.ts`), so a test type error breaks the Vercel build. | `npx tsc --noEmit` at every checkpoint; the `build` job on the PR (AC11). |
| The `db` job gets slower. | Unit and RLS tests are local and short; CP5 records the duration; the timeout changes only if the job passes 15 minutes. |
| The skill copies VocaSpace layers DevSpace lacks. | G7; Codex reviews the skill against this repo, not against VocaSpace. |

- Rollout runbook (Owner or hosted steps, in order): none. The Owner merges the PR; `db` is already a required check on `main`, and nothing touches hosted.
- Stop when: a test needs a hosted URL, a secret or a real credential; a matrix row's real result contradicts Appendix A or the current policies (a new security finding goes to Main for `security-hotfix/problems.md`); a test needs a migration or a product code change to pass; the seed would need data copied from hosted.
- Rollback: revert the PR. Nothing hosted changes; the seed additions disappear with the next `db reset`.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

## Appendix A: RLS matrix

Actors: `anon` (anon key, no session), `learner` (`learner@devspace.test`, enrolled nowhere), `student` (`student@devspace.test`, enrolled in course 2), `admin` (`admin@devspace.test`). "Denied" means an error or zero affected rows, as observed, with no row written.

| # | Actor | Action | Expected |
| --- | --- | --- | --- |
| P1 | anon | select `profiles` | no rows |
| P2 | learner | select `profiles` | only their own row |
| P3 | admin | select `profiles` | all three seed rows |
| P4 | anon | select `id, full_name, avatar_url, role` from `profile_cards` | all three rows |
| P5 | anon | select `email` from `profile_cards` | error (no such column) |
| P6 | learner | update or insert through `profile_cards` | denied |
| P7 | learner | update own `profiles.role` to `admin` | error `42501`, role unchanged |
| P8 | learner | update another user's `profiles` row | zero rows affected |
| P9 | admin | update learner's role to `admin`, then back to `user` | allowed both times |
| P10 | catalog | `has_function_privilege` for `anon` and for `authenticated` on `public.handle_new_user()`, `execute` | `false` for both |
| P11 | learner | call `rpc('is_admin')` | `false`; admin gets `true` |
| P12 | anon | sign up `signup-<run id>@devspace.test` with metadata `role: 'admin'` | the new `profiles` row (read through the service role) has role `user`; the sign-up uses its own client, and the user is deleted in `afterEach`, even on failure, so no other test sees a fourth profile |
| C1 | anon | select `courses`, `chapters` | the seed rows |
| C2 | anon | select the granted `lessons` columns | the four lessons |
| C3 | anon, learner | select `lessons.content` or `video_url` | error `42501` |
| C4 | anon, learner | select `exercises` | no rows |
| C5 | student | select `exercises` | only those of course 2 lessons |
| C6 | admin | select `exercises` | all seed exercises |
| C7 | learner | for each of `courses`, `chapters` and `lessons`: insert a valid row, update a seed row, delete a seed row (nine tests), returning only `id` | insert `42501`; update and delete zero rows; nothing changed |
| C8 | admin | insert a chapter, update it, delete it | allowed |
| E1 | learner | insert own enrollment in free course 1 | allowed (cleaned up) |
| E2 | learner | insert own enrollment in paid course 2 | denied |
| E3 | learner | insert an enrollment for `student` in free course 1 (student is not enrolled there) | denied `42501` |
| E4 | learner | select `enrollments` | only their own (none in the seed) |
| E5 | learner | select `payments` | no rows; student sees only their own payment |
| E6 | learner | insert a `payments` row | denied |
| E7 | anon, learner | select `coupons` | no rows |
| N1 | learner | select `notes`, `user_progress`, `notifications` | none of student's rows |
| N2 | learner | insert a note, and a progress row, with `user_id` = student on lesson 4 (no seed row for that pair) | denied `42501`, two tests |
| N3 | student | update own note, delete own progress row | allowed (restored in cleanup) |
| N4 | learner | insert a `notifications` row | denied; admin insert allowed (cleaned up) |
| N5 | learner | update student's notification `is_read` | zero rows affected |
| R1 | learner | insert a review on course 2 | denied (not enrolled) |
| R2 | student | insert own review on course 2 | allowed (cleaned up) |
| R3 | learner | insert a comment with `user_id` = student | denied |
| R4 | learner | update student's comment | zero rows affected |
| R5 | admin | soft-delete student's comment (`deleted_at`) | allowed (restored) |
| K1 | student | insert a review on course 2 with `user_id` = learner | expected: denied. Known bug P3: allowed today. |
| K2 | student | move own comment to another lesson (`lesson_id`) | expected: denied. Known bug P4: allowed today. |
| K3 | learner | update own `profiles.email` | expected: denied. Known bug P28: allowed today. |

## Appendix B: seed additions

All invented; ids explicit and above the U2 ids (`overriding system value` for `GENERATED ALWAYS` tables); sequences moved past them.

- User `student@devspace.test` (role `user`, password marked as a local test value), with its `auth.identities` row; the profile comes from `on_auth_user_created`.
- Enrollment: student in course 2. Payment: student, course 2, the course price, status `approved`.
- Exercises: two on lesson 3 (course 2) and one on lesson 1 (course 1).
- One active coupon.
- Student's rows: one note on lesson 3, one `user_progress` row on lesson 3, one notification and one comment on lesson 3. No review: `reviews` is unique on `(user_id, course_id)`, so a seeded review would make R2 fail on `23505` instead of testing the policy.
