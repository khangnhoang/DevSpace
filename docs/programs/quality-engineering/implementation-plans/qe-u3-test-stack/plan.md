# QE-U3 detail plan — Separate test stack and simplified test-data ownership

Revision: r4, 2026-11-01. r3 failed it on lock takeover arbitration, late child registration, the launcher's own exit and the audit baseline. r1 failed the Codex plan gate (takeover safety, in-run guarantees, lifecycle order, CP split, missed readers, permission owner). r2 failed it on the writer registry, residue detection, process stop and stopping a partial stack. Owner approval: pending. Charter: [quality-engineering](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: QE-P2 and QE-F5 are addressed.
- The `rls` and `e2e` suites run on their own local Supabase stack (`test`), which the test commands start, check and reset when needed.
- The dev stack holds the data for manual QA, and no test command reads, resets or stops it.
- The cross-process ownership journal and its recovery CLI are replaced by one machine-wide lock plus one record per writer process of a run. On Windows, no test command or dev server leaves state that needs manual removal.
- Within a run, fixture scopes still clean up their own data, and residue from a late write is always reported, never hidden.

| ID | Observable result |
| --- | --- |
| AC1 | `npm test` and `npm run test:e2e` run their suites against the test stack only, whether or not the dev stack is running. Before any test, the command (1) takes the lock, (2) starts the test stack if it is down, (3) checks that every required container of the test project exists and is running and healthy, and (4) resets the stack when AC3 requires it. A full `npm test` plus `npm run test:e2e` leaves the dev stack's containers (IDs and running state) and a read-only row count of its `public` tables unchanged. Every runtime reader of the stack and every direct database connection in the suites uses the verified test endpoints, including `__tests__/e2e/auth.setup.ts` and the Auth lookup-failure probe now aimed at port 54322. |
| AC2 | When a required container of the test stack is missing or unhealthy after the start, the command exits nonzero with a message naming the container and the next action. No reset and no test runs. |
| AC3 | The test command runs `db reset` on the test stack exactly when one of these holds, and says which:<br>(a) the last recorded run did not finish cleanly. A run finishes cleanly when every fixture cleanup succeeded, every writer of the run other than the lock-holding launcher has exited, and the end-of-run audit (AC7) found no residue, whether its tests passed or failed. Writers still alive after a bounded wait leave the run unclean and their records in place for the next command. A start comparison that differs from the saved snapshot (AC7) counts as unclean too. An interrupted or killed run, a taken-over lock, a failed cleanup or detected residue is unclean;<br>(b) the hash of `supabase/migrations/**`, `supabase/seed.sql` and the generated test config differs from the hash recorded at the last reset or fresh start;<br>(c) the stack was started by this command without its data volume;<br>(d) `--reset` was passed.<br>Two consecutive clean runs with unchanged inputs do not reset on the second run. A fresh start whose migrations and seed applied counts as a reset for (b). |
| AC4 | One machine-wide lock admits one test command or stop at a time on the test stack. A second command while the first is live exits nonzero, naming the holder's PID and command, and changes nothing. Every process of a run that writes to the stack or starts such a process (launcher, Vitest main and workers, Playwright runner and workers, the e2e server and its Next child) creates its own writer record (PID plus process identity, run id), then checks that its run still holds the current lock, and only then makes its first write or spawn. A process whose record cannot be created, or whose run no longer holds the lock, exits without writing or spawning. A new holder publishes its lock before it scans records, so any process that passed this check has a record the scan sees. A lock whose holder is no longer the same live process is taken over without manual action. Before any reset or test, every command scans the writer records of earlier runs, stops each one whose identity still matches a live process, waits until it has exited, and scans again until a scan finds none alive; only then does it delete those records. A writer that cannot be stopped makes the command exit nonzero, naming its PID, with no reset, and the records stay. The run then counts as unclean under AC3 (a). When two commands find the same stale lock, exactly one takes it over. A lock file that cannot be read or parsed is not treated as stale: the command refuses, names the file and says what to check, and changes nothing. |
| AC5 | `npm run test:stack:stop` takes the same lock (with AC4 takeover for a stale one), runs the orphan stop of AC4, stops only the test project, and confirms with `docker ps` that no container of the test project remains. Every container of the dev project and of any other project is untouched. While a live test command holds the lock, it refuses and changes nothing. It works on a partly started stack (some test containers missing) and on a stopped one. |
| AC6 | `npm run dev` keeps its current behavior on the dev stack (refuses a stopped or non-local stack, starts `next dev` on `127.0.0.1:3000` with local values only). It takes no lock and writes no ownership record. Stopping it by any means leaves nothing that blocks a later dev or test command. |
| AC7 | No command creates or reads `devspace-fixture-ownership-v1`. `__tests__/helpers/run-ownership.mjs`, `run-preload.mjs`, `scripts/test-data/recover*.mjs` and the journal-only lifecycle probes are removed. Within a run, `FixtureScope` keeps these guarantees, with records in memory:<br>- reserve only an empty exact selector, so residue from any earlier write, late or not, fails the reservation and is reported;<br>- refuse a selector or acquired field already held by another open scope in the same process;<br>- acquire fields only when they equal the baseline;<br>- clean up in dependency order, refusing a parent while dependents remain;<br>- restore acquired fields;<br>- verify absence;<br>- report the test error and the cleanup error together.<br>A failed cleanup, a timed-out test or detected residue marks the run unclean in the shared run state, and every later scope in the same run (in any worker process) refuses to open, naming the cause.<br>A late write under a selector that is never reserved again is caught by an end-of-run audit. Right after each reset (or fresh start), and only then, the command records a snapshot of the test database, tied to that reset: the row count and a content hash of each table in `public`, `auth.users` and `storage.objects`, excluding columns that tests change legitimately (each listed in the code with its reason, for example sign-in timestamps). The command compares the database with that saved snapshot twice: at the start of a run whose state is clean, before any test (a difference there means a write landed after the last audit, so the command resets), and at the end, after every writer of the run other than the launcher has exited. A clean run never replaces the snapshot. An end difference is reported per table and marks the run unclean. If a writer is still alive or the audit cannot run, the run is unclean.<br>The existing rows asserting these guarantees still pass, adapted to the in-memory scope. |
| AC8 | Every existing guard stays:<br>- the e2e browser network guard and host resolver rules;<br>- the server guard and mail record;<br>- refusal of hosted URLs (`assertLocalUrl`);<br>- no `.env*` reads and env-file loading off;<br>- port 3100 must be free before an e2e run.<br>The test tooling verifies the target's identity through Docker: before a start, the test ports are free or held by the test project's containers; before a reset or a database write, the database and gateway ports belong to the running containers of the test project (`supabase_db_<test id>`, `supabase_kong_<test id>`); before a stop, the Docker engine is local and every container the stop would touch carries the test project's label, while missing containers or an already stopped project are accepted. A port number from config or the plan is never trusted on its own. A stack whose project is not the test project is refused, so a test can never write to the dev stack. |
| AC9 | CI's `db` and `e2e` jobs call `npm test` and `npm run test:e2e` without a separate `npx supabase start` or `db reset`. The commands start the test stack with the same excluded services, and all six required jobs pass on the PR. |
| AC10 | Command knowledge has one owner per layer and matches the behavior:<br>- `AGENTS.md` Commands has one line per command, giving its effect, prerequisite and side effect, and the dev-stack convention (start for manual QA, `npx supabase stop` afterwards);<br>- `AGENTS.md` section 4 states the local database permissions of D8;<br>- `test-quality-strategy` covers when to use `--reset` and `test:stack:stop`, the lock and orphan stop, the reset rules, residue reporting and failure handling;<br>- `pr-and-ci.md` covers the CI steps;<br>- script header comments state the why, and every refusal names the next action.<br>`fixture-recovery.md` is removed, along with every statement about the journal, `recover.mjs` or "Separate stacks remain BL-F3". Every current instruction that tells a reader to start or reset the stack before tests, or to recover a journal, states the new behavior: `README.md`, `supabase-migration`, `dependency-updates`, `frontend-workflow/references/manual-ui-validation.md`, `test-quality-strategy/references/rls-test-design.md` and the quality-engineering charter. Plans of closed units stay as history. `npm run docs:check` passes. |

