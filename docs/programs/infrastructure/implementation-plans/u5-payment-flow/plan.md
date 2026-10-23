# U5 detail plan — Payment-flow tests

Revision: r1, 2026-10-24. Owner approval: 2026-10-24. Master plan: [plan.md](../../plan.md) (unit U5, outcome 5, decisions D6 to D9; rollout order step 4).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: Playwright tests describe the current payment and coupon flow end to end against the local stack: a learner buys the paid course, applies coupons and cancels, and an admin approves and rejects orders. The tests drive the UI for the normal paths and post straight to the server action endpoints for the hostile paths. P5, P6 and P25 run as known bugs whose assertions state the behavior that `security-hotfix` H2-2b will deliver, so H2-2b can start with tests that turn green when it is done.

| ID | Observable result |
| --- | --- |
| AC1 | On the Owner's machine, after `npx supabase start` and `npx supabase db reset`, `npm run test:e2e` runs every Appendix A row and every U4 row and exits 0. Running it a second time with no reset in between also exits 0, and `npm test` run right after it also exits 0. |
| AC2 | Every UI row of Appendix A (PF, AP) passes through the pages the product uses: `/course/javascript-can-ban`, its payment modal, and `/admin/transactions` with its confirm dialogs. Each row reads the persisted result back through the service role. |
| AC3 | Each direct row of Appendix A (H, and the direct K rows) posts to the real endpoint of the server action. The action ID comes from the server reference manifest of the build under test, looked up by source file and export name; IDs are never hard-coded. The request carries the actor's saved session (or none for anon) and the e2e server's origin. When a file and export pair is missing from the manifest, or the response cannot be read, the test fails with a message naming the pair; there is no fallback. A unit test covers the manifest lookup and the response reader offline, from a fixture manifest and a captured response. |
| AC4 | P5, P6 and P25 (Appendix B) run through a Playwright form of `knownBug` that keeps the U3 contract: while the bug exists the test passes and the run prints `known bug <id>`; when the bug's assertion holds the test fails with "`<id>` no longer reproduces"; a failed precondition, sign-in, network error or thrown error fails the test. A test shows all three outcomes with the error that Playwright's own `expect` throws (a unit test, or a self-test in the Playwright suite if that `expect` needs a running test). The Vitest `knownBug` and its unit test keep passing. |
| AC5 | The `next start` process of the e2e run can neither resolve a name nor open a network connection for any host but `127.0.0.1`, `localhost` or `::1`. Each refused resolution or connection is recorded, and a test during which the server recorded one fails. A unit test, run in child Node processes without network, shows: a connection to `127.0.0.1` is allowed; a connection to `smtp.gmail.com` is refused and recorded; and with the mail record off, a `nodemailer` send through `service: "gmail"` (which resolves the name with `dns.Resolver` before it opens a socket) is refused and recorded. The `next build` step is not guarded (it downloads the Google font). |
| AC6 | In the e2e server, every mail that `lib/email.server.ts` sends is recorded with its recipient and subject instead of going to Gmail. AP1 shows exactly one recorded mail to `learner@devspace.test` whose subject names "JavaScript căn bản". No row records a mail except the rows that approve: AP1, AP3, K6, K8, and the K7 setup. |
| AC7 | Every row that writes asserts its preconditions first (the learner has no payment and no enrollment in course 2; `LOCAL10` has `used_count` 0) and restores them in `afterEach` through the service role, even when it fails: the payments it created, the learner's course 2 enrollment, the coupons it created and `LOCAL10.used_count`. After a full run, `payments` holds only seed payment 1, `coupons` holds only `LOCAL10` with `used_count` 0, and the learner has no enrollment. |
| AC8 | Seed payment 1 has status `success`, a value the app writes, instead of `approved`. The U3 row `[E5]` expects `success`; `[A1]` still passes. |
| AC9 | `test-quality-strategy` describes the server action tests: the direct-call helper, the server guard, the mail record, the Playwright `knownBug`, and the write and cleanup rules. `CLAUDE.md` Commands and `code-review` `references/domain-dimensions.md` stop saying there are no server action tests. `grep -rn -i "no server action tests\|server action tests (infrastructure U5)\|not a server action test" CLAUDE.md .claude docs/agent-loops.md` finds nothing outside `.claude/skills/playwright-cli/`. |
| AC10 | No product behavior changes: `git diff 34b80d9 -- app lib proxy.ts next.config.ts .github` is empty, and `git diff 34b80d9 -- supabase` touches only the payment 1 status in `supabase/seed.sql`. `npx tsc --noEmit` exits 0, `npm run lint` still reports 82 problems, and every CI job passes on the PR. |

