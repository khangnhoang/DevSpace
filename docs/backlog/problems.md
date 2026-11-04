# Problems, risks and follow-ups — backlog

Problems that no open program owns. This is not a program: it has no plan and no progress.

## Open

### BL-P1: lint rules suppressed line by line where the real fix changes behavior

- Status: Open (2026-10-25, Owner decision D28 of infrastructure U6).
- Problem: U6 made lint blocking with 0 problems while keeping behavior identical, so five lines carry an `eslint-disable-next-line` with a reason instead of the real fix: `react-hooks/set-state-in-effect` at `app/(main)/course/[slug]/page.tsx:125` (the review list resets `page` and `hasMore` before the refetch), and `@next/next/no-img-element` at `app/(main)/course/[slug]/page.tsx:298` (review avatar), `app/admin/users/page.tsx:502` (`blob:` avatar preview), `app/components/CoursePaymentModal.tsx:167` (payment QR from an external URL) and `app/components/Header.tsx:232` (search result image with an `onError` fallback).
- Evidence: `grep -rn "eslint-disable" app lib` on the U6 branch lists exactly these five; [U6 plan](../programs/infrastructure/implementation-plans/u6-lint-cleanup/plan.md) D28 and G4.
- Direction: one small UI task with a manual browser pass: move the images to `next/image` with explicit sizes (`unoptimized` for `blob:`, a fallback for the Header image, the QR host listed), the host list is settled by BL-002 (`remotePatterns` now names only explicit hosts, so list any new host there); restructure the review reset so it no longer sets state synchronously in the effect, checking paging and the `hasEnrolled` change by hand.
- Exit condition: `grep -rn "eslint-disable" app lib` finds nothing, lint stays at 0, and the review list, avatars, QR and search images behave as before.

### BL-P2: the quiz completion screen never renders

- Status: Open (2026-10-25).
- Problem: `app/components/Quiz.tsx` declares `isCompleted` but never sets it (U6 removed the unused setter without changing behavior), so the completion branch at `Quiz.tsx:92` is unreachable and a finished quiz never shows its completion screen.
- Evidence: `git show b8e3e0f:app/components/Quiz.tsx` has no `setIsCompleted(...)` call; found by the infrastructure U6 lint cleanup. Related to security-hotfix P20 (quiz results are not stored), which covers persistence, not this screen.
- Direction: small UI task: set the completion state after the last question and check the screen by hand; decide with P20 whether completion should also be stored.
- Exit condition: answering the last question of a quiz shows the completion screen.

### BL-P3: the avatar menu is already open after signing back in

- Status: Open (2026-10-25).
- Problem: `handleLogout` in `app/components/Header.tsx:161` signs out and routes to `/login` without closing the user menu, and the header stays mounted across that route, so `showUserMenu` is still `true` and the menu shows open right after the next sign-in.
- Evidence: reported by the Owner during the infrastructure U6 manual pass, 2026-10-25 (sign out as `student@devspace.test`, sign in as `admin@devspace.test` on the local stack); cause read from the code, not yet confirmed by a fix. U6 changed only types and one suppression comment in this file.
- Direction: small UI fix: close the menu in `handleLogout` (and check whether the menu should also close on route change), then check sign out and sign in by hand.
- Exit condition: after signing out and signing in again, the avatar menu is closed until clicked.

### BL-P5: running C++ on Try It shows nothing, because the public Piston API now refuses it

- Status: Open (2026-11-01).
- Problem: the C++ tab of `/try_it` posts to `https://emkc.org/api/v2/piston/execute` (`app/(main)/try_it/page.tsx:117`). The public Piston API answers 401: since 2026-02-15 it accepts only whitelisted callers. The handler reads only `data.run` (`page.tsx:129`), so a 401 body shows no output, no toast and no error. The learner sees nothing happen.
- Evidence:
  - DM-U4 manual pass on the local dev server, 2026-11-01: a C++ link from `tryItHref` loaded the exact code, and "Chạy Code" left the console at its placeholder.
  - The same request sent from the page returned status 401 with the message "Public Piston API is now whitelist only as of 2/15/2026".
  - The behavior predates DM-U4, which did not change this request.