### 1.2 Scope and non-goals

- In scope:
  - the generated test-stack workdir and its config;
  - the test-stack command module (lock, writer registry, orphan stop, start, health and identity check, reset decision, run state, stop) and `test:stack:stop`;
  - wiring every runtime stack reader and direct connection of the suites to the test stack;
  - replacing run ownership with the lock and in-memory fixture scopes;
  - removing dev ownership from `scripts/dev/local.mjs`;
  - CI `db` and `e2e` steps;
  - the docs, skill and `AGENTS.md` (Commands and section 4) updates of AC10;
  - QE-P2, QE-F5, the charter Initiatives row and decision, and State.
- Non-goals:
  - Mailpit and mail-content tests (QE-F4);
  - the harness hook (AW-F5);
  - test rows for product behavior;
  - migrations, seed or schema changes;
  - a third stack;
  - hosted or Vercel steps;
  - the VocaSpace stack;
  - changing which suites CI runs or its required-check names;
  - deleting the old `devspace-fixture-ownership-v1` folder on any machine (left to the Owner, see section 5).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Every `supabase` command run by test tooling passes `--workdir` for the generated test workdir, and runs only after the AC8 identity check for the test project. | A stop or `db reset` falls through to the default workdir and destroys the dev stack's data, or reaches the hosted-linked config. |
