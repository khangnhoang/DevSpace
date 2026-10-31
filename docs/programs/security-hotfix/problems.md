# Problems, risks and follow-ups — security-hotfix

Plans: [H1](plan.md), [H2](plan-h2.md), [SH-P3 community write integrity](implementation-plans/sh-p3-community-write-integrity/plan.md). Progress: [progress.md](progress.md).

The original 2026-10-21 discovery table is preserved in Git at ddcefd0. Legacy IDs below are provenance; file-qualified mappings in scripts/docs/work-id-mappings.json resolve every old declaration. Discovery-era scheduling is historical; current State and delivery evidence live in progress.md. The Owner approved conversion of all 32 declarations on 2026-10-31, including closed forms, without changing historical plans or published SQL.

## Open

### SH-P3: Review INSERT allows impersonation

- Status: Fixed locally, awaiting delivery; local regression/replay verification passed, independent implementation review and hosted rollout pending.
- Problem: The `reviews` INSERT policy only checks enrollment and does not constrain `user_id = auth.uid()` → a review impersonating someone else.
- Evidence: Legacy P3; severity Medium; discovery-era Planned: **H2**; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Implement H2-2a under the [SH-P3 entry plan](implementation-plans/sh-p3-community-write-integrity/plan.md), together with SH-P4 (historical H2 B10/B11).
- Exit condition: Allowed own enrolled INSERT/UPDATE/upsert and denied anon, unenrolled and impersonated writes pass with persisted readbacks; reviewed migration is delivered and hosted postflight is complete.

### SH-P4: Comment ownership and lesson identity can change

- Status: Fixed locally, awaiting delivery; local regression/replay verification passed, independent implementation review and hosted rollout pending.
- Problem: The `comments` UPDATE policy has no `with_check` → the comment owner can move their comment to another lesson (`lesson_id`); handing it to another `user_id` is blocked, since the check reuses `USING` (infrastructure U3 known-bug test K2).
- Evidence: Legacy P4; severity Low; discovery-era Planned: **H2**; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Implement H2-2a under the [SH-P3 entry plan](implementation-plans/sh-p3-community-write-integrity/plan.md): explicit WITH CHECK plus immutable user_id/lesson_id trigger, retaining admin soft-delete.
- Exit condition: Owner content edits and admin soft-delete succeed; owner, admin JWT and local service_role cannot reassign either identity column; exact rollback is verified and delivery/hosted postflight complete.

### SH-P5: Coupon usage RPC is missing

- Status: Deferred.
- Problem: The code calls the RPC `increment_coupon_usage` but the function does not exist in the DB → coupon usage never increases.
- Evidence: Legacy P5; severity Medium; discovery-era Planned: H2 or later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Deferred to H2-2b; preserve the original H2-or-later scope and the H2 reservation design, together with SH-P6 and SH-P25.
- Exit condition: The approved coupon reservation path exists and usage changes correctly through the supported actions.

### SH-P6: Coupon usage is counted inconsistently

- Status: Deferred.
- Problem: A coupon is counted when the pending order is created, while `updatePaymentWithCoupon` does not count → inconsistent usage logic.
- Evidence: Legacy P6; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Deferred to H2-2b under the approved H2 reservation design; original scheduling was later.
- Exit condition: Coupon application, switch, cancellation, rejection and approval maintain the approved reservation invariant.

### SH-P7: Server components use an anon client

- Status: Deferred.
- Problem: Server components read data with the anon client, not per user.
- Evidence: Legacy P7; severity Low; discovery-era Planned: techstack-migration (out of scope for `infrastructure`, its plan section 7); preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Handle in techstack-migration, outside infrastructure (its historical plan section 7); H2-1 fixed only the learn/quiz/layout paths.
- Exit condition: Remaining server reads use the intended caller context under the migration contract.

### SH-P8: Auth flow migration follow-up

- Status: Deferred.
- Problem: Historical finding pending revalidation: Auth uses the implicit flow; should move to PKCE.
- Evidence: Legacy P8; severity Low; discovery-era Planned: migration; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0. The historical H1 plan section 4.2 describes PKCE; this conversion does not revalidate Auth behavior or establish closure of the older record.
- Direction: Retain the original migration follow-up; no new Auth implementation or claim of completion is made here.
- Exit condition: The migration follow-up verifies the intended Auth flow and its compatibility.

