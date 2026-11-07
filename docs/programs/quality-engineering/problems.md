# Problems, risks and follow-ups — quality-engineering

Charter: [README.md](README.md). Progress: [progress.md](progress.md).

## Open

### QE-P3: Windows can reserve the local stack ports

- Status: Open (2026-11-03).
- Problem: both local stacks publish ports inside the Windows dynamic port range (49152–65535): dev 54320–54329, test 55320–55329. Hyper-V and WinNAT reserve blocks of that range for Docker and WSL and may pick other blocks after a restart, so a stack can lose its published ports or fail to start with no repo change. The test stack has the same exposure.
- Evidence: 2026-11-03, the dev stack containers ran with no published ports and the browser got `ERR_CONNECTION_REFUSED` on `127.0.0.1:54321`; `npx supabase start` then failed with `listen tcp 0.0.0.0:54322: bind: An attempt was made to access a socket in a way forbidden by its access permissions`; `netsh int ipv4 show excludedportrange protocol=tcp` listed 54236–54335 (not administered). `net stop winnat` and `net start winnat` (admin) released it and the stack started from its backup with its data.
- Direction: a QE initiative moves both stacks to ports outside the dynamic range. Before choosing them, check `netsh int ipv4 show dynamicport tcp`, the IPv4 and IPv6 `excludedportrange` lists and the listening processes on the candidate ports. A port below 49152 can still be excluded or in use, so this is a check, not a guarantee. Change both stacks in one PR: `supabase/config.toml`, `scripts/test-stack/config.mjs`, `.github/workflows/ci.yml`, the unit tests that assert the ports or the stack identity, `AGENTS.md`, `README.md` and `test-quality-strategy`; earlier plans stay as they are. A port change needs only a stack restart, not a reset: keep the dev data and reset only with a recovery path and the Owner's request. Until then, the workaround is the winnat restart above.
- Exit condition: both stacks publish ports outside the dynamic range that the checks showed free, `npm test` and `npm run test:e2e` pass, CI is green, and the dev stack restarts on the new ports with its data.

### QE-P4: a changed Auth setting in config.toml does not reach a running test stack

- Status: Open (2026-11-04).
- Problem: the test commands see the changed `supabase/config.toml` hash and reset the test database, but a reset does not restart the Auth container with the new `[auth]` settings, so the run tests the old setting while printing that the config change was applied.
- Evidence: 2026-11-04 (BL-P11), with `minimum_password_length` changed from 6 to 8, `npm test` reset the stack ("the test config changed since the last reset") and `[P13]` in `__tests__/rls/profiles.test.ts` still got no `weak_password` error for a 7-character password; after `npm run test:stack:stop` the next `npm test` started the stack and `[P13]` passed. CI starts a new stack each run, so it is not affected.
- Direction: when the generated config hash changes, the test commands stop and start the test stack instead of only resetting it (`scripts/test-stack`), with a unit test of that decision. Until then, run `npm run test:stack:stop` after an `[auth]` change. The dev stack needs `npx supabase stop` and `npx supabase start` for the same reason.
- Exit condition: an `[auth]` change in `config.toml` is in effect on the first test command after it, with no manual stop.

### QE-P5: a test-stack lock test fails now and then inside `npm test`

- Status: Open (2026-11-04).
- Problem: `__tests__/unit/test-stack-lock.test.ts` > "never loses a record that passed the lock check while a takeover scans" failed in 2 of 5 `npm test` runs on 2026-11-04, while every other test passed; a red unit test without a cause makes a real failure easy to dismiss.
- Evidence: the failing runs were on `feat/af-admin-content-forms` (`cc2d5ff` plus the BL-P11 config and `[P13]` change, which do not touch the lock code). The same file passed 3 runs alone (`vitest run --project unit <file>`), `npm run test:unit` passed 3 runs, and the failure message was not kept (the minimal reporter prints only the name). AF-U4 progress also records one unexplained `test:unit` failure on 2026-11-03 without a log. 2026-11-04 on `test/qe-component-tests` (`2a205b1`, no lock code change): 1 of 2 `npm test` runs failed one test (676 of 677) with `Command failed: powershell.exe ... Get-Process -Id 24772 ...` thrown from the process start-time read in `scripts/test-stack/lock.mjs:60`; the minimal reporter did not name the test, and the rerun passed 677. So a start-time read that fails, not only an assertion race, is a candidate cause.
- Direction: reproduce under load (`npm test -- --reporter=default` in a loop, keeping the log), then fix the race in the test or in `scripts/test-stack` lock code, whichever the log shows; do not raise a timeout without a measured reason.
- Exit condition: the cause is named and fixed, and 10 consecutive `npm test` runs pass that test.