| G2. The test workdir is generated: config, migrations and seed are copied from `supabase/`, and nothing in it is committed. It never contains `.temp` or a project link. No command in this unit runs `link`, `db push`, `--linked` or `--db-url`. | The test config drifts from the real migrations, or a test command reaches the hosted project through a link. |
| G3. Test ports do not overlap the dev range (54320–54329) or the ports VocaSpace publishes (45321, 45322 observed). The test project id differs from `devspace-local`. | Docker refuses the second stack, or container names collide with dev. |
| G4. A process is judged by PID plus process identity (start time or equivalent), never by PID alone or by age. This applies to the lock holder and to each recorded writer. A process is stopped only after its identity matches the record, and only that process: no tree kill, so an unrecorded descendant is never stopped with it. | A reused PID keeps the lock forever (QE-P2 case 4), a live run is taken over, or an unrelated process is killed. |
| G5. Lifecycle order: take the lock (atomic create, or atomic takeover of a verified stale lock) before generating the workdir or touching containers. Mark the run state `dirty` before starting work. Write `clean` only after every scope's cleanup succeeded, every writer of the run except the launcher itself exited and the audit passed. A takeover is decided under exclusive arbitration against the exact lock generation it found stale, so it can never displace a lock another command acquired meanwhile. Release the lock last. Stop goes through the same lock. The lock is published and taken over atomically, so a crash never leaves a partial lock. Each writer record is its own file, created exclusively, so concurrent registrations never overwrite each other. An unreadable lock blocks (AC4); an unreadable `state.json` counts as unclean once the lock is held. | An interrupted command leaves a lock or state that reads as clean, two contenders both take over, a registration is lost, stop races a start or reset, or a surviving writer outlives a run marked clean. |
| G6. Guards in AC8 are not weakened or bypassed to make the new path pass. | A green suite that no longer proves isolation from hosted and from real mail. |
| G7. Simplification keeps every guarantee listed in AC7. The PR lists each removed or rewritten ownership test with either the guarantee it now covers or the reason the separate stack made it obsolete. | Rows silently lose cleanup, conflict or residue checks, and the second run hides residue. |
| G8. Docs, skill and `AGENTS.md` changes land in the same PR as the behavior and follow `skill-authoring` (Maintaining). | A fresh session follows the removed journal and recovery instructions, or the permission owner contradicts the new test port. |

### 1.4 Owner decisions that bind this unit

