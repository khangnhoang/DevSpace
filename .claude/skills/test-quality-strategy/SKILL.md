---
name: test-quality-strategy
description: "Test quality for DevSpace automated tests: what the unit, rls and e2e layers cover, how to name, place and plan a test, test data and cleanup, mocking limits, the known-bug pattern, regression tests, and how to run and report test evidence. Use before writing, changing, reviewing or planning a Vitest or Playwright test, when a policy, grant or security change needs denied-path tests, when a bug fix needs a regression test, and when reporting test results."
---

# Test quality strategy

## Use when / do not use when

Use when you write, change, review or plan a test under `__tests__/`, when a policy, grant or security change needs denied-path tests, when a bug fix needs a regression test, or when you report test results.

Do not use for manual browser validation (`frontend-workflow`), for writing the migration itself (`supabase-migration`), or for plan structure (`planning`). Only the payment actions have server action tests (the `payment-*.spec.ts` rows): do not claim coverage for another action. Verify the others by commands and a manual browser pass, and report what was not verified.

## What exists

| Layer | Where | Command | Needs |
| --- | --- | --- | --- |
| `unit` | `__tests__/unit/**/*.test.ts` | `npm run test:unit` | nothing (no Docker) |
| `rls` | `__tests__/rls/**/*.test.ts` | `npm test` (runs both layers) | the local stack started and seeded: `npx supabase start`, `npx supabase db reset` |
| `e2e` | `__tests__/e2e/*.spec.ts` (Playwright, Chromium) | `npm run test:e2e` | the local stack started and seeded, and Chromium (`npx playwright install chromium`, about 180 MB, once per machine) |

- `vitest.config.mts` defines both projects, turns env-file loading off and runs the `rls` files one at a time. Shared helpers: `__tests__/helpers` (the local-stack host check, `knownBug` and its runner-neutral core, the server action reader) and `__tests__/rls/helpers.ts` (actor clients).
- The `rls` global setup reads the API URL, database URL and keys from `npx supabase status -o json` only, refuses a host other than `127.0.0.1` or `localhost`, and signs in the seed users once. A test never reads `.env*` or a hosted URL.
- The seed users (`supabase/seed.sql`, invented): `learner` (enrolled nowhere), `student` (enrolled and paid in course 2), `admin`.
- Under an agent environment Vitest uses its `minimal` reporter and hides the `known bug <id>` lines; run `npm test -- --reporter=default` to see them. The CI jobs, their reporter and failure reading: [pr-and-ci.md](../git-pr-workflow/references/pr-and-ci.md).

## End-to-end (`e2e`): smoke and payment rows

- The smoke rows prove that the main learner and admin paths render and that the access redirects hold, in a real browser, against a production build. They do not repeat an rls guarantee. The payment rows are the server action tests (see Server action rows).
- `npm run test:e2e` reads the API URL and keys from `npx supabase status` through the host check, builds the app with `buildE2eEnv` (`__tests__/helpers/e2e-env.ts`) and serves it on port 3100, and never reuses a server. A unit test fails when `app`, `lib` or `proxy.ts` read an environment variable that the map does not set, because the build would then take it from the local environment file, which points at hosted. When code reads a new variable, add it to the map. The run overwrites `.next`: run `npm run build` before `npm start` afterwards.
- Specs are `__tests__/e2e/<role>.spec.ts` and import `test` from `fixtures.ts`. Names start with the matrix ID, for example `[L5]`. The `setup` project signs in each seed user through the login form once per run and saves the session under `__tests__/e2e/.auth/` (ignored by git).
- The network guard in `fixtures.ts` aborts every request whose host is not `127.0.0.1` or `localhost` (a CDN, `placehold.co`) and every `/_next/image` request that asks the Next server to fetch such a URL. A request aimed at `*.supabase.co` or `devspace-lms.vercel.app`, a page error and a response with status 500 or more fail the test. Chromium also cannot resolve any host but a local one (`--host-resolver-rules`), because Playwright does not route redirect hops. The one exception: a row that sets `blockedMonacoLoader` (`[S5]` only) marks as handled, in the page, the unhandled rejection whose reason is the `error` Event of the Monaco `loader.js` script element from `cdn.jsdelivr.net`; every other page error still fails. Do not assert what a blocked CDN would load; the classifier is `__tests__/helpers/e2e-network.ts`.
- Assert seed values (course names, lesson text, URLs), not CSS classes. Wait with Playwright's auto-waiting, never a fixed sleep.
- Data: a smoke row writes nothing, except the one enrollment path (`[L5]`); the payment rows write and follow Server action rows. A row that writes restores its rows in `afterEach` through the service role (`__tests__/e2e/service-role.ts`), which is used only for preconditions and cleanup, never for the request under test.
- Run `npx supabase db reset`, then `npm run test:e2e` twice and `npm test` once after changing a row that writes.

## Server action rows (`payment-learner.spec.ts`, `payment-admin.spec.ts`)

