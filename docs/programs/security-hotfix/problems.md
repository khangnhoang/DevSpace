# Security hotfix — problems outside the scope of H1

Found on 2026-10-21 while reading the code and the hosted DB metadata. Items marked **H2** will be done right after H1. The "Planned" column is the plan as of discovery; what has been delivered is recorded in [progress.md](progress.md).

| # | Problem | Severity | Planned |
|---|---|---|---|
| P1 | `profiles` SELECT `true` for `public`: anon can read the email, phone, dob, gender, province of everyone | High | **H2** |
| P2 | `coupons` SELECT `true` for `public`: every code can be listed; `CoursePaymentModal` checks the coupon on the client | Medium | **H2** |
| P3 | The `reviews` INSERT policy only checks enrollment and does not constrain `user_id = auth.uid()` → a review impersonating someone else | Medium | **H2** |
| P4 | The `comments` UPDATE policy has no `with_check` → the comment owner can change `user_id` | Low | **H2** |
| P5 | The code calls the RPC `increment_coupon_usage` but the function does not exist in the DB → coupon usage never increases | Medium | H2 or later |
| P6 | A coupon is counted when the pending order is created, while `updatePaymentWithCoupon` does not count → inconsistent usage logic | Low | later |
| P7 | Server components read data with the anon client, not per user | Low | techstack-migration (out of scope for `infrastructure`, its plan section 7) |
| P8 | Auth uses the implicit flow; should move to PKCE | Low | migration |
| P9 | Leaked password protection is off (Auth settings) | Low | Owner turns it on in the dashboard |
| P10 | Bucket `avatars`: any signed-in user can upload to any path | Low | later |
| P11 | pg_graphql exposes every table to anon/authenticated (advisor 0026/0027) | Low | later |
| ~~P12~~ | Fixed password `123123` when an admin creates a user — moved into H1 per Codex review round 1 | High | H1 |
| P13 | Paid lesson/quiz content readable without enrolling: RLS `lessons`/`exercises` SELECT `true`; the learn page queries every lesson on the server and checks enrollment on the client (`LearnClient.tsx`) after the data is already in the RSC payload | High | **H2** (Owner: split into H2-1/H2-2 if large) |
| P14 | Email links open only in the browser that requested them (PKCE); should move to `token_hash` + `verifyOtp` through a server route | Low | later |
| P16 | Updating a profile with an empty date of birth → `invalid input syntax for type date: ""` (the form sends an empty string instead of `null`). The bug predates H1 | Low | later |
| ~~P17~~ | Inconsistent password rules: admin-created users ≥ 8 characters, sign-up/reset only 6; resetting to the same password currently shows the English error `same_password`. Related to the rule H1 just set (A11) → fixed in H1 | Low | H1 |
| P18 | Opening the signup confirmation link in a browser/tab without the code verifier → the `/auth/error` page, even though the email is confirmed and sign-in works. The root cause is P14 | Low | with P14 |
| P19 | Several `localhost` tabs open: `supabase-js` shares `navigator.locks`, auth operations wait on the lock forever → one stuck tab makes the other tabs spin on sign-in. Closing all tabs fixes it. Library behavior, not caused by H1 | Low | monitor |
| P20 | Quiz results are not stored (no table), the UI does not mark a quiz as completed like a lesson; re-entering means starting over | Medium | future-features |
| P21 | Delete confirmation uses `window.confirm` (comments, admin CRUD of courses/chapters/lessons) — ugly, inconsistent with the UI | Low | when shadcn (Dialog) is applied |
| P22 | The avatar in the course review section has a strange extra gradient background | Low | later |
| P23 | Notifications: there is no mark-as-read button per notification (you must click the notification itself), only a button for all | Low | later |
| P24 | AI quiz creation does not run: `GEMINI_API_KEY` has expired. The Owner's job (issue a new key); includes the audit item of merging the 2 Gemini SDKs | Low | Owner |
| P15 | `/admin/transactions` shows every learner as "Ẩn danh": the page reads `p.profiles?.full_name` (`app/admin/transactions/page.tsx:148`) but `getAllPayments` returns `users`. The bug predates H1 (found during H1 QA) | Low | later |
| P25 | `approvePayment`/`rejectPayment` UPDATE only by `id`, not filtering `status = 'pending'` → approving again an order that was already processed, sending the email again; the enrollment is created by a separate request and its error is ignored | Low | **H2-2** |
| P26 | The quiz is graded on the client, an enrolled user receives `correct_answer` in the payload | Low | with P20 (grade on the server) |
| P27 | The content of a soft-deleted comment is still readable through REST; a user who has not enrolled can still read/write comments on a paid lesson | Low | later |
| P28 | A user can edit the `email` column in `profiles` themselves (system email is sent to this column) | Low | later |
| P29 | "Khóa học của tôi" at `/profile` shows only courses with ≥ 1 completed lesson (`getUserDashboardData` filters `isStarted`) → a user who bought a course but has not finished any lesson sees "Bạn chưa tham gia khóa học nào". The bug predates H2 (found during H2-1 QA) | Low | later |
| AW-003 | This file keeps the P1-P29 table, so `scripts/docs/check-structure.mjs` allowlists it for `problems-shape`; it is the only program problems file not in the open-entry shape. When H2-2a or H2-2b reopens, reshape it into open entries and one-line resolved entries keeping every ID, and remove the allowlist entry (`plan-h2.md` stays allowlisted). Moved from `agent-workflow` on 2026-10-22 | Low | with H2-2 |