- D1 (2026-11-01): Separate dev and test stacks, then simplify the ownership layer instead of patching it (QE-P2 Direction). BL-F3 moves into quality-engineering as QE-F5, and QE-U3 covers it.
- D2 (2026-11-01): Reset only when needed (AC3), with a `--reset` flag. Drop the journal, gate, process-tree tracking, HTTP admission preload and `recover.mjs`. The dev stack has no ownership.
- D3 (2026-11-01): Keep the command names `npm test` and `npm run test:e2e`, and add `npm run test:stack:stop`.
- D4 (2026-11-01): CI uses the same commands. This is a CI change, so the Codex gate applies to this plan and its diff.
- D5 (2026-11-01): The test stack starts only the services the tests need. The dev stack runs only while manual QA needs it.
- D6 (2026-11-01): After an interrupted run, the next command stops the dead run's recorded writer processes automatically (identity verified) before it resets.
- D7 (2026-11-01): A late write inside a run is detected and reported, not prevented. Residue fails the next reservation or the end-of-run audit, marks the run unclean, and blocks later scopes; the next run resets.
- D8 (2026-11-01): Local database permissions:
  - Main may work on the local dev and test databases within an authorized task. A reset or bulk delete on the dev database needs the Owner's request.
  - An implementor gets access to a database, a kind of operation and a scope only through an Owner-approved plan or a direct Owner assignment. Otherwise Main handles database requests.
  - Before a write or reset, the connection's real target is verified, not only the port.
  - Nothing extends to hosted.
- D9 (2026-11-01): The real gate for this unit is the identity check in the test tooling (AC8). A harness hook comes later as AW-F5.

## 2. Repository facts

Baseline: `17ab51b`, checked 2026-11-01.

- `supabase/config.toml:5` has `project_id = "devspace-local"`, and dev ports are 54320–54329. `docker ps` shows the VocaSpace containers publishing 45321/45322. The checkout is linked to hosted (`supabase/.temp/project-ref`). These justify G1–G3.
- Supabase CLI 2.121.0 lists the flags `--workdir`, `start -x <services>` and `stop --project-id` / `--no-backup` in its help. The help describes `--workdir` as used without an ancestor search. Running a second stack through it is not yet verified, and CP1 verifies it first.
- In `.github/workflows/ci.yml`, both jobs start the stack with `-x studio,mailpit,edge-runtime,logflare,vector,imgproxy,supavisor,realtime,postgres-meta`. Only the `db` job then runs `db reset` (line 116); the `e2e` job runs `npm run test:e2e` on the fresh start (lines 137–144).
- PR 49 run 41311090918 (head `904cc7b`) passed both jobs. So the currently exercised suites do not need realtime (D5).
- Step times in that run: `supabase start` 80–84 s (including image pulls), `db reset` 31 s, `npm test` 33 s, `npm run test:e2e` 159 s. These justify AC3 and AC9.
- The dev stack runs db, auth, rest, kong, storage and realtime (about 700 MB). The app uses realtime (`app/components/SidebarContent.tsx:105`) and storage (`lib/supabase.ts`). This justifies D5 for dev.
- Ownership code and its tests total about 2,500 lines:
  - `__tests__/helpers/run-ownership.mjs` and `run-preload.mjs`;
  - `managed-run.mjs`, `local-readiness.mjs` and `fixture-ownership.ts`;
  - `scripts/test-data/recover*.mjs` and `__tests__/helpers/probes/`;
  - the tests `unit/run-ownership.test.ts`, `rls/fixture-recovery.test.ts`, `rls/fixture-ownership.test.ts`, `rls/e2e-preflight.test.ts` and `unit/fixture-ownership-errors.test.ts`.