### SH-P9: Leaked password protection is disabled

- Status: Open (Owner action).
- Problem: Leaked password protection is off (Auth settings).
- Evidence: Legacy P9; severity Low; discovery-era Planned: Owner turns it on in the dashboard; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: The Owner turns on leaked password protection in the Auth dashboard.
- Exit condition: The Owner confirms leaked password protection is enabled.

### SH-P10: Avatar uploads do not enforce path ownership

- Status: Deferred.
- Problem: Bucket `avatars`: any signed-in user can upload to any path.
- Evidence: Legacy P10; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Later work must enforce caller ownership of avatar upload paths.
- Exit condition: One signed-in user cannot write another user’s avatar path.

### SH-P11: GraphQL exposes tables to anon and authenticated

- Status: Deferred.
- Problem: pg_graphql exposes every table to anon/authenticated (advisor 0026/0027).
- Evidence: Legacy P11; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Later work must review the GraphQL exposure and advisor 0026/0027 findings.
- Exit condition: GraphQL exposure and grants match the intended access model and the advisor findings are addressed.

### SH-P14: Email links depend on the requesting browser

- Status: Deferred.
- Problem: Email links open only in the browser that requested them (PKCE); should move to `token_hash` + `verifyOtp` through a server route.
- Evidence: Legacy P14; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Later work moves email links to token_hash plus verifyOtp through a server route; include SH-P18.
- Exit condition: Confirmation/recovery links work through the intended server route without depending on the originating browser.

### SH-P15: Transactions show anonymous learner names

- Status: Deferred.
- Problem: `/admin/transactions` shows every learner as "Ẩn danh": the page reads `p.profiles?.full_name` (`app/admin/transactions/page.tsx:148`) but `getAllPayments` returns `users`. The bug predates H1 (found during H1 QA).
- Evidence: Legacy P15; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Later work reconciles the transactions page profile lookup with the users returned by getAllPayments.
- Exit condition: Transactions display the correct learner name from the returned relation.

### SH-P16: Empty birth dates break profile updates

