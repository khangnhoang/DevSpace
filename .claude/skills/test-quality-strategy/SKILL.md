---
name: test-quality-strategy
description: "Test selection and quality for DevSpace: map behavior and invariants to unit, local integration and browser E2E, plan safe test data and residual manual QA, handle known bugs and report evidence. Use when planning or verifying behavior changes, writing or reviewing Vitest or Playwright tests, choosing automated versus manual checks, or reporting test results."
---

# Test quality strategy

## Use when / do not use when

Use when planning or verifying a behavior change, choosing automated versus manual checks, writing, changing or reviewing a test under `__tests__/`, or reporting test results. This skill owns test selection and test-data requirements; consumers own their execution procedures.

Manual browser mechanics belong to `frontend-workflow`, migration writing to `supabase-migration`, and plan structure to `planning`. Coverage is only what the actual assertions prove; a missing existing row is not a reason to default to manual-only verification.

## Select checks from the contract

Before choosing commands, identify the observable behavior, persisted invariants, relevant edges and failures, actors/permissions and competing operations. For each applicable guarantee, record the layer, assertion, existing or new test file/row and prerequisites. Omit irrelevant dimensions rather than manufacture boilerplate cases.

Choose the smallest sufficient layer: pure transformations and validation use unit tests; real policies, constraints and persistence use local database/API integration; browser wiring, interaction and state use E2E where needed. Local integration uses the existing Vitest `rls` project or Playwright API/action fixtures, not a new `test:integration` command. Endpoint authorization and RLS can protect different entry points: test both applicable boundaries without repeating every assertion in every layer.

Reuse or extend relevant rows. A non-payment action, new flow or missing fixture is not a coverage ceiling: plan the bounded helper/worker/data extension needed within the feature's approved scope, with tests shipping alongside the behavior. If that cannot be done safely or within scope, record the concrete blocker, missing guarantee and resolution before proceeding; do not claim an untested action is covered or silently postpone its tests. General validation changes need tests with the change; Zod-specific procedures arrive with the schemas and package in app-foundation U2.

Allocate manual QA per remaining scenario, with a reason: perceptual/design judgment, exploration or genuinely live external-provider verification. Reuse automated assertions instead of mechanically repeating them by hand. A missing/expired Gemini key does not prevent automating applicable application behavior at controlled external boundaries, but real provider quality remains unverified. Explicit Owner QA and approved program-specific minima remain binding, including app-foundation's shared-schema unit tests and successful/rejected E2E per form or an approved plan exception. Automated-first selection never waives an acceptance check or its permission gate.

## What exists

| Layer | Where | Command | Needs |
| --- | --- | --- | --- |
| `unit` | `__tests__/unit/**/*.test.ts` | `npm run test:unit` | nothing (no Docker) |
| `rls` | `__tests__/rls/**/*.test.ts` | `npm test` (runs both layers) | Docker Desktop; the command starts and resets the test stack (Test stack) |
| `e2e` | `__tests__/e2e/*.spec.ts` (Playwright, Chromium) | `npm run test:e2e` | Docker Desktop, and Chromium (`npx playwright install chromium`, about 180 MB, once per machine); the command starts and resets the test stack |

- `vitest.config.mts` defines both projects, turns env-file loading off and runs the `rls` files one at a time. Shared helpers: `__tests__/helpers` (the local-stack host check, `knownBug` and its runner-neutral core, the server action reader) and `__tests__/rls/helpers.ts` (actor clients).
- The `rls` global setup reads the API URL, database URL and keys from `npx supabase status -o json` of the test stack only (`scripts/test-stack/read.mjs`, after the Docker identity check of the test project), refuses a host other than `127.0.0.1` or `localhost`, and signs in the seed users once. It refuses to run outside `npm test`, which holds the lock. A test never reads `.env*` or a hosted URL.
- The seed users (`supabase/seed.sql`, invented): `learner` (enrolled nowhere), `student` (enrolled and paid in course 2), `admin`.
- Under an agent environment Vitest uses its `minimal` reporter and hides the `known bug <id>` lines; run `npm test -- --reporter=default` to see them. The CI jobs, their reporter and failure reading: [pr-and-ci.md](../git-pr-workflow/references/pr-and-ci.md).