- The current layer also refuses duplicate reservations across scopes (`run-ownership.mjs:146`), blocks a new scope after unresolved cleanup (`fixture-ownership.ts:146`), and refuses detached late mutations (`unit/run-ownership.test.ts:162`, `:186`). These justify AC7, D7 and G7.
- `managed-run.mjs:28` notes that a child's exit does not prove its descendants settled, and QE-P2 records writers surviving a passing run. `scripts/e2e/serve.mjs:26` spawns the Next server as a child. `fixture-ownership.ts:51` gives each scope a fresh tag, so a selector is never reserved twice. `taskkill /T` stops the whole process tree (its help text). These justify AC4, the AC7 audit and G4.
- `acquireRun` refuses any retained journal (`run-ownership.mjs:63`). So an interrupted-run check cannot pass while the old protocol is still in place, which is why CP1 and CP2 are split as in section 4.
- Runtime stack readers: `readLocalStack` (`npx supabase status -o json` in a cwd) is called by `playwright.config.ts`, `__tests__/e2e/auth.setup.ts:8`, `__tests__/rls/global-setup.ts`, `__tests__/e2e/service-role.ts` and `scripts/dev/local.mjs`. `__tests__/rls/fixture-ownership.test.ts:160` connects directly to port 54322. `local-readiness.mjs:13-23` maps Docker containers to the status endpoints. These justify AC1 and AC8.
- `AGENTS.md:94` limits implementor `psql` to `127.0.0.1:54322`. This justifies D8 and AC10.
- QE-P2 recorded six retained journals during DM-U4. Four could not be cleared by `recover.mjs` or by the 10 s writer wait. This justifies the outcome.
- `AGENTS.md` Commands, `test-quality-strategy` (Test data, End-to-end) and `references/fixture-recovery.md` describe the journal and the single shared stack. `README.md`, `supabase-migration`, `dependency-updates`, `manual-ui-validation.md`, `rls-test-design.md` and `pr-and-ci.md` mention `supabase start`, `db reset` or recovery before tests (search on `17ab51b`). This justifies AC10.

## 3. Bounded implementation hypotheses

- `scripts/test-stack/` generates `.supabase-test/supabase/` (ignored by git). It copies `config.toml` with the project id `devspace-test`, ports 55320–55329, `site_url` set to `http://127.0.0.1:3100`, and `[local_smtp]` and `studio` off, plus `migrations/` and `seed.sql`. It provides `ensureTestStack`, `decideReset`, the lock and run-state helpers, and `stopTestStack`, and its `stop.mjs` backs `test:stack:stop`. Names and layout may change if G1–G3 and AC1–AC5 hold.
- Lock and run state live in `<CommonApplicationData or /var/tmp>/devspace-test-stack-v1/`:
  - `lock.<generation>.json`: holder PID and identity, run id, checkout and command. The highest generation is the current lock. A command acquires, or takes over a stale or released generation n, by hard-linking a fully written temporary file to `lock.<n+1>.json`, which fails if that name exists, so exactly one contender for n wins and a loser refuses. Release creates `released.<n>`. The holder prunes older generations after acquiring. Nothing is ever renamed over another command's lock;
  - `writers/<run id>-<pid>-<start>.json`: one file per writer, created with exclusive create. The launcher passes the run id in the environment. Vitest main and workers register through the `rls` setup, the Playwright runner and workers through the config and fixtures, and the e2e server and its Next child through `scripts/e2e/serve.mjs`;
  - `state.json`: last reset hash, the audit snapshot, `dirty` or `clean`, and the cause.
  They are machine-wide because container names are. This may change if G4, G5 and AC3, AC4 and AC7 hold.