- The UI drives the normal paths. A hostile path, or anything the UI cannot reach, posts straight to the action endpoint with the `callAction` fixture (`__tests__/e2e/server-action.ts`). It reads the action ID from `.next/server/server-reference-manifest.json` by source file and export name (never written down) and sends the actor's saved session (none for `anon`) and the e2e server's origin. A missing pair, a redirect or an unreadable response throws an error that names the pair; there is no fallback. The lookup and the flight reader are pure (`__tests__/helpers/server-action-core.ts`, unit-tested from a captured response) and rely on Next internals, so a Next update shows up in `npm run test:unit` and in the rows.
- The e2e server starts through `scripts/e2e/serve.mjs`: `next build` unguarded, `next start` with `__tests__/e2e/server-guard.cjs`. The guard refuses and records every name resolution and connection to a host but `127.0.0.1`, `localhost` and `::1`, and the auto fixture `serverRecords` fails a test during which it recorded one. Records live in the ignored `__tests__/e2e/.server/`.
- The mail record stops `sendMail` of the bundled nodemailer (Turbopack bundles it, so `server-mail.cjs` rewrites the chunk as it is required) and records recipient and subject. `serverRecords.mailsSent()` lists the mails since the test began: a row that approves asserts exactly its mails, every other row asserts none. Nothing reaches Gmail.
- A known bug uses `knownBugE2e` (`__tests__/e2e/known-bug.ts`): the same contract as `knownBug`, and the run prints `known bug <id>`. Playwright's `expect` throws a plain `Error` with a `matcherResult`, not an `AssertionError`; `runKnownBug` knows both.
- Write and cleanup: a payment in any state but a new pending order is created through the actions as the right actor, never by a service-role insert or update (a later guard on `payments` would refuse it). The service role creates coupon fixtures (`E2E-` codes), reads state back and cleans up. `beforeEach` runs `assertPaymentFixturesClean` and `afterEach` runs `restorePaymentFixtures` (payments before coupons), even when the row failed, so a second run, `[E5]`, `[E7]` and `[L2]` still hold. After a killed run, `npx supabase db reset`.
- Use the saved sessions; never sign in per row.

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
- New seed rows are invented, use `.test` addresses and explicit ids, and never copy hosted data. `supabase/seed.sql` holds what the tests and manual QA need. When a QA pass needs data the seed lacks, the task adds invented rows the same way, and `npx supabase db reset`, `npm test` and `npm run test:e2e` stay green.

## Mocking

Mock only boundaries outside the subject: email, Gemini, browser APIs. Never mock the database, RLS or a permission check when it is the subject. The service role bypasses RLS: use it only to prepare fixtures, read state back and clean up, never for the request under test (see [rls-test-design.md](references/rls-test-design.md)).

## Regression

Reproduce the bug first when practical, then write a focused test tied to the observable behavior that was wrong, in the layer where it lives. A bug that is known but not fixed in this change uses the known-bug pattern; never encode an unknown surprising behavior as expected, report it to Main so it is recorded as a problem.

## Which command for which change

Run the row for each kind of change, plus the static checks (`npx tsc --noEmit`, `npm run lint` with 0 problems) for any code change. "Stack" means the local stack started and seeded (`npx supabase start`, `npx supabase db reset`); "Chromium" means `npx playwright install chromium`.

| Change | Run | Needs |
| --- | --- | --- |
| Pure helper (`lib`, `__tests__/helpers`) | `npm run test:unit` | nothing |
| Server action (`app/action`) | `npm run test:unit` for a helper it uses; `npm run test:e2e` for the payment actions (`payment-*.spec.ts`), the only ones with tests | Stack, Chromium |
| RLS policy, grant or migration | `npx supabase db reset`, then `npm test` (twice after writing rls tests) | Stack |
| Seed (`supabase/seed.sql`) | `npx supabase db reset`, `npm test`, `npm run test:e2e` | Stack, Chromium |
| Page or UI flow | `npm run test:e2e` when it touches a smoke or payment path, then the manual pass (`frontend-workflow`) | Stack, Chromium |
| E2E helper, fixture or env map (`__tests__/e2e`, `__tests__/helpers/e2e-env.ts`, `scripts/e2e`) | `npm run test:unit`, `npm run test:e2e` | Stack, Chromium |
| Docs only (`docs/`, `.claude/`, `CLAUDE.md`, `README.md`) | `npm run docs:check`; `npm run docs:check:test` when the checker changed | nothing |

## Running and reporting

- Run the narrowest command that can detect the change, and say why when you run wider. A targeted run is never called a full-suite run.
- Before an rls run: `npx supabase db reset` after a seed or schema change, and again when a run was killed half way. Run `npm test` twice in a row once after writing rls tests: the second run proves the cleanup.
- The report separates automated results (command, files, test counts), static checks (`npx tsc --noEmit`, `npm run lint`, `npm run docs:check`), manual QA, and what is pending or limited by the environment. Never claim a check that did not run, and never report a skipped test as passed.
- Test files are type-checked by `next build` and `tsc`: run `npx tsc --noEmit`. New files add no lint problems. A session file or report under `__tests__/e2e/.auth/`, `test-results/` or `playwright-report/` is never committed.

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