## End-to-end (`e2e`)

- The suite covers main learner/admin rendering and access redirects against a production build, payment UI/direct action calls, and U1 fixture deletes, non-payment transit failure handling and dialog interaction (`admin.spec.ts` A3-A10, `student.spec.ts` T4/T5, `payment-admin.spec.ts` AP4-AP6). This inventory describes current assertions, not a limit on new rows. Select additions by the contract above; do not repeat an RLS guarantee just to drive it through a browser.
- `npm run test:e2e` reads the API URL and keys from the test stack through the host and identity checks, builds the app with `buildE2eEnv` (`__tests__/helpers/e2e-env.ts`) and serves it on port 3100, and never reuses a server. A unit test fails when `app`, `lib` or `proxy.ts` read an environment variable that the map does not set, because the build would then take it from the local environment file, which points at hosted. When code reads a new variable, add it to the map. The run overwrites `.next`: run `npm run build` before `npm start` afterwards.
- Specs are `__tests__/e2e/<role>.spec.ts` and import `test` from `fixtures.ts`. Names start with the matrix ID, for example `[L5]`. The `setup` project signs in each seed user through the login form once per run and saves the session under `__tests__/e2e/.auth/` (ignored by git).
- The network guard in `fixtures.ts` aborts every request whose host is not `127.0.0.1` or `localhost` (a CDN, `placehold.co`) and every `/_next/image` request that asks the Next server to fetch such a URL. A request aimed at `*.supabase.co` or `devspace-lms.vercel.app`, a page error and a response with status 500 or more fail the test. Chromium also cannot resolve any host but a local one (`--host-resolver-rules`), because Playwright does not route redirect hops. There is no exception: Monaco is served from the app's own origin (`/monaco/vs/`, copied at install), so `/try_it` loads its editor and workers under the guard and a page error fails the test. The classifier is `__tests__/helpers/e2e-network.ts`.
- Assert seed values (course names, lesson text, URLs), not CSS classes. Wait with Playwright's auto-waiting, never a fixed sleep.
- Data: rendering rows write no scenario data; `[L5]` enrolls and U1 rows create/delete fixtures. UI deletes target fixtures, never seed rows. The service role in `__tests__/e2e/service-role.ts` prepares, reads back and cleans up; it never sends the request under test. Each test has a scope; scoped labels/codes/emails and exact reserved selectors are recorded before writes. Payment setup has additional rules below.
- After changing a row that writes, run `npm run test:e2e` twice and `npm test` once. The commands reset the test stack when it needs it (Test stack). A second run detects residue; the end-of-run audit reports a stray write either way.

## Server action rows (`payment-learner.spec.ts`, `payment-admin.spec.ts`)

