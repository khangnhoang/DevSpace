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

## QE-F4: Assert mail content through a local Mailpit

- Status: Recorded 2026-11-01 by the Owner; deferred until its own initiative is approved; absorbs QE-F6 (from BL-F5: local mail into the local stack's mail sink, Owner, agent-workflow U4, 2026-10-25), transferred on 2026-11-01.
- Direction:
  - Today the app sends one mail: the course activation mail from `app/action/payment.ts:293` through `lib/email.server.ts`, whose nodemailer transport is fixed to `service: "gmail"`. E2E replaces `sendMail` with a record of recipient and subject only (`__tests__/e2e/server-mail.cjs`), so no test reads the body or its link. Backlog BL-P6 and BL-P7 are both content defects that such a test would catch.
  - Make the transport configurable by environment (SMTP host and port), then point the test stack at Supabase's local mail server (`[local_smtp]`, Mailpit; disabled today in `supabase/config.toml`). E2E reads the delivered mail through Mailpit's API and asserts the recipient, the rendered name and the action link. The local mail server stays inside the network guard's local hosts.
  - Enable Mailpit only on the stack that needs it (the QE-P2 direction). Plan it when a new mail flow arrives (password reset, auth confirmations) or together with the NestJS mail module. ADR 0001 replaces the current server-action mail path, so build no mail infrastructure the migration discards.
  - From QE-F6 (BL-F5): `npm run dev` sends with Gmail placeholders, so a send fails and is only logged (`app/action/payment.ts:293` ignores the result). Route dev mail into the same local mail server (an SMTP port exposed), with the SMTP host set in `__tests__/helpers/dev-env.ts`, so a manual pass can read the mail. Hosted mail stays Gmail.
  - Real provider delivery (Gmail) stays out of scope, as QE-F2 says.
- Target program: quality-engineering.

## Closed

- QE-F5 — Done: QE-U3 runs `rls` and `e2e` on a separate `devspace-test` stack (ports 55320–55329) that the test commands start, check and reset, beside the dev stack (PR #50)
- QE-F6 — Dropped: transferred from BL-F5 on 2026-11-01 and consolidated into QE-F4, which carries its dev-mail direction

- QE-F1 — Done: QE-U1 delivered scoped test-data ownership, cleanup/recovery and preflight regressions; later intermittent Windows lifecycle observations remain separately tracked as QE-P1 (PR #42)
