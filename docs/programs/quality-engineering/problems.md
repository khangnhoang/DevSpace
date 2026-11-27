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

### QE-P7: e2e row `[T8]` failed once in a full run with the student signed out

- Status: Open (2026-11-05, found by Main while verifying security-engineering SE-P2; outside that change, which touched only the activation mail).
- Problem: in a full `npm run test:e2e` run, `[T8]` (`__tests__/e2e/student.spec.ts`) found no course card on `/profile` (`getByRole('article')` expected 4, received 0 after 10 s); the page snapshot showed the signed-out header ("Đăng nhập"), so the saved student session was not recognised for that page load.
- Evidence: branch `fix/se-p2-mail-template` from `7c7d74e`, uncommitted change to `lib/email.server.ts` and the new `lib/activation-email.ts` only: 142 passed, 1 failed (`test-results/.../error-context.md`). Rerunning `npm run test:e2e -- --grep "\[T8\]"` right after passed (no reset, nothing changed). Whether the run ended clean was not kept, and the cause (session refresh, a cookie race with another student row, fixture timing) is not known.
- Direction: reproduce with repeated full runs keeping the Playwright trace of a failure, then fix the cause in the test, its fixtures or the session setup; do not add a retry or a longer timeout without a named cause.
- Update (2026-11-07, QE-U5 CP3): `[T8]` now records the saved session's age and remaining lifetime, whether Auth recognises the access token (`getUser(jwt)`, no refresh), the browser's refresh requests, the server's refresh and token-check calls with status, and the auth cookie names, and fails with a message that says so when the session is lost. Two focused invocations (`student.spec.ts` x5: 58 passed; `student.spec.ts` plus `learner-forms.spec.ts` x5: 123 passed; repeats in one invocation are not independent full runs) showed a fresh session of 3600 s lifetime, age 33 to 170 s, about 14 `/auth/v1/user` calls per `[T8]` all 200, no refresh by the browser or the server, and no loss. Not reproduced; expiry-triggered refresh is unlikely to explain a run shorter than the token lifetime.
- Exit condition: the cause is named and fixed with a reproducing regression, one `--repeat-each=10` invocation of the student subset passes, and one final full `npm run test:e2e` run passes `[T8]`.

### QE-P9: Playwright traces kept on failure store cookies and headers

- Status: Open (2026-11-07, found while planning QE-U5; outside it).
- Problem: `playwright.config.ts` keeps traces on failure (`retain-on-failure`) and the installed recorder stores request and response headers, cookies included, while `test-quality-strategy` says sessions stay out of traces. CI uploads `playwright-report/` on failure.
- Evidence: `playwright.config.ts:27`; `.github/workflows/ci.yml` (upload-artifact of `playwright-report/`). The sessions are local seed users on the test stack. No raw trace was opened (QE-U5 G4).
- Direction: a later initiative decides between no trace, a scrubbed trace or accepting local-only traces.
- Exit condition: a failure artifact holds no cookie or token value, or the Owner accepts the exposure.

### QE-P10: a public course-navigation e2e row failed once on a three-heading strict-mode match