### 1.2 Scope and non-goals

- In scope (implementor): the direct-call helper and its unit test; the server guard and mail record loaded only into `next start`, with its unit test; the Playwright `knownBug` adapter and its unit test; the Appendix A specs and their cleanup helpers; the seed status change and `[E5]`; `.gitignore` entries for the guard and mail files; the doc edits in AC9.
- In scope (Main): the CP4 mutation check; P30 in `security-hotfix/problems.md` (found while planning, section 2); the state records; after merge, the `security-hotfix` State line that H2-2b is unblocked.
- Non-goals: fixing P5, P6, P25 or P30, or any product code; concurrency rows (two parallel applies, approve against cancel), which need the H2-2b RPCs; the H2-2b matrix itself; rows for `getAllPayments` beyond what AP rows read; a new CI job; Gemini or real mail delivery; changing the U4 rows; any change to the required checks (`e2e` is already required).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The service role only prepares fixtures, reads state back and cleans up. Every request under test runs as the actor, through the UI or the direct-call helper with that actor's saved session. | A row passes because the service role bypassed `requireUser` or `requireAdmin`. |
| G2. The guard and the mail record load only into `next start`, through the server process's environment; `next build` runs without them. The guard allows only loopback hosts. | The build fails to download its font, or the guard lets an outbound call through. |
| G3. The mail record replaces only the transport that `lib/email.server.ts` creates; `approvePayment` and `sendSuccessEmail` run unchanged. If the record cannot hook the transport, the guard still refuses the SMTP name resolution or connection, records it, and AC5 fails the row. | A row reaches Gmail with placeholder credentials, or passes while no mail code ran. |
| G4. A known-bug assertion states the behavior from `plan-h2.md` (B12 and section 4.4), wraps exactly one assertion on persisted state or recorded mail, never on message text that H2-2b may reword. A precondition that only holds while the bug exists is never a plain `expect`. | The test keeps passing after H2-2b fixes the bug, or it fails for a wording change instead of reporting the fix. |
| G5. Rows assert their preconditions, clean up in `afterEach` and do not depend on file order or on another row's writes. Mail and guard records are read from the point a row starts. | The second run, or `npm test` after it (`[E5]` counts one payment, `[E7]` one coupon), fails; one row's mail is counted by another. |
| G6. Rows wait on the action's response, a toast or the persisted state with Playwright's auto-waiting, never a fixed sleep. Confirm dialogs are accepted by an explicit handler. | Flaky rows (the modal's 1.5 s delay, the toast promise on approve). |
| G7. A surprising behavior found while writing a row is not encoded as expected; it goes to Main for `problems.md` (as P30 did). | A test freezes an unknown bug as correct (master plan risk). |
| G8. A payment in any state but a new pending order is reached through the actions as the right actor (`createPendingPayment`, `cancelPayment`, `approvePayment`), never by a service-role insert or update of `payments`. Cleanup deletes payments before coupons. | The rows break at setup once H2-2b's `payments_guard` refuses direct payment writes and its `coupon_id` foreign key refuses deleting a used coupon, instead of reporting the fix. |
| G9. No file under `app`, `lib`, `.github` or `supabase/migrations` changes, nor `proxy.ts` or `next.config.ts`. | An infrastructure PR hides a behavior change (shared invariant 4). |

### 1.4 Owner decisions that bind this unit

- D6: the seed stays invented and minimal. D7: no hosted secret; mail and Gemini are not called. D8: characterization tests with P5, P6, P25 as known bugs, not fixed here. D9: the skills and `CLAUDE.md` change in this PR.
- D24 (2026-10-24, new, binds this unit only): the UI drives the normal paths; the hostile paths and the known bugs that the UI cannot reach post straight to the server action endpoint, with the action ID read from the build's manifest and the actor's saved session.
- D25 (2026-10-24, new, binds this unit only): the e2e server gets a network guard that refuses every non-loopback connection, and a mail record that counts what the app sends, so P25's second mail is observable. No product code changes.
- D26 (2026-10-24, new, binds this unit only): coupon fixtures (inactive, exhausted, unlimited) are created by the rows that need them and removed afterwards; the seed keeps one coupon.
- D27 (2026-10-24, new, binds this unit only): the U5 rows run in the existing `e2e` job; no new CI job and no new required check. This narrows master plan rollout step 4 ("each adding its CI job") for U5.

## 2. Repository facts

Baseline: `34b80d9`, checked 2026-10-24.

- `app/action/payment.ts` (service role at module scope):
  - `createPendingPayment(courseId, couponCode = null)` returns an existing pending order unchanged with `isResumed: true`. Otherwise it creates one at the course price. With a coupon code it discounts and calls the missing RPC `increment_coupon_usage` (no migration defines it), ignoring the error (P5).
  - `updatePaymentWithCoupon` checks owner and `pending`, rejects an inactive or exhausted code, and sets the rounded amount. It does not count usage (P6).
  - `cancelPayment` sets `failed` only for the caller's pending order.
  - `approvePayment` and `rejectPayment` update by `id` alone (P25). `approvePayment` then inserts the enrollment with its error ignored, and calls `sendSuccessEmail`. It inserts no notification.
  - `createPendingPayment` never checks for an existing enrollment (P30, new).

  This justifies Appendix A and B.
- The course page shows "Mua khóa học ngay" for a paid course and "Đang chờ duyệt thanh toán..." with a pending order. The modal has "Áp dụng", "Tôi đã thanh toán" (a 1.5 s fake delay, no server call) and "Hủy bỏ"; its close button also calls `cancelPayment`. `/admin/transactions` shows "Duyệt" and the reject button only for pending orders, behind `confirm()`. Its toasts: "Duyệt đơn thành công!", "Đã hủy đơn hàng". This justifies the UI rows, G6 and the stale-tab K6 row.
- `lib/email.server.ts` creates a `nodemailer` transport with `service: "gmail"` at module scope and catches send errors. The local build's server chunk references `nodemailer` by name. `GMAIL_USER` and `GMAIL_PASS` are placeholders in the e2e environment. This justifies AC5, AC6, D25 and G3.
- `app/layout.tsx` and `app/(main)/layout.tsx` use `next/font/google`, which `next build` downloads. `playwright.config.ts` runs `npx next build && npx next start` as one `webServer` command with one environment. The U4 network guard covers browser requests only. This justifies G2.
- `.next/server/server-reference-manifest.json` of a local build lists 15 actions, each with `filename`, `exportedName` and its page worker. The payment actions sit in `app/(main)/course/[slug]/page` and `app/admin/transactions/page`. This justifies AC3.
- `__tests__/helpers/known-bug.ts` imports `it` from `vitest` at module scope. `runKnownBug` counts an error as an assertion failure only when its `name` is `"AssertionError"`. This justifies AC4.
- The seed has `LOCAL10` (10 %, `max_uses` 100, `used_count` 0) and payment 1 (the student, course 2, 199000, status `approved`). The app writes only `pending`, `success` and `failed`, and the transactions page shows a status badge only for those three. `[E5]` asserts one payment and status `approved`, and `[E7]` asserts one coupon. `payments` has no `coupon_id` column and no status constraint. This justifies AC7, AC8, D26 and G5.
- `security-hotfix` `plan-h2.md` B12 and section 4.4 define the fixed behavior: a successful apply counts one use; `createPendingPayment` drops its coupon parameter; approve and reject act only on pending orders and send no second mail. This justifies G4 and Appendix B.
- Required checks on `main` are `typecheck`, `build`, `docs`, `db` and `e2e` (the Owner added `e2e` on 2026-10-24). This justifies D27: a U5 row that fails blocks the merge without a new check.
- Stale text: `CLAUDE.md:16` ("There are no server action tests yet"), `test-quality-strategy` `SKILL.md:12` and its e2e section ("it is not a server action test", "a smoke row writes nothing"), and `code-review` `references/domain-dimensions.md:19`. This justifies AC9.

## 3. Bounded implementation hypotheses

- `scripts/e2e/serve.mjs` becomes the `webServer` command. It runs `next build` with the U4 environment, then `next start` with the same environment plus `NODE_OPTIONS=--require <guard>` and the paths of the guard and mail files under an ignored `__tests__/e2e/.server/`. It may change if G2 and AC5 hold.
- `__tests__/e2e/server-guard.cjs` wraps `dns.lookup`, the `dns.Resolver` and `dns.resolve*` methods with their `dns.promises` forms, and `net.Socket.prototype.connect`, refusing non-loopback names before any query or socket, and appends `{ host, port, time }` to the guard file. It also hooks `Module._load` for `nodemailer` so that `createTransport` returns a transport whose `sendMail` appends `{ to, subject, time }` to the mail file. If `nodemailer` turns out to be bundled rather than loaded by name, the mail record may hook a different point, provided G3 holds. The fixture in `fixtures.ts` reads both files from the row's start and fails the row on a guard entry (AC5).
- `__tests__/e2e/server-action.ts` reads the manifest from `.next`, maps the worker to a URL (`/course/javascript-can-ban`, `/admin/transactions`), and posts JSON arguments with `Next-Action`, `Accept: text/x-component` and `Origin`, using a request context built from the actor's storage state. A pure reader in `__tests__/helpers/` returns the action's result from the flight response or reports a redirect. The unit test is `__tests__/unit/server-action.test.ts`. It may change if AC3 holds.
- `runKnownBug` moves to a module that imports no test runner, and its error test also accepts Playwright's expect error. `knownBug` (Vitest) and a new `knownBugE2e` (Playwright, `test.info().annotations` plus `console.info`) wrap it. It may change if AC4 holds and the U3 known-bug rows keep their output.
- Specs: `payment-learner.spec.ts` (PF, H and the learner K rows) and `payment-admin.spec.ts` (AP and the admin K rows). Cleanup helpers join `service-role.ts`. They may change if G1 and G5 hold.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 (Sonnet) | The serve entry, server guard and mail record; the direct-call helper with its reader; the runner-neutral `runKnownBug` and `knownBugE2e`; their unit tests; `.gitignore` entries (AC3 to AC5, G2, G3). | `npm run test:unit` exits 0 and includes the guard, reader and known-bug tests. `npx supabase db reset`, then `npm run test:e2e` passes all U4 rows with the guard on and the guard file empty. A probe from a throwaway spec (not committed) shows an anon direct call to `createPendingPayment` returning the "Bạn chưa đăng nhập" error. `grep -rnE "dotenv|loadEnvConfig|readFileSync\([^)]*\.env" __tests__ scripts/e2e playwright.config.ts` finds nothing. `npx tsc --noEmit` exits 0. `npm run lint` reports 82 problems. |
| CP2 (Sonnet) | Every Appendix A row with its cleanup, the seed status and `[E5]` (AC1, AC2, AC6 to AC8, G1, G4 to G8). | `npx supabase db reset`, then `npm run test:e2e` twice and `npm test` once, all exit 0. The Playwright output lists `known bug P5`, `P6` and `P25` for each Appendix B row. Then `psql` on `127.0.0.1:54322` shows only payment 1, only `LOCAL10` with `used_count` 0, and no learner enrollment. `git status --short` shows no guard, mail, session or report file. tsc and lint as in CP1. |
| CP3 (Sonnet) | The doc edits (AC9). | The AC9 grep. `npm run docs:check` and `npm run docs:check:test` pass. `git diff --check`. |
| CP4 (Main) | Review of CP1 to CP3 and a mutation check. | On the local stack only, one throwaway change at a time with `psql`, each followed by `npm run test:e2e` and then `npx supabase db reset` (also when the run fails), and each failure confirmed at the target assertion: `LOCAL10.discount_percent` set to 20 fails PF3 on the amount; the admin's role set to `user` fails the AP rows; a local trigger that refuses a `payments.status` change away from a non-pending status makes K7 and K8 fail with "no longer reproduces". Then the Codex diff gate on CP1 to CP3. |
| CP5 (Main, on the PR) | AC10 observed in CI; state records updated. | `gh pr checks <n>` shows every job and Vercel. The `e2e` log shows every row and the `known bug` lines. The lint step shows 82 problems. `npm run docs:check` passes. |

The implementor does CP1 to CP3 as local commits, one per checkpoint after its self-review passes, and edits no state record. The Codex gate runs on this plan and on the CP1 to CP3 diff before push. Commit, push, PR and merge are separate grants.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The action endpoint format (headers, flight response) is internal to Next and changes with an update. | `next` is pinned at 16.4.3. The reader has a unit test from a captured response, and AC3 fails loudly on a mismatch. A Next update runs the suite under FEAT-001. |
| Next refuses the direct POST (origin check, missing router-state header). | CP1's anon probe proves the call shape before any row depends on it. |
| The guard blocks the server's own Supabase calls (IPv6 `::1`, a `localhost` name). | Loopback names and addresses are allowed. CP1 reruns all U4 rows with the guard on. |
| A killed run leaves orders, coupons or an enrollment behind, and `[E5]`, `[E7]` or `[L2]` fail next. | Preconditions fail first with a message naming the leftover rows. `test-quality-strategy` says to run `db reset` after a killed run. |
| The stale-tab K6 row is flaky. | It waits on the second tab's table row and on the action response. K7 and K8 cover P25 without a second tab. |
| A row exposes a new bug. | G7 and the stop rule: Main records it; the row is not weakened. |

- Rollout runbook (Owner or hosted steps, in order): none for U5. After merge, Main updates the `security-hotfix` State: H2-2b can start once the Owner grants it.
- Stop when:
  - a row needs a hosted URL, a secret, real mail or a product code change to pass;
  - the direct call cannot reach an action without a change under `app` or `next.config.ts`;
  - the mail record cannot observe a send and the guard is the only signal;
  - a row's real behavior contradicts Appendix A or B.
- Rollback: revert the PR. Nothing hosted changes.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

## Appendix A: payment-flow matrix

Seed: `learner` (no orders, no enrollment), `student` (paid order 1, enrolled in course 2), `admin`; course 2 `javascript-can-ban` at 199000; `LOCAL10` (10 %). "Direct" means the AC3 helper. Every row also passes the U4 network checks and AC5.

| # | Actor | Action | Expected |
| --- | --- | --- | --- |
| PF1 | learner | on `/course/javascript-can-ban` press "Mua khóa học ngay" | the modal shows the course name and the full price; one pending order of 199000 exists |
| PF2 | learner | after PF1, reload the page | the button reads "Đang chờ duyệt thanh toán..." and is disabled; still one pending order |
| PF3 | learner | in the modal apply `LOCAL10` | the modal shows the discounted price; the order amount is 179100 |
| PF4 | learner | apply an unknown code | "Mã giảm giá không tồn tại hoặc đã hết hạn"; amount 199000 |
| PF5 | learner | apply an inactive code (fixture) | the same message; amount 199000 |
| PF6 | learner | apply an exhausted code (fixture, `used_count` = `max_uses`) | "Mã này đã hết lượt sử dụng"; amount 199000 |
| PF7 | learner | apply a code with `max_uses` null (fixture) | applied; the amount is discounted |
| PF8 | learner | press "Hủy bỏ" | "Đã hủy giao dịch"; the order is `failed` |
| PF9 | learner | press "Tôi đã thanh toán" | "Đã gửi xác nhận thanh toán!"; the modal closes; the order stays `pending` |
| AP1 | admin | on `/admin/transactions` approve the learner's pending order | "Duyệt đơn thành công!"; the order is `success`; the learner is enrolled in course 2 and then sees lesson 3's text; one mail to the learner (AC6) |
| AP2 | admin | reject the learner's pending order | "Đã hủy đơn hàng"; the order is `failed`; no enrollment; no mail |
| AP3 | admin | approve the learner's order discounted with `LOCAL10` | the order is `success` at 179100; `LOCAL10.used_count` is unchanged |
| H1 | anon | direct `createPendingPayment(2)` | "Bạn chưa đăng nhập"; no order |
| H2 | learner | direct `createPendingPayment(2)` twice | the same order id, the second with `isResumed`; one pending order |
| H3 | learner | direct `updatePaymentWithCoupon` on the admin's pending order (the admin's direct `createPendingPayment(2)`) | "Đơn hàng không hợp lệ"; that order is unchanged |
| H4 | learner | direct `cancelPayment` on the admin's pending order | "Không thể hủy giao dịch này"; it stays `pending` |
| H5 | learner | direct `approvePayment` and `rejectPayment` on their own pending order | refused; it stays `pending`; no enrollment; no mail |
| H6 | learner | direct `updatePaymentWithCoupon` on their own order cancelled by a direct `cancelPayment` | "Đơn hàng không hợp lệ"; amount unchanged |
| H7 | learner | direct `createPendingPayment(9999)` | "Khóa học không tồn tại"; no order |

## Appendix B: known bugs

Each row's plain `expect`s hold before and after H2-2b; only the `bug(...)` assertion changes outcome.

| # | Bug | Setup and request | Plain expects | `bug(...)` asserts (fixed behavior) |
| --- | --- | --- | --- | --- |
| K4 | P6 | the learner's pending order at full price (direct `createPendingPayment(2)`); direct `updatePaymentWithCoupon(id, "LOCAL10")` | the order amount is 179100 | `LOCAL10.used_count` is 1 |
| K5 | P5 | direct `createPendingPayment(2, "LOCAL10")` as the learner | one pending order of the learner for course 2 exists | its amount is 199000 (the coupon parameter is ignored) |
| K6 | P25 | two admin tabs on `/admin/transactions` with the learner's pending order; approve in the first, then in the second | the first approve recorded one mail; the second approve request got a response | the mails to the learner still number 1 |
| K7 | P25 | the learner's order approved by the admin's direct `approvePayment` (its setup mail is expected); direct `rejectPayment` as admin | the response arrived | the order is still `success` |
| K8 | P25 | the learner's order cancelled by their direct `cancelPayment`; direct `approvePayment` as admin | the learner had no course 2 enrollment before | the order is still `failed` |
