# QE-U5 detail plan — Flaky harness fixes and fixture guards

Revision: r3, 2026-11-07. Owner approval: pending. Master plan or charter: [charter](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome:

- QE-P8: a fixture write cannot start after its test timed out or its cleanup hook timed out without the run turning unclean.
- QE-P5 and QE-P7: diagnostics come first, so a failure names its cause. Each is then fixed at a named cause, or stays open with that evidence after a bounded, focused attempt.
- The same branch carries the docs catch-up of security-engineering SE-U1 (PRs 71 and 72) and of the backlog batch (PR 73).

| ID | Observable result |
| --- | --- |
| AC1 | QE-P8, test body. Operation A of a test is held pending; the test is marked timed out; the body then resumes and tries operation B through a fixture it already holds. B's request callback never runs, and the run stays unclean. This holds for every mutation a test sends on a fixture it holds:<ul><li>`ownedInsert`, checked after `scope.reserve(...)` resolves and right before the callback;</li><li>updates, deletes and write RPCs on a held row (for example `content.test.ts:142-146`, `community.test.ts:542`);</li><li>Storage uploads, upserts, moves and removes under a name recorded in `OwnedObjects`.</li></ul>Cleanup and read-back stay exempt and still run while the run is unclean. The CP1 report lists every such call in `__tests__/rls/`, found by search, with the guarded path each one uses. A unit test proves each kind of path (insert, row mutation, RPC, Storage) and fails when its check is removed. |
| AC2 | QE-P8, cleanup hook. Every rls hook that runs `finishFixtureScope` or `OwnedObjects.cleanup` passes Vitest's hook context. When the hook's `context.signal` aborts (`hookTimeout`), or is already aborted on entry, the run is marked unclean before the pending cleanup operation settles, and a scope opened afterwards refuses and names the cause. The listener is removed when cleanup ends. The regression goes through the hook registration path the rls files use, not only a direct call with a fabricated context, and fails when the abort handling is removed. |
| AC3 | QE-P5, `test-stack-lock.test.ts`. Diagnostics land first:<ul><li>a failed `processStart` read reports exit status, signal, stderr, duration and PID;</li><li>a probe keeps its stderr and exit, and reports an abnormal exit as soon as it happens instead of waiting out its event timeout.</li></ul>Then one of two results holds: (a) the cause is named and fixed, with a regression that reproduces it, and the lock test file passes the focused confirmation in G6; or (b) no reproduction within G6, and QE-P5 stays open with the new evidence (Owner decision 3). |
| AC4 | QE-P7, e2e row `[T8]`. Before the student session is used in the investigated subset, the run records only the allowlisted facts in G4:<ul><li>session age and the access token's remaining lifetime, decoded from the cookie without sending it anywhere;</li><li>each refresh request the browser sends (`/auth/v1/token?grant_type=refresh_token`) and its HTTP status;</li><li>each refresh the Next server sends (the proxy's `getUser()` at `lib/supabase.proxy.ts:31`), with its status, if the e2e server can record it like `serverRecords` records mail; otherwise the report states that server-side refreshes were not observed, and no conclusion of "no refresh" is drawn from browser events alone;</li><li>auth cookie names;</li><li>whether the server recognises the session.</li></ul>No diagnostic may refresh or rotate the session itself. A token check uses a path that cannot refresh, such as `getUser(jwt)` with the access token, never a client that holds the refresh token. When the session is not recognised, `[T8]` fails with a message that says so, instead of failing on the course-card count. Then one of two results holds: (a) the cause is named and fixed in the test, its fixtures or the session setup, and the subset passes the focused confirmation in G6; or (b) no reproduction within G6, and QE-P7 stays open with the new evidence (Owner decision 3). |
| AC5 | Docs catch-up. `npm run docs:check` passes and every record below matches the merged state:<ul><li>security-engineering `progress.md`: State and milestones record M2 applied with its postflight and D5 result, PR 72 merged as `8fb9b59`, and production QA passed (facts from Main's brief, G7);</li><li>security-engineering `problems.md`: SE-P8 to SE-P12 resolved, one line each, citing PRs 71 and 72;</li><li>security-engineering `future-features.md`: SE-F2 and SE-F3 keep their IDs and entries, with Target program the techstack migration;</li><li>the backlog: `Done (PR #73)` lines for BL-P2, BL-P3, BL-P13, BL-P17 and BL-P18;</li><li>quality-engineering `problems.md`: the exit conditions of QE-P5 and QE-P7 follow Owner decision 5, and the trace finding in section 2 is recorded as a new open problem.</li></ul> |

### 1.2 Scope and non-goals

- In scope:
  - the QE-P8 checks in `__tests__/helpers/fixture-ownership.ts`, `__tests__/rls/helpers.ts` and `__tests__/helpers/storage-object-scope.ts`;
  - the bounded caller changes AC1 and AC2 need in `__tests__/rls/*.test.ts`: routing held-fixture mutations and Storage writes through a guarded path, and passing the hook context;
  - the QE-P5 diagnostics and investigation in `scripts/test-stack/lock.mjs` and `__tests__/unit/test-stack-lock.test.ts`;
  - the QE-P7 diagnostics and investigation in `__tests__/e2e/` (`[T8]`, its fixtures, `auth.setup.ts`, `fixtures.ts`);
  - the AC5 docs, and this program's State.
- Non-goals:
  - CI workflow changes;
  - new packages;
  - Playwright or Vitest retries;
  - raised timeouts without a measured cause;
  - global Playwright trace settings (the trace finding is recorded, not fixed);
  - the e2e coverage of BL-F2 and the QE-F8 audit (a later PR, Owner decision 4);
  - product code, Auth config, migrations, the dev stack, and any hosted access.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. `processStart` stays fail-closed: a live process whose start time cannot be read never reads as dead, and an uncertain identity is never taken over or stopped. A regression proves that a throwing read leads to neither takeover nor stop. | A diagnostic or retry that turns a read failure into "dead" lets a takeover kill or skip a live writer (lock.mjs G4). |
| G2. No retry, longer timeout or weaker assertion without a named, measured cause. A retry of the start-time read is allowed only if the evidence shows a transient PowerShell failure, and it stays bounded and fail-closed. | A green suite that hides a real race or a real session loss. |
| G3. Every probe that touches a Supabase stack runs through the npm entry points on the test stack. Unit probes of the lock code keep their temporary directories and start no stack. Nothing touches the dev stack, and the hosted, network and mail guards stay unchanged. | Manual-QA data destroyed, a weaker guard, or needless stack start-ups. |
| G4. Diagnostics use an allowlist:<ul><li>cookie names;</li><li>HTTP status;</li><li>timestamps and durations;</li><li>a URL with no query or hash, as in `fixtures.ts:37`;</li><li>exit status and stderr of local processes.</li></ul>Nothing prints or stores a cookie value, a JWT, a refresh token, a password or a mail link. A raw Playwright trace is not used or quoted as evidence, because the recorder stores headers and cookies. | A secret in logs, reports or the PR (`test-quality-strategy`, e2e). |
| G5. A new admission check sits right before the request callback, after every preparatory `await`. It records the cause through the existing run marker (`markUnclean`, `uncleanCause`), adds no second state store, and never blocks cleanup or read-back. | A write that lands after its refusal check, two sources of truth for run cleanliness, or residue nobody can clean. |
| G6. Bounded, focused attempt (Owner decisions 3 and 5):<ul><li>QE-P5: up to 20 runs of the lock test file alone (`npm run test:unit -- __tests__/unit/test-stack-lock.test.ts --reporter=default`). If the evidence points at the start-time read, a narrower `processStart` probe follows: at most 10 rounds of 16 concurrent reads against live and exiting processes, within 30 minutes of machine time in all. Then stop, keep the diagnostics, and leave QE-P5 open.</li><li>QE-P7: the session analysis first, then up to 2 invocations of the student subset through `npm run test:e2e` with `--grep` or the spec file and `--repeat-each=5`. A repeat inside one invocation is not an independent full run, and the report says so.</li><li>Focused confirmation after a fix: 20 consecutive green runs of the lock test file for QE-P5, or one `--repeat-each=10` invocation of the subset for QE-P7.</li></ul>Every run's output is kept until the checkpoint report, and each AC result states the runs made and what each showed. | Open-ended investigation, hours of full-suite repeats, or a claim of "not reproducible" without evidence. |
| G7. The AC5 facts come from Main's brief and the merged history (`git log origin/main`). The implementor runs no hosted query. | A state record built from an assumption, or hosted access by an implementor (`AGENTS.md` section 4). |
| G8. Fixture ownership changes get the reset-then-retained check: affected writing tests run once after a reset (`npm test -- --reset`), then once on the retained stack without a forced reset. Both reset/no-reset decisions and cleanup/audit outcomes are reported. If the second run resets anyway, the gap is reported. | A cleanup change that only works on a fresh stack (`test-quality-strategy`, Repeatability checks). |

### 1.4 Owner decisions that bind this unit

1. (2026-11-07) Open QE-U5 for QE-P5, QE-P7 and QE-P8 on `test/qe-flaky-harness`. The SE-U1 docs catch-up and the PR 73 backlog `Done` lines ship in the same PR.
2. (2026-11-07) SE-F2 and SE-F3 move to the techstack migration.
3. (2026-11-07) When QE-P5 or QE-P7 does not reproduce within the bounded attempt, the PR keeps the diagnostics and still merges, and the entry stays open with the new evidence.
4. (2026-11-07) The e2e coverage work (BL-F2 and the QE-F8 audit) is a separate, later PR.
5. (2026-11-07, after the Codex plan review) Focused checks replace the 10 full `npm test` and 5 full e2e confirmation runs in the exit conditions of QE-P5 and QE-P7. A fix needs a reproducing regression, the G6 focused confirmation and one final full regression.

## 2. Repository facts

Baseline: `1b7dd3a`, checked 2026-11-07.

- `processStart` (`scripts/test-stack/lock.mjs`) reads a Windows start time with `powershell.exe Get-Process` through `execFileSync`. A non-zero exit throws `Command failed: powershell.exe ...`, which is the error QE-P5 recorded once — justifies AC3 and G1.
- The probe helper in `__tests__/unit/test-stack-lock.test.ts` ignores the child's stderr (`:73`), and can wait 40 s for an event after the child has exited (`:77`). The takeover test swallows event-wait errors (`:229`). The file's registration tests start 12 registrants (`:207`) and 8 registrants (`:220`) at once — justifies the AC3 probe diagnostics.
- The logs captured for QE-P5 did not name the failing test, although Vitest's minimal reporter can print failed names — justifies `--reporter=default` with full output kept (G6) instead of a new reporter.
- `FixtureScope` checks the run state only in its constructor (`fixture-ownership.ts:72`), and `OwnedObjects` only records names and cleans them up (`storage-object-scope.ts:10-32`). Storage writes call the SDK directly (`__tests__/rls/storage.test.ts:139`, `:159`), and some held-fixture updates bypass `ownedInsert` (`community.test.ts:308`). `ownedInsert` awaits `scope.reserve(...)` before its callback (`rls/helpers.ts:48`) — justifies AC1 and G5.
- `community.test.ts:38-39` runs `finishFixtureScope()` in `afterEach` without the hook context. Vitest aborts the hook's `context.signal` on timeout while the hook's promise may continue — justifies AC2.
- `playwright.config.ts:27` keeps traces on failure (`retain-on-failure`). The installed trace recorder stores request and response headers, cookies included. `test-quality-strategy` says sessions stay out of traces. This is pre-existing and outside this unit — justifies G4 and the new problem entry in AC5.
- `supabase/config.toml` declares `jwt_expiry = 3600`, refresh-token rotation and `refresh_token_reuse_interval = 10`. `auth.setup.ts:31` saves one fresh session per seed user, the e2e fixtures close each context without writing a refreshed session back (`fixtures.ts:119`), and supabase-js refreshes only near expiry. Rotation is therefore a hypothesis to test with the AC4 facts, not a conclusion. The declared config may differ from the running container (QE-P4) — justifies AC4 and G6.
- On 2026-11-07, `docs/programs/security-engineering/progress.md` State said PR 2 was open and M2 not applied. `problems.md` listed SE-P8 to SE-P12 as "Open, before migration", and the backlog listed BL-P2, BL-P3, BL-P13, BL-P17 and BL-P18 as "Fixed locally, awaiting delivery" — justifies AC5.

## 3. Bounded implementation hypotheses

- QE-P8:
  - A guard such as `admitted(run, fn)` runs the request callback only while `uncleanCause` is empty. `ownedInsert` uses it after `reserve`. A small `FixtureScope` or `OwnedObjects` method (for example `write(name, fn)`) carries held-fixture mutations and Storage writes.
  - A shared hook-registration helper passes `context` to `finishFixtureScope` and `OwnedObjects.cleanup`. They attach an `abort` listener that calls `markUnclean` synchronously, check `signal.aborted` on entry, and remove the listener in `finally`. The AC2 regression may run a tiny Vitest file with a short `hookTimeout` through the existing probe pattern.
  - All of this may change if AC1, AC2 and G5 still hold.
- QE-P5: the diagnostics above, then a cause-specific fix. Both may change if G1, G2 and AC3 hold.
- QE-P7: a session precondition step for the student subset, either a shared fixture or the start of `[T8]`. It decodes the access token's expiry locally, checks the token with `getUser(jwt)` only, never with the `auth.setup.ts` client, which holds the refresh token and may refresh, and reads refreshes from Playwright's network events plus, if feasible, an e2e server record. It records names and statuses only. A fix depends on what those facts show; for example, a rotated token reused from the saved state would call for a per-row session copy. This may change if G2 and G4 hold.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | AC1 and AC2 (QE-P8), and QE-P8 fixed locally, awaiting delivery | `npm run test:unit` with the new tests and their mutation proofs; both runs of the G8 reset-then-retained pair of `npm test`, completed at CP1 |
| CP2 | AC3 (QE-P5): diagnostics, then fix (a) or open (b) | the G6 lock-file runs; `npm run test:unit` |
| CP3 | AC4 (QE-P7): diagnostics, then fix (a) or open (b) | the session analysis; the G6 subset invocations |
| CP4 | AC5 docs catch-up, and QE State and entries | `npm run docs:check` |
| Final | Whole-diff self-review, then final regression | `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm test`, `npm run test:e2e`, `npm run build` and `npm run docs:check`, once each and unfiltered. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A check placed after a request starts lets a write land first. | G5. The AC1 test holds A pending and proves B's callback never ran. |
| An rls caller keeps writing outside the guarded path. | AC1 covers every mutation on a held fixture, and the CP1 report lists every call found by search. |
| A diagnostic changes the session it observes. | AC4 forbids refreshing diagnostics and names a token check that cannot refresh. |
| A diagnostic or retry turns a read failure into "dead process". | G1 and its regression. |
| A session diagnostic leaks a token. | G4 allowlist. Main checks the diff and the reported output for values. |
| The focused attempt misses a cause that needs the full suite's load. | Owner decision 3. The diagnostics stay in, so later normal runs collect the evidence. |
| Repeated runs leave the test stack dirty. | The next command resets after preflight. An unreadable lock stops the work and goes to Main. |

- Rollout runbook: none. No hosted step, migration or CI change.
- Stop and report to Main with the evidence when:
  - a fix needs a CI, config, Auth, product or migration change;
  - a fix would weaken a guard or G1;
  - the cause points outside the harness;
  - the lock directory cannot be read;
  - a command would touch the dev stack.
- Rollback: revert the PR. The docs changes revert with it.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
