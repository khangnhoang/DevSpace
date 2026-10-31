# Future features — quality-engineering

Future initiatives retain their transferred scope and need separate approval. QE-F1 was delivered by QE-U1; no new initiative is active.

## QE-F2: Automate representative failure paths and concurrency invariants

- Status: Recorded; QE-F1 safe-fixture support was delivered in PR #42, and this item remains deferred until its own initiative is approved; transferred from BL-F7 on 2026-10-30.
- Direction: select concrete regression-worthy cases during discovery, using existing Vitest, real local database and Playwright/API helpers rather than adding a new test framework. Extend the E2E fixture to permit only explicitly expected request/status failures per test, with assertions for recovery and unchanged/persisted data; unexpected 5xx responses and external/hosted network access must still fail. Distinguish sequential retries, stale tabs and genuinely competing requests: the payment H2/K6 rows do not prove concurrent integrity. For relevant counters, reservations or state transitions, use independent requests/connections, identify the shared resource and assert the final invariant; use controlled synchronization when needed rather than claiming `Promise.all` guarantees a race. Keep normal user-flow wiring in browser E2E and endpoint/DB guarantees in integration tests where sufficient. Do not mock authorization or the database guarantee being tested. Use the existing known-bug contract for approved unresolved P5/P6/P25 cases; this entry does not authorize their product fixes. Keep real mail delivery/provider quality separate from application-side success/failure handling. Coordinate with BL-F2 and app-foundation coverage instead of duplicating those UI scenarios; no rewrite of the entire suite or blanket load/visual testing.
- Target program: quality-engineering.

## QE-F3: CI test feedback, flaky evidence and measured cost

- Status: Recorded; deferred until fixture/coverage changes settle and its own initiative is approved; transferred from BL-F8 on 2026-10-30.
- Direction: inspect representative current CI runs before choosing optimizations; report measured setup/build/test time rather than inventing savings. Give Docker-free unit tests independent feedback when local-stack setup fails, preferably using an existing lightweight job before adding jobs or changing required-check names. Define how retry-passed/flaky tests are reported and whether they fail CI; retain evidence of the first failure rather than losing the HTML report when retry makes the job green (`playwright.config.ts:16`, `.github/workflows/ci.yml:146`). Record exact-head results and distinguish passed, flaky, failed and skipped; do not increase retries to hide regressions. Preserve the base-version docs-only classifier's fail-open behavior, per-job local-stack isolation, hosted-secret restrictions, network guards and the E2E build with its own local environment. Evaluate final configuration after fixture/test changes settle; no blind build-artifact reuse, premature sharding or worker increase. CI implementation needs its own plan/review gates and explicit delivery authority; this entry only records future work.
- Target program: quality-engineering.

## Closed

- QE-F1 — Done: QE-U1 delivered scoped test-data ownership, cleanup/recovery and preflight regressions; later intermittent Windows lifecycle observations remain separately tracked as QE-P1 (PR #42)
