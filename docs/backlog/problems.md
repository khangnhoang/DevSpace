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