- Direction: suggested only. These options come from a first look at public docs (2026-11-01); none was tried, so each needs research before a plan. The Owner picks the backend. Separately, any non-OK response or a body without `run` should show an error to the learner.
  - The Piston whitelist is unlikely to fit: its README grants keys only to non-commercial educational projects and excludes individual, portfolio and university-assignment projects.
  - Judge0 through a server-side call (free RapidAPI plan, or self-hosted later). It is the leading suggestion, but the key must stay on the server, so the call adds a public POST endpoint that needs rate limiting (`server-actions`). The free quota is unverified.
  - Wandbox (`wandbox.org/api/compile.json`) needs no key and is the smallest change, but it is a community service with no guarantee. Browser CORS and its terms are unverified.
  - Compiler Explorer (godbolt.org) can execute code, but its docs warn that rate limits and authentication may come later.
  - Self-hosted Piston needs a privileged Docker host with cgroup v2, which Vercel cannot provide.
  - Removing the C++ tab.
- Exit condition: C++ code runs and shows its output, or the C++ tab is removed; a failed run always shows an error.

### BL-P6: the activation mail links to a 404 when the course has no lesson

- Status: Open (2026-11-01).
- Problem: the course activation mail sends the learner to `${baseUrl}/courses/${courseSlug}` when no first lesson is found (`lib/email.server.ts:60`). The course page route is `/course/<slug>` (`app/(main)/course`), so the button opens a 404. With an empty slug, the link is `/courses/`.
- Evidence: read from the code on 2026-11-01 at `1bc9802`. `sendSuccessEmail` is called from `app/action/payment.ts:293` with `payment.courses?.slug || ""` and an optional `firstLessonSlug`. The 404 has not been reproduced in a browser.
- Direction: small fix: build the fallback link from the real course route, and cover it with a content check (see quality-engineering QE-F4) or a unit test of the template.
- Exit condition: the activation mail of a course with no lesson links to that course's page, and the page opens.

### BL-P7: a learner's display name is inserted unescaped into the activation mail HTML

- Status: Open (2026-11-01).
- Problem: `getEmailTemplate` interpolates `userName` and `courseName` straight into HTML (`lib/email.server.ts`). `userName` is `profile.full_name` (`app/action/payment.ts:295`), which the learner sets. A name containing markup, such as a link, renders inside a mail sent from DevSpace's own Gmail account.
- Evidence: read from the code on 2026-11-01 at `1bc9802`. Not reproduced. Whether profile updates restrict `full_name` was not checked.
- Direction: escape every interpolated value in the mail template (and limit `full_name` where it is saved, if that fits the profile rules). Add a test with a name containing `<a>` and `&`. Severity is to be assessed before scheduling.
- Exit condition: a name with HTML characters shows as plain text in the mail.

### BL-P9: a signed-in user can open /login and sign in as another account

- Status: Open (2026-11-03).
- Problem: `/login` renders its forms for a visitor who already has a session, so a signed-in user can sign in again with another account without signing out first. Nothing redirects a signed-in visitor away from the page.
- Evidence: Owner QA of AF-U4 on the dev stack, 2026-11-03. `proxy.ts` has no rule for `/login`, and the page at `186530e` (before AF-U4) did not check the session either, so the behavior predates AF-U4.
- Direction: small fix: redirect a signed-in visitor from `/login` to `/` (or the safe `next` path) on the server, and add an e2e row for a signed-in actor. Decide whether "sign in as another account" should instead be offered through an explicit sign-out.
- Exit condition: a signed-in user who opens `/login` is sent away, or the page offers a deliberate sign-out first; an e2e row asserts it.

### BL-P10: any session can change the password on /auth/reset-password without a recovery mail or reauthentication