- Process identity is the start time (Windows `Get-CimInstance Win32_Process`, Linux `/proc/<pid>/stat`), read once per process at registration and at takeover, never inside a wait loop. Stopping uses `taskkill /PID <pid> /F` (no `/T`) on Windows and `SIGKILL` on Linux, after the identity matches. The writer wait at the end of a run checks liveness by PID and confirms identity once at the end. This may change if G4 and D6 hold.
- `npm test` becomes a launcher (like `scripts/e2e/run.mjs`) that calls `ensureTestStack`, then Vitest. `test:unit` stays Docker-free. Every stack reader in AC1 resolves the test stack through one helper that runs `readLocalStack` with the test workdir and the AC8 identity check. The Auth lookup-failure probe builds its bad URL from the verified test `dbUrl` and changes only the credentials. These may change if AC1, AC8 and the Docker-free unit run hold.
- `FixtureScope` keeps its API with in-memory records per process. The shared run state carries the unclean mark across Vitest worker processes. `trackedFetch`, the `ownedInsert` intent records and the scope header keep only what in-run cleanup and AC7 need. These may change if AC7 and G7 hold.
- The e2e readiness check keeps the port 3100 check. The SQL-connection check may be dropped, because the test database is not shared with manual clients, or kept, if no Spec item changes.
- `scripts/dev/local.mjs` calls `readLocalStack` and starts `next dev` directly. This may change if AC6 holds.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 (risk first) | The test stack runs beside the dev stack on clean runs: generated workdir, start with exclusions, health and identity check, reset decision (b)–(d), `test:stack:stop`. Every runtime stack reader and direct connection of the suites is moved to the test stack. The existing ownership stays in place, keyed to the test endpoint. Interrupted-run behavior is not accepted here. Covers AC1, AC2, AC3 (b)–(d), AC5 on clean runs, and AC8. | Unit rows: config generation and the identity check. Commands, with the dev stack running:<br>- `npm test` (fresh start, counted as reset);<br>- `npm test` again (no reset);<br>- `npm test -- --reset` (reset (d));<br>- `npm run test:e2e` twice;<br>- `npm run test:stack:stop`, then `docker ps` (the test project is gone; dev and VocaSpace are unchanged);<br>- dev container IDs and the row counts of the dev database (Main reads them, per D8), before and after;<br>- a run that prints the endpoints it used (test ports only);<br>- a required container excluded on purpose shows the AC2 message;<br>- `docker stats` with both stacks up.<br>Then `npx tsc --noEmit` and `npm run lint`. |
| CP2 | The ownership layer is replaced: lock with writer registry and orphan stop, run state, in-memory `FixtureScope` with cross-process unclean blocking, no dev ownership, removed files, with the G7 list. Covers AC3 (a), AC4, AC5 under contention, AC6 and AC7. | Subprocess unit rows (run on Windows locally and on Linux in CI's `db` job through `npm test`):<br>- two live contenders;<br>- two simultaneous stale contenders from different checkout directories;<br>- holder killed with a paused writer still alive, taken over from another checkout: the writer is stopped and reset follows;<br>- a writer that spawns a child after the first scan: the rescan stops it;<br>- a child of the dead run that registers only after the final empty scan: its lock check fails and it exits without writing;<br>- contender B pauses after reading a stale lock, A acquires, B resumes: B refuses and A's lock is untouched, also after two more acquisitions and pruning have freed B's old claim name;<br>- an otherwise clean run reaches `clean` with its launcher still alive;<br>- a delayed commit that lands after the end audit: the next command's start comparison resets;<br>- a reused writer PID (identity mismatch) is not stopped, and an unrecorded child of a stopped writer is not stopped;<br>- many writers registering at once, and registration racing a takeover: no record is lost;<br>- a successful suite with a writer that survives: the run stays `dirty`, and the next command stops it;<br>- an unreadable `lock.json` refuses and changes nothing; an unreadable `state.json` resets;<br>- a scope cleans up, then a delayed write lands under its selector: the audit reports it and the run ends `dirty`;<br>- `test:stack:stop` on a partly started stack and on a stopped one, with other projects untouched;<br>- interruption after lock publication, during reset and before the `clean` write;<br>- stop racing a start;<br>- failed tests with successful cleanup end `clean`;<br>- cleanup failure and detected residue end `dirty`, and later scopes refuse.<br>Then `npm run test:unit`, `npm test` twice and `npm run test:e2e` twice. A search shows no reference to `devspace-fixture-ownership-v1`, `run-ownership` or `recover.mjs`. Kill an e2e run mid-way: the next `npm run test:e2e` stops the orphan server and its Next child, resets and passes. Dev: start `npm run dev` with `preview_start`, stop it with `preview_stop`, then `npm test` runs with no refusal. Finish with `npx tsc --noEmit` and `npm run lint`. |
| CP3 | CI uses the commands (AC9). Docs, skill and `AGENTS.md` updates (AC10), QE-P2 and QE-F5 records, State. | `npm run docs:check`, `npm run docs:check:test` if the checker changes, and a read-through that every AC10 owner states the behavior that CP1–CP2 shipped. CI on the PR (Main), with durations compared to run 41311090918. |

Verification allocation:

| Guarantee | Layer | Assertion | Where |
| --- | --- | --- | --- |
| Config generation and isolation (G1–G3) | unit | the generated config has the test id and ports, excludes the listed services, contains no `.temp`, and copies migrations and seed exactly | new `__tests__/unit/test-stack-config.test.ts` |
| Identity check (AC8, D9) | unit | per operation: a start accepts free ports and refuses ports held by another project's container; a reset or write is refused unless the ports map to the test project's running containers; a stop accepts missing test containers and refuses a container of another project | same file, or `test-stack-identity.test.ts` |
| Reset decision (AC3) | unit | each of (a)–(d) resets, and an unchanged clean state does not | new `__tests__/unit/test-stack-reset.test.ts` |
| Lock, takeover, orphan stop, lifecycle order (AC4, AC5, G4, G5, D6) | unit with subprocesses | the CP2 cases | new `__tests__/unit/test-stack-lock.test.ts` |
| Run outcome to state (AC3 (a), AC7, D7) | unit with subprocesses, and rls | pass, fail with clean cleanup, cleanup failure, a surviving writer and residue (reservation or audit) map to `clean` or `dirty`; later scopes refuse after `dirty`; the delayed-write probe runs on the real test database | lock test file plus adapted `fixture-ownership.test.ts` |
| Fixture scope guarantees (AC7) | rls and unit | reserve, cross-scope conflict, acquire, restore, dependent-block and aggregated-error rows, on the in-memory scope | adapted `fixture-ownership.test.ts`, `fixture-ownership-errors.test.ts` |
| Dev untouched (AC1, AC5, AC6) | command check | dev container IDs and row counts are equal before and after; `docker ps` after stop; printed endpoints | CP1 and CP2 report evidence |
| Guards (AC8) | existing e2e and unit | network guard, server guard, mail record and env-map rows still pass | existing rows |
| CI path (AC9) | CI | the `db` and `e2e` jobs pass using only the commands | PR checks |

Residual manual checks: none beyond the command checks above. They run real Docker and process kills, which no unit test reproduces.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Two stacks plus VocaSpace exhaust Docker memory (7.6 GB). | The test stack uses the CI exclusions. CP1 records `docker stats` with both stacks up. If memory is short, the Owner stops VocaSpace or the dev stack (D5). |
| The CLI resolves migrations or seed differently under `--workdir`. | CP1 runs first and fails loudly. Copying keeps the files identical, and the unit row compares them. |
| A test command resets or stops the dev stack. | G1 plus the AC8 identity check before every command. The CP1 dev check before and after. |
| Orphan stop kills an unrelated process. | G4: identity match before any stop, one process at a time with no tree kill, and the reused-PID and unrecorded-child rows. |
| A late write in a run goes unnoticed. | D7: reservation refuses occupied selectors, the end-of-run audit compares the database with its snapshot after every writer has exited, residue marks the run unclean, and the next run resets. |
| The audit flags a legitimate change. | Excluded columns are listed in code with their reason; CP2 runs the full suites twice to show a clean run passes the audit. |
| CI start time grows, or a job times out. | The command uses the same exclusions and image cache as today. Compare durations in the PR body. |
| Removing tests hides a lost guarantee. | The G7 list, and Codex reviews the diff. |
| Windows start-time lookup is slow (about 0.5 s). | Once per process at registration and takeover, never in a wait loop (the DM-U4 gate lesson). |

- Rollout runbook: none hosted. After merge, the Owner may delete `C:\ProgramData\devspace-fixture-ownership-v1\`, which nothing reads any more. The Owner runs `npx supabase stop` for the dev stack when not doing QA.
- Stop when:
  - `--workdir` cannot run the test stack beside dev;
  - a guard in AC8 would have to weaken;
  - an AC7 guarantee cannot be kept in memory;
  - CI needs a change beyond the `db` and `e2e` steps.
- Rollback: revert the PR. The dev stack is unaffected, `npx supabase stop --project-id devspace-test --no-backup` removes the test stack, and nothing is lost but disposable test data.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
