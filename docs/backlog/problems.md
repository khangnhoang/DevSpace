# Problems, risks and follow-ups — backlog

Problems that no open program owns. This is not a program: it has no plan and no progress.

## Open

### BL-P1: lint rules suppressed line by line where the real fix changes behavior

- Status: Open (2026-10-25, Owner decision D28 of infrastructure U6).
- Problem: U6 made lint blocking with 0 problems while keeping behavior identical, so five lines carry an `eslint-disable-next-line` with a reason instead of the real fix: `react-hooks/set-state-in-effect` at `app/(main)/course/[slug]/page.tsx:125` (the review list resets `page` and `hasMore` before the refetch), and `@next/next/no-img-element` at `app/(main)/course/[slug]/page.tsx:298` (review avatar), `app/admin/users/page.tsx:502` (`blob:` avatar preview), `app/components/CoursePaymentModal.tsx:167` (payment QR from an external URL) and `app/components/Header.tsx:232` (search result image with an `onError` fallback).
- Evidence: `grep -rn "eslint-disable" app lib` on the U6 branch lists exactly these five; [U6 plan](../programs/infrastructure/implementation-plans/u6-lint-cleanup/plan.md) D28 and G4.
- Direction: one small UI task with a manual browser pass: move the images to `next/image` with explicit sizes (`unoptimized` for `blob:`, a fallback for the Header image, the QR host listed), the host list is settled by BL-002 (`remotePatterns` now names only explicit hosts, so list any new host there); restructure the review reset so it no longer sets state synchronously in the effect, checking paging and the `hasEnrolled` change by hand.
- Exit condition: `grep -rn "eslint-disable" app lib` finds nothing, lint stays at 0, and the review list, avatars, QR and search images behave as before.

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
- Update (2026-11-07, Owner decision): the error display is fixed locally and awaiting delivery: a non-OK answer or a body without `run` shows an error line in the console and an error toast. Choosing the backend moves to the techstack migration, so this entry stays open for it.
- Exit condition: C++ code runs and shows its output, or the C++ tab is removed; a failed run always shows an error.

### BL-P12: course and lesson slugs have no format rule, and a course slug is not unique

- Status: Open (2026-11-04, Owner decision while planning AF-U5: the AF-U5 forms add no slug rule, and this is recorded instead).
- Problem: the admin course and lesson forms accept any non-blank slug (spaces, capitals, Vietnamese accents, `/`), which then becomes the `/course/<slug>` or `/learn/<course>/<lesson>` URL. `lessons.slug` is unique (`lessons_slug_key`), but `courses.slug` has no unique constraint, and the course readers use `.eq("slug", …).single()` (`lib/supabase.ts:60-63`), so a second course with the same slug makes its page fail.
- Evidence: `supabase/migrations/20261021000000_baseline.sql` (only `lessons_slug_key`, read at `cc2d5ff`); `app/admin/courses/coursesclient.tsx` and `app/admin/lessons/page.tsx` send the typed slug unchanged. Hosted slugs were not read (reading data rows needs the Owner's approval).
- Direction: first read the hosted slugs (Owner-approved read) to see whether any existing slug breaks a kebab-case rule or is duplicated; then a migration with a unique constraint on `courses.slug` (Codex-gated, `supabase-migration`) and a slug rule in the admin schemas that new and edited slugs follow, with a plan for any existing slug that does not. Possibly with the techstack migration's schema review (BL-F11).
- Update (2026-11-07, Owner decision): this will be done with BL-F11 in the techstack migration.
- Exit condition: two courses cannot share a slug, and a slug the forms accept is a valid URL segment, or the Owner drops it.

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
- BL-P6 — Done: the activation mail of a course with no lesson links to `/course/<slug>`, and to the home page when the slug is empty, unit-tested; delivered with security-engineering SE-P2 (PR #66)
- BL-P11 — Done: local Auth requires 8-character passwords like hosted (`minimum_password_length = 8`), and `[P13]` proves a 7-character sign-up is refused (PR #60)
- BL-P7 — Moved to [security-engineering](../programs/security-engineering/problems.md)
- BL-P9 — Moved to [security-engineering](../programs/security-engineering/problems.md)
- BL-P10 — Moved to [security-engineering](../programs/security-engineering/problems.md)
- BL-P14 — Moved to [security-engineering](../programs/security-engineering/problems.md)
- BL-P15 — Moved to [security-engineering](../programs/security-engineering/problems.md)
- BL-P16 — Moved to [security-engineering](../programs/security-engineering/problems.md)
- BL-P19 — Done: fixed by ui-ux UX-U1, `buildDashboardCourses` lists an enrolled course with nothing done at 0% (PR #57)
- BL-P2 — Done: answering the last question of a quiz shows the completion screen; quiz result persistence stays with SE-P18 (PR #73)
- BL-P3 — Done: the avatar menu closes when the user signs out, so it is closed after the next sign-in (PR #73)
- BL-P13 — Done: the admin chapters card names the course chosen in "Chuyển khóa học" and says "Chưa chọn khóa học" before one is chosen (PR #73)
- BL-P17 — Done: a failed load or reload on the transactions page shows an error with "Thử lại", clears the loader and leaves no unhandled rejection (PR #73)
- BL-P18 — Done: the transactions table and both confirm dialogs show the learner's name, email and avatar from the returned `users` relation (PR #73)