- Status: Deferred.
- Problem: Updating a profile with an empty date of birth → `invalid input syntax for type date: ""` (the form sends an empty string instead of `null`). The bug predates H1.
- Evidence: Legacy P16; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Follow the existing [AF-P4](../app-foundation/problems.md#af-p4-saving-a-profile-without-a-date-of-birth-fails) record, owned by AF-U3: its profile schema turns blank optional fields into null and its E2E row saves a profile without a date of birth. This historical SH record adds no independent task or ownership transfer; H2 production check 17g remains recorded as failed on the same older bug.
- Exit condition: Updating a profile with an empty date of birth succeeds and stores null.

### SH-P18: Confirmation without a code verifier shows an error

- Status: Deferred.
- Problem: Opening the signup confirmation link in a browser/tab without the code verifier → the `/auth/error` page, even though the email is confirmed and sign-in works. The root cause is P14.
- Evidence: Legacy P18; severity Low; discovery-era Planned: with P14; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Handle with SH-P14, the recorded root cause.
- Exit condition: A valid confirmation link opened without the original verifier completes with correct feedback.

### SH-P19: Auth locks can stall multiple local tabs

- Status: Open (monitor).
- Problem: Several `localhost` tabs open: `supabase-js` shares `navigator.locks`, auth operations wait on the lock forever → one stuck tab makes the other tabs spin on sign-in. Closing all tabs fixes it. Library behavior, not caused by H1.
- Evidence: Legacy P19; severity Low; discovery-era Planned: monitor; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Monitor the library behavior; closing all localhost tabs is the recorded workaround, not a permanent fix.
- Exit condition: The multi-tab lock problem is resolved or the Owner accepts a documented library-level limitation.

### SH-P20: Quiz results and completion are not stored

- Status: Deferred.
- Problem: Quiz results are not stored (no table), the UI does not mark a quiz as completed like a lesson; re-entering means starting over.
- Evidence: Legacy P20; severity Medium; discovery-era Planned: future-features; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Retain as future-feature work for quiz persistence/completion; handle server grading with SH-P26.
- Exit condition: Quiz results persist and completion remains visible on re-entry.

### SH-P22: Course review avatars have an extra gradient

- Status: Deferred.
- Problem: The avatar in the course review section has a strange extra gradient background.
- Evidence: Legacy P22; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Later UI work reviews the extra gradient in the course review avatar.
- Exit condition: The unintended review-avatar gradient is removed and visually checked.

### SH-P23: Notifications lack an explicit per-item read button

- Status: Deferred.
- Problem: Notifications: there is no mark-as-read button per notification (you must click the notification itself), only a button for all.
- Evidence: Legacy P23; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Later work adds an explicit per-notification mark-as-read action alongside the existing interactions.
- Exit condition: Each notification can be explicitly marked as read while existing all/read-on-click actions remain functional.

### SH-P24: AI quiz creation needs a valid Gemini key

- Status: Open (Owner action).
- Problem: AI quiz creation does not run: `GEMINI_API_KEY` has expired. The Owner's job (issue a new key); includes the audit item of merging the 2 Gemini SDKs.
- Evidence: Legacy P24; severity Low; discovery-era Planned: Owner; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: The Owner supplies a renewed key; retain the related audit work to consolidate the two Gemini SDKs.
- Exit condition: The Owner verifies real AI quiz generation with a valid key and the related SDK audit work is accounted for.

### SH-P25: Order approval and rejection are not atomic

- Status: Deferred.
- Problem: `approvePayment`/`rejectPayment` UPDATE only by `id`, not filtering `status = 'pending'` → approving again an order that was already processed, sending the email again; the enrollment is created by a separate request and its error is ignored.
- Evidence: Legacy P25; severity Low; discovery-era Planned: **H2-2**; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Deferred to H2-2b: atomic approval/rejection, enrollment creation and side effects under the existing plan.
- Exit condition: Repeated approval/rejection is denied, enrollment persists atomically and email is sent only for the winning transition.

### SH-P26: Quiz answers are sent to the client

- Status: Deferred.
- Problem: The quiz is graded on the client, an enrolled user receives `correct_answer` in the payload.
- Evidence: Legacy P26; severity Low; discovery-era Planned: with P20 (grade on the server); preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Handle with SH-P20; grade on the server rather than exposing correct_answer to the enrolled client.
- Exit condition: Grading happens on the server and the client payload does not disclose correct answers before grading.

### SH-P27: Comments expose deleted content and lack enrollment checks

- Status: Deferred.
- Problem: The content of a soft-deleted comment is still readable through REST; a user who has not enrolled can still read/write comments on a paid lesson.
- Evidence: Legacy P27; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Later work addresses both deleted-content visibility and enrollment checks; excluded from H2-2a.
- Exit condition: Deleted comment content is protected and paid-lesson comment access enforces the approved enrollment rules.

### SH-P28: Users can change their profile email

- Status: Deferred.
- Problem: A user can edit the `email` column in `profiles` themselves (system email is sent to this column).
- Evidence: Legacy P28; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Later work protects the profile email used for system mail; excluded from H2-2a.
- Exit condition: A client cannot independently change the profile email used for system mail.

### SH-P29: Purchased courses without progress are hidden

- Status: Deferred.
- Problem: "Khóa học của tôi" at `/profile` shows only courses with ≥ 1 completed lesson (`getUserDashboardData` filters `isStarted`) → a user who bought a course but has not finished any lesson sees "Bạn chưa tham gia khóa học nào". The bug predates H2 (found during H2-1 QA).
- Evidence: Legacy P29; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Later work shows purchased courses before the first completed lesson.
- Exit condition: A newly purchased course appears in the profile before any completed lesson.

### SH-P30: An enrolled user can create another pending order

- Status: Deferred.
- Problem: `createPendingPayment` (`app/action/payment.ts:72`) never checks for an existing enrollment, so a direct call by an enrolled user creates a pending order for a course they already own; the UI hides the buy button, but the action is a public POST endpoint. Found while planning infrastructure U5 (2026-10-24); U5 does not encode it.
- Evidence: Legacy P30; severity Low; discovery-era Planned: with H2-2b; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Handle with H2-2b; infrastructure U5 did not encode this case.
- Exit condition: A direct createPendingPayment call by an already enrolled user cannot create a redundant pending order.

### SH-P31: Unlimited coupons fail in direct pending-order creation

- Status: Deferred.
- Problem: `createPendingPayment` applies a coupon only when `coupon.used_count < coupon.max_uses` (`app/action/payment.ts:122`), so a code without a use limit (`max_uses` null) gives no discount there, while `updatePaymentWithCoupon` treats null as unlimited and applies it (infrastructure U5 row PF7). The UI never sends a code to `createPendingPayment` (P5), so only a direct call sees it. Found while implementing infrastructure U5 (2026-10-24); U5 does not encode it.
- Evidence: Legacy P31; severity Low; discovery-era Planned: with H2-2b; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Handle with H2-2b; retain the direct-call distinction and infrastructure U5 PF7 evidence (U5 did not encode this case).
- Exit condition: An unlimited coupon is handled consistently in direct createPendingPayment and updatePaymentWithCoupon calls.

### SH-P32: Legacy security problem records need canonical shape

- Status: Fixed locally, awaiting delivery (documentation preparation only; independent review and correction-plan commit pending).
- Problem: Historical AW-003 debt: this file kept the P1-P31 table and `scripts/docs/check-structure.mjs` allowlisted it for `problems-shape`; it was the only program problems file outside the open-entry shape. The original direction was to reshape it when H2-2a or H2-2b reopened, keeping every ID and removing the problems allowlist entry while `plan-h2.md` stayed allowlisted. Moved from `agent-workflow` on 2026-10-22; the Owner's 2026-10-31 canonical-ID decision supersedes retaining legacy declaration forms while preserving their provenance.
- Evidence: Legacy AW-003; severity Low; discovery-era Planned: with H2-2; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above). Originally moved from agent-workflow on 2026-10-22; canonical conversion approved on 2026-10-31.
- Direction: Complete the Owner-approved canonical conversion with H2-2a, remove only the obsolete problems-shape exception and exact legacy problem-row exceptions, and retain both historical plan exceptions. Preserve the agent-workflow AW-003 mapping chain; no program transfer or history rewrite.
- Exit condition: All 32 entries have unique canonical destinations, scope/status/history and mapping provenance survive, checker regressions pass, and the delivering PR merges.