- The UI drives the normal paths. A hostile path, or anything the UI cannot reach, posts straight to the action endpoint with the `callAction` fixture (`__tests__/e2e/server-action.ts`). It reads the action ID from `.next/server/server-reference-manifest.json` by source file and export name (never written down) and sends the actor's saved session (none for `anon`) and the e2e server's origin. A missing pair, a redirect or an unreadable response throws an error that names the pair; there is no fallback. The lookup and the flight reader are pure (`__tests__/helpers/server-action-core.ts`, unit-tested from a captured response) and rely on Next internals, so a Next update shows up in `npm run test:unit` and in the rows.
- `ActionCaller(caller, filename, exportedName, args)` has a generic signature, but `WORKER_URLS` currently maps only the course and transactions page workers. Other endpoints can need a bounded worker/fixture extension; do not promise they run unchanged. The current caller rejects HTTP errors and the browser fixture fails unexpected page errors/5xx. An expected-error probe those guards cannot express is a named harness gap (BL-F7); plan scoped support without weakening network/error guards or treating a weaker check as equivalent.
- The e2e server starts through `scripts/e2e/serve.mjs`: `next build` unguarded, `next start` with `__tests__/e2e/server-guard.cjs`. The guard refuses and records every name resolution and connection to a host but `127.0.0.1`, `localhost` and `::1`, and the auto fixture `serverRecords` fails a test during which it recorded one. Records live in the ignored `__tests__/e2e/.server/`.
- The mail record stops `sendMail` of the bundled nodemailer (Turbopack bundles it, so `server-mail.cjs` rewrites the chunk as it is required) and records recipient and subject. `serverRecords.mailsSent()` lists the mails since the test began: a row that approves asserts exactly its mails, every other row asserts none. Nothing reaches Gmail.
- A known bug uses `knownBugE2e` (`__tests__/e2e/known-bug.ts`): the same contract as `knownBug`, and the run prints `known bug <id>`. Playwright's `expect` throws a plain `Error` with a `matcherResult`, not an `AssertionError`; `runKnownBug` knows both.
- Write and cleanup: a payment in any state but a new pending order is created through the actions as the right actor, never by a service-role insert or update. The service role creates scope-specific coupon fixtures and reads state back. `assertPaymentFixturesClean` checks the required actor/course slots and LOCAL10 before acquiring them. The automatic `owned` fixture in `fixtures.ts` cleans that scope's recorded resources, restores the acquired coupon field, handles partial setup/test failure and verifies absence. A failed preflight owns no scenario resource to delete. A killed run is cleaned up by the next command (Test stack).
- Use the saved sessions; never sign in per row.

## Core rules

1. Test user intent and system guarantees, not implementation. Assert inputs, outputs, permissions and persisted state.
2. Select the smallest sufficient layer by Select checks from the contract; distinguish separate trust boundaries from duplicate assertions.
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
- relevant races: name the shared resource, contenders and final persisted invariant; distinguish sequential retry, stale-tab interaction and genuinely competing requests. Use independent requests/connections and controlled synchronization where needed; `Promise.all` alone does not prove overlap.

## Naming and placement

- Name states actor, condition and expected outcome: `it("denies a learner enrolling in a paid course")`, never `it("calls insert")`.
- An rls test that covers a row of a matrix starts with its ID in brackets, for example `[E2]`. A known bug starts with its problem ID, for example `P3 [K1]`.
- One rls file per area (profiles, content, learner data, community, coupons). Each starts with a test-plan header; read [test-plan-and-known-bugs.md](references/test-plan-and-known-bugs.md) for it.

## Test stack

- `npm test` and `npm run test:e2e` run on their own Supabase stack (project `devspace-test`, ports 55320–55329), generated under the ignored `.supabase-test/` from `supabase/config.toml`, `migrations/` and `seed.sql`. The dev stack (`devspace-local`, 54320–54329) holds the data for manual QA, and no test command reads, resets or stops it. Every Supabase CLI call of the tooling passes `--workdir` and runs after a Docker identity check of the test project, so a test can never write to dev; a missing or unhealthy required container stops the command with its name. Design: [QE-U3 plan](../../../docs/programs/quality-engineering/implementation-plans/qe-u3-test-stack/plan.md).
- One machine-wide lock admits one test command or stop at a time (one fixed directory, `C:\ProgramData\devspace-test-stack-v1` on Windows and `/var/tmp/devspace-test-stack-v1` elsewhere, which no environment variable changes; it holds only the lock, writer records and run state). A second command exits naming the holder's PID and command, and changes nothing. A lock file that cannot be read is never treated as stale: the command names it and stops; do not remove it without the Owner.
- Reset rules: the command resets the test database only when the last run did not finish cleanly, when the hash of `supabase/migrations/**`, `supabase/seed.sql` or the generated config changed, when the stack was started without its data volume, or when `--reset` is passed (`npm test -- --reset`, `npm run test:e2e -- --reset`); it prints which. Use `--reset` when a result may depend on leftover data. Two clean runs with unchanged inputs do not reset.
- A run ends `clean` when every fixture cleanup succeeded, every writer process of the run has exited and the end-of-run audit found no residue, whether the tests passed or failed. After each reset the command saves a snapshot (row count and content hash of each `public` table, `auth.users` and `storage.objects`, minus columns tests change legitimately, listed with reasons in `scripts/test-stack/audit.mjs`); it compares the database with it at the end of a run and before the next clean run. A failed cleanup, a timed-out test, a stray or delayed write, a surviving writer or an interrupted run makes the run `dirty`, and the next command resets.
- Every Node process of a run records itself as a writer before it writes (`scripts/test-stack/writer-preload.mjs`); on Windows reading a process start time costs about 0.5 s per process. After an interrupted run the next command stops the recorded writers whose PID and start time still match a live process (one at a time, no tree kill), waits for them, and only then resets. A writer it cannot stop makes the command refuse, naming the PID.
- `npm run test:stack:stop` stops only the test project through the same lock, works on a partly started or stopped stack, and confirms with `docker ps` that no `devspace-test` container remains. Use it to free memory (the stacks and other projects share Docker Desktop) or before Docker maintenance; routine runs do not need it.
- Vitest or Playwright started directly is refused before it reads the stack, starts a server or writes: the rls global setup and the Playwright config require a run that holds the lock and this process's writer record, and name the npm command to use.