- Status: Fixed locally, awaiting delivery (2026-11-27, branch `fix/qe-p10-course-heading-wait`). Cause: the row asserted the course name right after clicking a home-page course link, before the navigation committed, and the home page titles that course three times (the `HeroSlider` h1, a card h2 and an h3), so the name-only locator matched the home page. The row now waits for the detail URL and the detail-only heading "Bạn sẽ học được gì?", then asserts the course h1. Reproduced on demand by delaying the detail route's requests by 2 s: the old assertion failed with the same three-element strict-mode error and the new one passed. On Node v26.13.0, `npm run test:e2e -- public --repeat-each=10` passed 153 and a full `npm run test:e2e` passed 183. Recurrence: PR 93 CI run 45403542685 failed the row four times in a row (two attempts, each with its Playwright retry); the trace snapshot at the failed expect still showed the frame URL `/`. First found 2026-11-16 by the SE-U5 implementor during its final regression.
- Problem: in a full `npm run test:e2e` run, the anonymous visitor row "cancels a pending review page when navigating to another course" (`__tests__/e2e/public.spec.ts:192`) failed at line 229: `getByRole('heading', { name: 'Làm quen với HTML', exact: true })` resolved to 3 elements (the detail page `h1` and two course-card headings, an `h2` and an `h3`), so the strict-mode `toBeVisible()` threw.
- Evidence: 2026-11-16 on `1f4d779` (branch `chore/se-u5-public-repo-readiness`): 182 passed, 1 failed. Right after, `npm run test:e2e -- public -g "cancels a pending review page" --repeat-each=5` passed 5 of 5, and a second full run passed 183/183. The log and trace were kept only in the implementor's session scratchpad, not in the repository. The cause (whether course cards of another page were still rendered when the assertion ran, or the detail page itself rendered matching card headings) is not established, and the green reruns do not resolve it.
- Direction: reproduce with repeated full runs keeping the trace of a failure, then make the row wait for a state unique to the destination page or scope the locator to the detail page's own heading, once the cause is named; do not add a retry or a longer timeout without a named cause.
- Exit condition: the cause is named and fixed, one `--repeat-each=10` invocation of `public.spec.ts` passes, and one final full `npm run test:e2e` run passes the row.

### QE-P11: a writer record whose PID a protected process reused blocks every test command

- Status: Open (2026-11-24, found during the AW-U15 final regression).
- Problem: after `npm test` passed every test, the launcher exited 1 with `Cannot read the start time of process 29652` (PowerShell `$p.StartTime` was null), and `npm run test:e2e` stopped with the same line before it started. A writer record under `C:\ProgramData\devspace-test-stack-v1\writers` names PID 29652, which Windows has since given to a protected `svchost.exe` whose start time a normal user cannot read, so the runner cannot tell the stale writer from a live one.
- Evidence: 2026-11-24, `npm test` reported 85 files and 1,406 tests passed, then the error above; `Get-CimInstance Win32_Process` shows PID 29652 as `svchost.exe` with no readable start time; the writer file `...-29652-134399894561187414.json` remained. After the Owner had it removed, the next `npm test` reset (the earlier run was unclean), passed 85 files and 1,406 tests, and failed the same way on PID 32848, a writer it registered at 10:33:20Z that Windows reused for `WmiPrvSE.exe` at 10:36:48Z; `npm run test:e2e` then stopped on the same PID before its suite. The reuse recurs within one run, so removing records does not unblock the commands.
- Direction: a QE initiative reads the creation time of a protected process another way (for example a query that needs no handle to the process), or records enough identity in a new writer record to tell a reuse apart; a record written before that change has only PID and start time, so it still needs the readable start time or the Owner's removal. While identity cannot be established, the command keeps refusing. Until then the Owner decides whether to remove the stale record or wait for the PID to be released; on 2026-11-24 the Owner had Main remove the one record of PID 29652.
- Exit condition: a recorded writer whose PID now belongs to a process with an unreadable start time no longer blocks a test command when its identity can be established, and still refuses when it cannot, both proven by unit rows (the existing reuse row covers only a readable, different identity).

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- QE-P1 — Resolved 2026-11-01: RLS teardown waits up to 10 s for registered writers before releasing ownership, and the `rls` project has a measured 15 s test timeout; guards stay fail-closed (PR 46, `3e4b941`).
- QE-P2 — Resolved 2026-11-02: tests run on a separate `devspace-test` stack under one machine-wide lock with writer records and an end-of-run audit; the ownership journal and `recover.mjs` are gone, and an interrupted run is cleaned up by the next command (PR 50, `60c369a`).
- QE-P6 — Resolved 2026-11-05: focused verification during implementation, one final full regression after whole-diff review, and retained-state repeats when the affected contract warrants them (PR 67, `3d21627`).
- QE-P5 — Resolved 2026-11-07: the lock test failed when a probe exited while PowerShell read its start time; that read now reports a vanished PID as no process, stays fail-closed for a live one and names the failure details (PR 74, `259f123`).
- QE-P8 — Resolved 2026-11-07: every fixture write of a test body, actor and service-role, is admitted right before its request, and a cleanup hook that times out marks the run unclean (PR 74, `259f123`).