## Resolved

One line each: ID, status, historical problem and delivered outcome. Details stay in Git.

- SH-P1 — Resolved 2026-10-22: H2-1 restricted profile PII reads. Historical problem: `profiles` SELECT `true` for `public`: anon can read the email, phone, dob, gender, province of everyone. Legacy P1; severity High; discovery-era Planned: **H2** (PR 3, `36056ec`; PR 4, `5ae5943`; H2 production matrix).
- SH-P2 — Resolved 2026-10-22: H2-1 restricted coupon reads and moved validation to the server. Historical problem: `coupons` SELECT `true` for `public`: every code can be listed; `CoursePaymentModal` checks the coupon on the client. Legacy P2; severity Medium; discovery-era Planned: **H2** (PR 3, `36056ec`; H2 production matrix).
- SH-P12 — Resolved 2026-10-21: H1 removed the fixed admin-created password. Historical problem: Fixed password `123123` when an admin creates a user — moved into H1 per Codex review round 1. Legacy P12; severity High; discovery-era Planned: H1 (PR 2, `5c842d4`).
- SH-P13 — Resolved 2026-10-22: H2-1 restricted paid lesson/quiz reads and guarded server rendering. Historical problem: Paid lesson/quiz content readable without enrolling: RLS `lessons`/`exercises` SELECT `true`; the learn page queries every lesson on the server and checks enrollment on the client (`LearnClient.tsx`) after the data is already in the RSC payload. Legacy P13; severity High; discovery-era Planned: **H2** (Owner: split into H2-1/H2-2 if large) (PR 3, `36056ec`; PR 4, `5ae5943`; H2 production matrix).
- SH-P17 — Resolved 2026-10-21: H1 aligned password rules and handled reset feedback. Historical problem: Inconsistent password rules: admin-created users ≥ 8 characters, sign-up/reset only 6; resetting to the same password currently shows the English error `same_password`. Related to the rule H1 just set (A11) → fixed in H1. Legacy P17; severity Low; discovery-era Planned: H1 (PR 2, `5c842d4`).
- SH-P21 — Resolved 2026-10-29: All nine native confirmations became ConfirmDialog in app-foundation U1; the Owner accepted the separate unverified real Gemini limit. Historical problem: Delete confirmation uses `window.confirm` (comments, admin CRUD of courses/chapters/lessons) — ugly, inconsistent with the UI — fixed in app-foundation U1: all 9 calls use `ConfirmDialog` (FEAT-006). Legacy P21; severity Low; discovery-era Planned: app-foundation U1 (PR 38, `572da83`).
