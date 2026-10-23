---
name: test-quality-strategy
description: "Test quality for DevSpace automated tests: what the unit and rls layers cover, how to name, place and plan a test, test data and cleanup, mocking limits, the known-bug pattern, regression tests, and how to run and report test evidence. Use before writing, changing, reviewing or planning a Vitest test, when a policy, grant or security change needs denied-path tests, when a bug fix needs a regression test, and when reporting test results."
---

# Test quality strategy

## Use when / do not use when

Use when you write, change, review or plan a test under `__tests__/`, when a policy, grant or security change needs denied-path tests, when a bug fix needs a regression test, or when you report test results.

Do not use for manual browser validation (`frontend-workflow`), for writing the migration itself (`supabase-migration`), or for plan structure (`planning`). Playwright smoke tests (infrastructure U4) and server action tests (U5) are deferred: do not write them, and do not claim coverage they would give.

## What exists

| Layer | Where | Command | Needs |
| --- | --- | --- | --- |
| `unit` | `__tests__/unit/**/*.test.ts` | `npm run test:unit` | nothing (no Docker) |
| `rls` | `__tests__/rls/**/*.test.ts` | `npm test` (runs both layers) | the local stack started and seeded: `npx supabase start`, `npx supabase db reset` |

- `vitest.config.mts` defines both projects, turns env-file loading off and runs the `rls` files one at a time. Shared helpers: `__tests__/helpers` (the local-stack host check, `knownBug`) and `__tests__/rls/helpers.ts` (actor clients).
- The `rls` global setup reads the API URL, database URL and keys from `npx supabase status -o json` only, refuses a host other than `127.0.0.1` or `localhost`, and signs in the seed users once. A test never reads `.env*` or a hosted URL.
- The seed users (`supabase/seed.sql`, invented): `learner` (enrolled nowhere), `student` (enrolled and paid in course 2), `admin`.
- The CI job `db` runs `npm test` after `db reset`. Under an agent environment Vitest uses its `minimal` reporter and hides the `known bug <id>` lines; run `npm test -- --reporter=default` to see them. CI uses the default reporter.

## Core rules

1. Test user intent and system guarantees, not implementation. Assert inputs, outputs, permissions and persisted state.
2. Pick the smallest layer that gives confidence. A pure function is a unit test; a policy, grant, trigger or constraint is an rls test. Do not repeat one guarantee in two layers.
3. Never mock the behavior under test. A database guarantee needs the real database; a mocked client proves nothing about RLS.
4. A security or permission change adds denied-path tests: the wrong actor is refused and nothing is written.
5. A bug fix gets a regression test when practical (Regression).
6. A hostile or broken client is a normal case at every server boundary: another user's id, a forbidden role or owner field, no session.
7. A test that cannot fail is worthless: prove the data it depends on exists before asserting that nothing is returned.
8. Keep each test small and independent; one behavior per test.

## Coverage model

For each subject, ask which of these apply and cover them:

- intended use: the actor does the normal thing and sees the right result;
- user mistakes: invalid or missing input, a duplicate;
- hostile client: another user's id, role or owner fields, no session;
- boundaries and transitions: the first and last allowed state, a state change that must be refused;
- resilience: no mutation after a failed check, a retry that changes nothing;
- permission: unauthenticated, wrong role, wrong owner, rows the policy hides.

## Naming and placement

- Name states actor, condition and expected outcome: `it("denies a learner enrolling in a paid course")`, never `it("calls insert")`.
- An rls test that covers a row of a matrix starts with its ID in brackets, for example `[E2]`. A known bug starts with its problem ID, for example `P3 [K1]`.
- One rls file per area (profiles, content, learner data, community, coupons). Each starts with a test-plan header; read [test-plan-and-known-bugs.md](references/test-plan-and-known-bugs.md) for it.

## Test data

- Minimal, deterministic, isolated and clearly named. Rows a test creates carry a marker such as `rls-test` and are removed by the test.
- A test restores what it changes and removes what it adds, even when it fails (`afterEach` for a shared seed row). A test never depends on another file's writes or on file order, and does not rely on a seed row by accident: assert the seed fact it needs first.
- New seed rows are invented, use `.test` addresses and explicit ids, and never copy hosted data. `supabase/seed.sql` holds only what the tests need.

## Mocking

Mock only boundaries outside the subject: email, Gemini, browser APIs. Never mock the database, RLS or a permission check when it is the subject. The service role bypasses RLS: use it only to prepare fixtures, read state back and clean up, never for the request under test (see [rls-test-design.md](references/rls-test-design.md)).

## Regression

Reproduce the bug first when practical, then write a focused test tied to the observable behavior that was wrong, in the layer where it lives. A bug that is known but not fixed in this change uses the known-bug pattern; never encode an unknown surprising behavior as expected, report it to Main so it is recorded as a problem.

## Running and reporting

- Run the narrowest command that can detect the change, and say why when you run wider. A targeted run is never called a full-suite run.
- Before an rls run: `npx supabase db reset` after a seed or schema change, and again when a run was killed half way. Run `npm test` twice in a row once after writing rls tests: the second run proves the cleanup.
- The report separates automated results (command, files, test counts), static checks (`npx tsc --noEmit`, `npm run lint`, `npm run docs:check`), manual QA, and what is pending or limited by the environment. Never claim a check that did not run, and never report a skipped test as passed.
- Test files are type-checked by `next build` and `tsc`: run `npx tsc --noEmit`. New files add no lint problems.

## Resources

| Resource | Read when | Skip when |
| --- | --- | --- |
| [test-plan-and-known-bugs.md](references/test-plan-and-known-bugs.md) | starting an rls file, recording a known bug, or turning one into a normal test | a unit test of a pure function |
| [rls-test-design.md](references/rls-test-design.md) | writing or reviewing an rls test, changing the seed for one, or debugging a flaky run | a unit test |

## Checklist

- [ ] smallest layer chosen; no guarantee duplicated across layers
- [ ] allowed and denied paths covered; hidden rows proven to exist before an empty result
- [ ] names state actor, condition and outcome; matrix IDs and known-bug IDs follow the naming rule
- [ ] data cleaned up by the test; nothing depends on file order
- [ ] the report states exactly which commands ran and which checks did not