- Status: Open (2026-11-03).
- Problem: `/auth/reset-password` only checks that a session exists, then calls `supabase.auth.updateUser({ password })`. Any signed-in session, not only one opened from the recovery mail, can change the account password without the current password or a reauthentication step; an unattended or stolen session can take over the account.
- Evidence: Owner QA of AF-U4 on the dev stack, 2026-11-03: a normal sign-in, then the page, changed the password. `supabase/config.toml` sets `secure_password_change = false`; the hosted Auth setting was not checked. The page's session check predates AF-U4 (`186530e`).
- Direction: security change for the Codex gate: enable secure password change (recent sign-in or reauthentication nonce) on local and hosted, and/or let the page accept only a recovery session (the `PASSWORD_RECOVERY` event after `/auth/callback`). Severity is to be assessed before scheduling.
- Exit condition: a session that did not come from the recovery link cannot change the password without reauthenticating, asserted by a test.

### BL-P12: course and lesson slugs have no format rule, and a course slug is not unique

- Status: Open (2026-11-04, Owner decision while planning AF-U5: the AF-U5 forms add no slug rule, and this is recorded instead).
- Problem: the admin course and lesson forms accept any non-blank slug (spaces, capitals, Vietnamese accents, `/`), which then becomes the `/course/<slug>` or `/learn/<course>/<lesson>` URL. `lessons.slug` is unique (`lessons_slug_key`), but `courses.slug` has no unique constraint, and the course readers use `.eq("slug", …).single()` (`lib/supabase.ts:60-63`), so a second course with the same slug makes its page fail.
- Evidence: `supabase/migrations/20261021000000_baseline.sql` (only `lessons_slug_key`, read at `cc2d5ff`); `app/admin/courses/coursesclient.tsx` and `app/admin/lessons/page.tsx` send the typed slug unchanged. Hosted slugs were not read (reading data rows needs the Owner's approval).
- Direction: first read the hosted slugs (Owner-approved read) to see whether any existing slug breaks a kebab-case rule or is duplicated; then a migration with a unique constraint on `courses.slug` (Codex-gated, `supabase-migration`) and a slug rule in the admin schemas that new and edited slugs follow, with a plan for any existing slug that does not. Possibly with the techstack migration's schema review (BL-F11).
- Exit condition: two courses cannot share a slug, and a slug the forms accept is a valid URL segment, or the Owner drops it.

### BL-P13: the admin chapters page always names "HTML & CSS Cơ bản" as the current course

- Status: Open (2026-11-04, found by Main during AF-U5 manual QA; outside AF-U5, which changed only the chapter form).
- Problem: the "Khóa học hiện tại" card on `/admin/chapters` shows a hard-coded course name, so it disagrees with the course chosen in "Chuyển khóa học" and names a course even before one is chosen.
- Evidence: `app/admin/chapters/page.tsx` renders the literal `HTML & CSS Cơ bản` (also at `1cab557`, before AF-U5); on the dev stack with course 1 ("Làm quen với HTML") selected, the card still read "HTML & CSS Cơ bản".
- Direction: derive the card from the selected course (or an empty-state text when none is chosen); a small UI fix with one browser check.
- Exit condition: the card names the selected course, or says none is chosen.

### BL-P14: `profiles.role` accepts any text

- Status: Open (2026-11-04, Owner decision while planning AF-U6: the forms refuse a role other than `user` or `admin`, and the database rule waits for its own migration).
- Problem: `profiles.role` is `text` with no check constraint, so an admin writing through the browser client (or a future code path) can store a role other than `user` or `admin`; such a user is neither in the counters nor in the filters (AF-P7 stored "Chọn vai trò" this way).
- Evidence: `supabase/migrations/20261021000000_baseline.sql` (no constraint on `profiles.role`, read at `78c80ba`); AF-P7 in `docs/programs/app-foundation/problems.md`. Hosted roles were not read (reading data rows needs the Owner's approval).
- Direction: an Owner-approved read of the distinct hosted roles, a fix of any bad row, then a migration adding `check (role in ('user', 'admin'))` with its rollback (Codex-gated, `supabase-migration`); QE-F9 can assert the constraint exists.
- Exit condition: the database refuses a role other than `user` or `admin`, or the Owner drops it.

### BL-P15: an admin can change their own role and lose admin access at once

- Status: Open (2026-11-04, Owner decision while planning AF-U6: the edit form keeps this behavior).
- Problem: the edit form of `/admin/users` lets an admin set their own role to `user`; the save succeeds and the admin pages refuse them from the next request. The last admin can demote themselves, leaving no admin.
- Evidence: `app/admin/users/page.tsx` sends the chosen role for any user through `editUser`; the policy "Users can update own profile or Admin" allows it (`supabase/migrations/20261021000000_baseline.sql`), read at `78c80ba`. Not reproduced.
- Direction: decide the rule first (block self-demotion in the form only, or keep at least one admin in the database); a database rule is Codex-gated.
- Exit condition: the Owner's rule is enforced where the Owner chose, or the Owner drops it.

### BL-P16: a failed user create leaves its uploaded avatar in Storage

- Status: Open (2026-11-04, Owner decision while planning AF-U6: the upload order stays).
- Problem: the create form of `/admin/users` uploads the chosen avatar to the `avatars` bucket before it calls `createNewUser`; when the create fails (an email already in use, a refused field, a lost request), the uploaded object stays with no profile pointing to it.
- Evidence: `app/admin/users/page.tsx` (`uploadUserAvatar` then `createNewUser`), `lib/supabase.ts` (`uploadUserAvatar`), read at `78c80ba`. Not reproduced.
- Direction: upload after the user exists and then set the avatar, or remove the object when the create fails; either changes the write path of the form or the action, so it gets its own plan.
- Exit condition: a failed create leaves no new object in `avatars`, or the Owner drops it.

### BL-P17: the transactions page reloads its orders without handling a failure

- Status: Open (2026-10-29, found in the app-foundation U1 Codex diff review as AF-P3; moved here on 2026-11-05 when app-foundation closed, Owner decision).
- Problem: `fetchPayments()` is called without `await` or a catch after an approve or reject (`app/admin/transactions/page.tsx`, the `toast.promise` success callback and `handleReject`), and it sets `isLoading` true before `getAllPayments()`; if that call rejects, the rejection is unhandled and the table stays on "Đang tải dữ liệu...".
- Evidence: read at `e44489f`; the same calls exist at `4179bf5`. Not reproduced.
- Direction: a small task, or security-hotfix H2-2b when it rewrites the payment actions: catch the reload, clear `isLoading` in `finally`, and show an error with a retry.
- Exit condition: a failed reload shows an error state instead of a stuck loader, with no unhandled rejection.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-002 — Moved to [agent-workflow](../programs/agent-workflow/problems.md)
- BL-001 — Done: the docs checker treats a `Moved to` line as a pointer and the moved FEAT entries use the template lines again (PR #8)
- BL-007 — Done: README demo accounts removed and their hosted passwords rotated by the Owner (PR #21)
- BL-009 — Moved to [dependency-maintenance](../programs/dependency-maintenance/problems.md)
- BL-002 — Done: `remotePatterns` dropped `hostname: '**'` and names only the three course image hosts and the hosted Supabase Storage public path (PR #33)
- BL-008 — Done: a course without an image shows the shared `/no-course-image.png` on the home page, hero slider, course page and admin list (PR #33)
- BL-005 — Moved to [app-foundation](../programs/app-foundation/problems.md)
- BL-010 — Done: the quiz compares the selected option and the correct answer case-insensitively; hosted held no row outside `a` to `d` (PR #33)
- BL-P4 — Done: "Thử ngay" opens a lesson example with its exact code in its own language (html, javascript or cpp), other languages get no button, and a crafted link stays text until "Chạy Code"; delivered by dependency-maintenance DM-U4 (PR #49)
- BL-P8 — Done: confirming a payment shows one toast with a description instead of two stacked toasts, asserted by e2e PF9 (PR #55)
- BL-P11 — Done: local Auth requires 8-character passwords like hosted (`minimum_password_length = 8`), and `[P13]` proves a 7-character sign-up is refused (PR #60)