### QE-P7: e2e row `[T8]` failed once in a full run with the student signed out

- Status: Open (2026-11-05, found by Main while verifying security-engineering SE-P2; outside that change, which touched only the activation mail).
- Problem: in a full `npm run test:e2e` run, `[T8]` (`__tests__/e2e/student.spec.ts`) found no course card on `/profile` (`getByRole('article')` expected 4, received 0 after 10 s); the page snapshot showed the signed-out header ("Đăng nhập"), so the saved student session was not recognised for that page load.
- Evidence: branch `fix/se-p2-mail-template` from `7c7d74e`, uncommitted change to `lib/email.server.ts` and the new `lib/activation-email.ts` only: 142 passed, 1 failed (`test-results/.../error-context.md`). Rerunning `npm run test:e2e -- --grep "\[T8\]"` right after passed (no reset, nothing changed). Whether the run ended clean was not kept, and the cause (session refresh, a cookie race with another student row, fixture timing) is not known.
- Direction: reproduce with repeated full runs keeping the Playwright trace of a failure, then fix the cause in the test, its fixtures or the session setup; do not add a retry or a longer timeout without a named cause.
- Exit condition: the cause is named and fixed, and 5 consecutive full `npm run test:e2e` runs pass `[T8]`.

### QE-P8: rls fixture guards do not stop a timed-out test's later writes or a timed-out cleanup hook

- Status: Fixed locally, awaiting delivery (QE-U5 CP1, 2026-11-07; found by the Codex implementation review of security-engineering SE-U4, pre-existing in the shared harness).
- Problem: `FixtureScope` and SE-U4's Storage `OwnedObjects` check the shared run state only when a scope opens or a name is recorded. A test body that times out keeps running in the background, so it can still send writes through selectors or names it already holds after cleanup ran. `finishFixtureScope` and `OwnedObjects.cleanup` mark a test-body timeout only on entry; a cleanup hook that itself exceeds `hookTimeout` is not marked, so the next scope can open while that cleanup is still pending.
- Evidence: `__tests__/helpers/fixture-ownership.ts` (`FixtureScope` constructor check), `__tests__/rls/helpers.ts` (`ownedInsert`, `finishFixtureScope`), `__tests__/helpers/storage-object-scope.ts` at `937a7e7`. In the installed Vitest, a timeout rejects the wrapper without stopping the test function, and the hook timeout is wired to `context.signal`. The end-of-run audit, which covers `storage.objects` and runs after the writer wait, detects persisted residue and makes the run dirty, so the next command resets; nothing reproduced a residue.
- Direction: check admission immediately before each actor write that uses an already-held selector or name, and mark the run when the cleanup hook's `context.signal` aborts; cover both with controlled pending-request unit tests, for `FixtureScope` and `OwnedObjects` together.
- Exit condition: a resumed timed-out test can send no further fixture write, a cleanup-hook timeout marks the run before the pending operation settles, and both are proven by tests.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- QE-P1 — Resolved 2026-11-01: RLS teardown waits up to 10 s for registered writers before releasing ownership, and the `rls` project has a measured 15 s test timeout; guards stay fail-closed (PR 46, `3e4b941`).
- QE-P2 — Resolved 2026-11-02: tests run on a separate `devspace-test` stack under one machine-wide lock with writer records and an end-of-run audit; the ownership journal and `recover.mjs` are gone, and an interrupted run is cleaned up by the next command (PR 50, `60c369a`).
- QE-P6 — Resolved 2026-11-05: focused verification during implementation, one final full regression after whole-diff review, and retained-state repeats when the affected contract warrants them (PR 67, `3d21627`).
