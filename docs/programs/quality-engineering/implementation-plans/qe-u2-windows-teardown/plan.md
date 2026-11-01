# QE-U2 detail plan — Windows full-suite teardown and preflight timing

Revision: r1, 2026-11-01. Owner approval: 2026-11-01. Charter: [quality-engineering](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: QE-P1 is addressed. A full `npm test` on Windows whose assertions pass releases ownership normally even when Vitest has not yet finished stopping the last RLS worker at global teardown, and the E2E preflight file no longer fails on an implicit 5000 ms timeout under the default full-suite load. Every ownership guard keeps failing closed.

| ID | Observable result |
| --- | --- |
| AC1 | When RLS global teardown runs while a registered worker process is still exiting, teardown fences new admission, waits for that writer to exit within a bounded deadline, then releases ownership; the run exits 0 when its assertions passed. |
| AC2 | When a registered writer is still alive (or its lifetime cannot be established) at the deadline, teardown fails with the existing `Writer descendants are still alive; ownership retained` error and the journal stays in place for explicit recovery. Teardown never deletes a member record, kills a process or skips the check to obtain a pass. |
| AC3 | Unresolved journal entries at teardown still retain ownership with the existing error; the wait does not retire, forget or reinterpret entries. |
| AC4 | The `rls` project has an explicit test timeout chosen from Windows full-suite measurements of `e2e-preflight.test.ts` (and the slowest other RLS row), recorded with the evidence. Two consecutive default `npm test` runs on Windows pass all assertions, exit 0 and release ownership, with no reset or recovery between them. |
| AC5 | A timed-out RLS test still fails closed: a scope left `closing` blocks later scopes in that run as today. No cleanup is made to finish early or ignore the scope. |
| AC6 | Existing ownership, recovery and E2E behavior is unchanged: unit subprocess probes, `fixture-recovery.test.ts`, seed/residue checks and `npm run test:e2e` still pass. |

### 1.2 Scope and non-goals

- In scope: the RLS global-setup teardown path; a shared bounded writer-exit wait reused by the RLS teardown and `runManagedChild` (or an equivalent that keeps one definition of the rule); the `rls` project timeout in `vitest.config.mts`; a unit regression for the wait; testing docs where the lifecycle description changes; QE-P1 and State records.
- Non-goals: upgrading or patching Vitest; changing the pool, isolation or `fileParallelism`; performance work on the ownership helper or preflight queries (the Owner chose measure-and-set); changing recovery, journal format or E2E specs; product, schema or CI changes; hosted access.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. `releaseRun` keeps its descendant and entry checks unchanged; the wait happens before it, never instead of it. | A green run while a writer can still mutate the database. |
| G2. An `alive()` error during the wait counts as alive (uncertainty), as in `runManagedChild`. | A transient Windows state is read as absence and ownership is released early. |
| G3. Teardown calls `closeRun` before waiting. | A late worker joins or records an entry after the wait observed none. |
| G4. The deadline is bounded and fixed in code (no environment override). | A hung worker makes `npm test` hang, or a variable silently disables the fence. |
| G5. The timeout value comes from measured durations with headroom, stated in the commit and State. | A guessed value either still flakes or hides a real hang for minutes. |
| G6. Reset or explicit recovery is not used between the two acceptance runs. | Passing runs that depend on cleaned state prove nothing about release. |

### 1.4 Owner decisions that bind this unit

- (2026-11-01) Teardown fix: bounded wait for registered writers before release, keeping the fail-closed result after the deadline.
- (2026-11-01) Preflight timeout: measure on Windows under the full suite, then set an explicit `rls` test timeout from the measurements; no deeper performance investigation in this unit.

## 2. Repository facts

Baseline: `29ad22e`, checked 2026-11-01.

- Vitest is 5.0.5. In `Vitest.close()` (`node_modules/vitest/dist/chunks/cli-api.De07GUeT.js`, around line 13232) every project's `_teardownGlobalSetup()` runs before `this.pool.close()` — justifies AC1.
- The pool starts each isolated worker's termination without awaiting it ("Runner terminations are started but not awaited until the end of full run"); `exitPromises` are awaited only in `cancel()`, which `close()` calls (`node_modules/vitest/dist/chunks/index.1TqnEahn.js`, around lines 5936-5966 and 5971) — the last RLS worker can still be alive when teardown runs; justifies AC1.
- Each RLS worker registers itself as a member through `joinRun(ownership)` in `__tests__/rls/helpers.ts:9`; the coordinator is the Vitest main process that acquired the run in `__tests__/rls/global-setup.ts`.
- `__tests__/rls/global-setup.ts:64-68` returns a synchronous teardown that calls `releaseRun(ref)` immediately, with no `closeRun` and no wait — the source of QE-P1's `Writer descendants are still alive` exit.
- `releaseRun` throws that error when any non-coordinator member is alive (`__tests__/helpers/run-ownership.mjs:206`) — justifies G1/AC2.
- `runManagedChild` (`__tests__/helpers/managed-run.mjs:27-37`) already does `closeRun`, a 10 s bounded wait treating `alive()` errors as alive, then `releaseRun` — the pattern to reuse; justifies G2/G3.
- QE-P1 evidence: after the failed exit, all eight recorded writers were dead and no entries remained — consistent with a teardown/worker-exit race rather than a leaked writer.
- `vitest.config.mts` sets no `testTimeout` or `hookTimeout`, so Vitest's 5000 ms test default applies; the default `npm test` runs `unit` and `rls` projects in one process with `rls` files sequential.
- QE-P1 evidence: the first failing run exceeded 5000 ms in `e2e-preflight.test.ts`, then 83/261 assertions failed; the isolated rerun passed. A timed-out test's `afterEach` cleanup runs while the body may still write, and a `closing` scope blocks later scopes (`recordEntry`, `run-ownership.mjs`) — justifies AC4/AC5.
- `__tests__/unit/run-ownership.test.ts` has a `child()` subprocess helper and an existing "descendants" retention probe (around line 235) — the place for the AC1/AC2 regression.

## 3. Bounded implementation hypotheses

- Extract the wait from `runManagedChild` into an exported helper in `__tests__/helpers/run-ownership.mjs` or `managed-run.mjs` (for example `awaitWritersExit(ref, deadlineMs)`), and call it from both coordinators — may change shape if G1-G4 still hold.
- Make the RLS teardown async: restore `DEVSPACE_OWNERSHIP`, `closeRun(ref)`, await the helper, `releaseRun(ref)`; errors keep the frame-less form the setup already uses for Vitest 5.0.5 — may change if AC1-AC3 hold.
- Unit regression: a child joins the run, then exits after a short delay; release succeeds after the wait. A child that never exits makes the wait end at the deadline and `releaseRun` throw, with the member record kept. A short deadline parameter keeps the test fast — may change if both outcomes stay asserted against real subprocesses.
- Measurement: run default `npm test` on Windows several times with per-file and per-test durations (for example `--reporter=verbose` or a JSON reporter to the scratchpad), record the slowest RLS test and preflight durations, set `testTimeout` on the `rls` project only.
- `.claude/skills/test-quality-strategy/references/fixture-recovery.md` or the Test data section gains one line only if the teardown behavior it describes changes.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Shared bounded wait; RLS teardown fences, waits and releases; unit regression for exit-within-deadline and retained-after-deadline. | `npm run test:unit`; `npx tsc --noEmit`; `npm run lint`; one default `npm test` on Windows with ownership released. |
| CP2 | Measured `rls` test timeout set; QE-P1 resolved and State/charter updated. | Measurement runs recorded; two consecutive default `npm test` on Windows without reset/recovery (AC4); `npm run test:e2e` once (AC6, shared `runManagedChild`); `npm run docs:check`. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The race does not reproduce on demand, so a passing run cannot prove the fix. | The unit regression forces the delayed-exit case with real processes; full runs are supporting evidence only. |
| The extracted helper changes E2E release timing. | Keep the 10 s deadline and alive-error rule; run `npm run test:e2e` at CP2. |
| A larger timeout hides a real hang. | Per-project value from measurements with stated headroom; the timeout still fails and AC5 still blocks later scopes. |
| Docker is not running on the Owner's machine at planning time. | Implementation pauses at the first `npm test` until the local stack is started; no substitute check is claimed. |

- Rollout runbook: none (test harness only; no hosted step).
- Stop when: the race is shown to come from a leaked writer rather than worker exit timing; meeting AC4 needs a pool/isolation change or a Vitest change; any guard would need weakening.
- Rollback: revert the commits; no data or schema state is involved.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