## Test data

- Tests write only to the test stack (Test stack); the tooling verifies the target through Docker before any write, cleanup or reset, never by port alone. If the target is uncertain, block mutation and report the missing prerequisite; never fall back to the dev stack or hosted. A reset of the test database is routine and needs no approval; a reset or bulk delete on the dev stack needs the Owner's request.
- Distinguish stable invented baseline data (`supabase/seed.sql`) from temporary scenario fixtures. Seed additions use `.test` addresses and explicit ids, never hosted data; assert baseline facts a test needs. Choose seed only when it belongs in that shared stable baseline, not automatically for every missing scenario. Temporary data must be minimal, deterministic and owned by the run; a shared `E2E-` or `rls-test` marker alone proves no ownership.
- New/changed tests plan creation tracking (owned IDs or run-scoped resources), setup failure and test failure cleanup, dependency order, error checks and read-back proving owned residue is gone and unrelated rows survive. A preflight failure must not trigger destructive cleanup of unowned data. Restore only owned changes, never depend on another file's writes/order, and reuse or extend shared helpers within approved feature scope rather than duplicate unsafe cleanup.
- Plan failure cleanup, not recovery: an interrupted or unclean run needs no manual step, because the next test command stops the dead run's writers and resets the test database. Never use a reset of the dev stack as a recovery shortcut.
- Use `FixtureScope` (`__tests__/helpers/fixture-ownership.ts`, records in memory per process) to reserve an empty exact selector or acquire specific fields after required baseline checks; a selector already held by another open scope, or occupied by a row, refuses and is reported. RLS `ownedInsert` records intent before invoking the actor request and adopts IDs before subsequent updates; a no-returning/failed-response path remains attributable. Cleanup resolves exact IDs, attempts independent resources, verifies absence/restoration and keeps unresolved evidence. Remaining application foreign-key dependents block parent/account deletion so cascades cannot change another scope; remove the dependent scope first, then retry. Auth reconciliation reads IDs by the exact reserved email in local SQL, then deletes/verifies those IDs through Auth; it never infers ownership from a page of users. Original test errors and cleanup errors remain visible together.
- A failed cleanup, a timed-out test or residue found at a reservation marks the run unclean in the shared run state, and every later scope of the run, in any worker process, refuses to open and names the cause. A late write under a selector that is never reserved again is caught by the end-of-run audit (Test stack). Both are detection, not prevention: the next run resets.
- Seed changes keep `npm test` and `npm run test:e2e` green; the seed hash makes the next command reset the test stack. Service role remains setup/read-back/cleanup only; requests under test use the actor (Mocking).

## Mocking

Mock only boundaries outside the subject: email, Gemini, browser APIs. Never mock the database, RLS or a permission check when it is the subject. The service role bypasses RLS: use it only to prepare fixtures, read state back and clean up, never for the request under test (see [rls-test-design.md](references/rls-test-design.md)).

## Regression

Reproduce the bug first when practical, then write a focused test tied to the observable behavior that was wrong, in the smallest sufficient layer. Plan bounded missing fixture/helper support with the fix under Select checks from the contract and Test data; existing seed/session/catalog limits are not automatic grounds for manual-only QA. Existing seed actors have saved E2E sessions; other actor needs must be planned. When no test is practical, the plan and report name the concrete blocker and resolution. A bug known but not fixed in this change uses the known-bug pattern; never encode unknown surprising behavior as expected, report it to Main so it is recorded as a problem.

## Which command for which change

Run the row for each kind of change, plus the static checks (`npx tsc --noEmit`, `npm run lint` with 0 problems) for any code change. "Docker" means Docker Desktop running (the test commands start and reset the test stack themselves); "Chromium" means `npx playwright install chromium`.

| Change | Run | Needs |
| --- | --- | --- |
| Pure helper (`lib`, `__tests__/helpers`) | `npm run test:unit` | nothing |
| Server action (`app/action`) | unit tests for pure logic; add/extend actor endpoint tests for applicable validation, permission and persistence guarantees, using the existing Playwright action/API fixture with scoped extensions as needed; `npm run test:e2e`; add `npm test` for distinct database boundaries | Docker, Chromium for E2E |
| RLS policy, grant or migration | `npm test` (twice after writing rls tests); the migration hash resets the test stack | Docker |
| Seed (`supabase/seed.sql`) | `npm test`, `npm run test:e2e` | Docker, Chromium |
| Page or UI flow | select unit/integration/E2E assertions by the contract; add/extend browser rows for wiring/state that needs them and run `npm run test:e2e`; justify residual manual checks (`frontend-workflow`) and preserve approved minima | Docker, Chromium for E2E |
| E2E helper, fixture or env map (`__tests__/e2e`, `__tests__/helpers/e2e-env.ts`, `scripts/e2e`) | `npm run test:unit`, `npm run test:e2e` | Docker, Chromium |
| Dependency (`package.json`, `package-lock.json`); procedure per update type: [dependency-updates](../dependency-updates/SKILL.md) | static checks, `npm run build`, `npm test`, `npm run test:e2e` | Docker, Chromium |
| Docs only (`docs/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`, `README.md`) | `npm run docs:check`; `npm run docs:check:test` when the checker changed | nothing |

## Running and reporting

- Run the narrowest command that can detect the change, and say why when you run wider. A targeted run is never called a full-suite run.
- Before an rls run: only Docker Desktop is needed; the command starts and resets the test stack, and an interrupted run is cleaned up by the next command. Run `npm test` twice in a row after writing rls tests: the second run checks repeatability, and the end-of-run audit reports residue either way.
- The report separates automated results (command, files, test counts), static checks (`npx tsc --noEmit`, `npm run lint`, `npm run docs:check`), manual QA, and what is pending or limited by the environment. Never claim a check that did not run, and never report a skipped test as passed.
- Test files are type-checked by `next build` and `tsc`: run `npx tsc --noEmit`. New files add no lint problems. A session file or report under `__tests__/e2e/.auth/`, `test-results/` or `playwright-report/` is never committed.

## Resources

| Resource | Read when | Skip when |
| --- | --- | --- |
| [test-plan-and-known-bugs.md](references/test-plan-and-known-bugs.md) | starting an rls file, recording a known bug, or turning one into a normal test | a unit test of a pure function |
| [rls-test-design.md](references/rls-test-design.md) | writing or reviewing an rls test, changing the seed for one, or debugging a flaky run | a unit test |

## Checklist

- [ ] applicable guarantees map to assertions, layers, files and prerequisites; distinct boundaries covered without duplicate matrices
- [ ] allowed and denied paths covered; hidden rows proven to exist before an empty result
- [ ] names state actor, condition and outcome; matrix IDs and known-bug IDs follow the naming rule
- [ ] safe target (test stack, not dev), owned data, failure cleanup and the unclean/audit outcome verified; detection limits stated
- [ ] residual manual checks have reasons; Owner acceptance and approved feature minima retained
- [ ] the report states exactly which commands ran and which checks did not
