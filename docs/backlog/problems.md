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

### BL-P4: "Thử ngay" breaks lesson code with `%` and always opens Try It in HTML

- Status: Open (2026-11-01).
- Problem: `PreBlock.handleTryIt` sends the lesson code as `/try_it?code=<encodeURIComponent(code)>` (`app/components/PreBlock.tsx:22-28`). `app/(main)/try_it/page.tsx:50` calls `decodeURIComponent` on `useSearchParams().get("code")`, which is already decoded: code with a `%` not followed by two hex digits (`width: 50%;`, `printf("%d")`) throws `URIError` during render, and code holding a sequence such as `%20` is silently changed. The page also starts with `language` fixed to `"html"` (`page.tsx:48`), so a JavaScript or C++ example runs as an HTML preview, and switching tab replaces the example with the default code (`page.tsx:56-60`). Any third party can craft a `/try_it?code=...` link that loads its text into the learner's editor.
- Evidence: read from the code at `f900b18`; the double decode reproduced in Node (`decodeURIComponent` of the decoded `x="50%"` throws `URI malformed`, `a%20b` becomes `a b`). Code runs only after "Chạy Code": HTML and JavaScript in an iframe with `sandbox="allow-scripts allow-modals"` and no `allow-same-origin` (`page.tsx:220`); C++ is sent to the external Piston API (`page.tsx:111`). The crafted link matters for dependency-maintenance DM-P1 group B, because Monaco's sanitizer can then see third-party text.
- Direction: planned in dependency-maintenance [DM-U4](../programs/dependency-maintenance/implementation-plans/dm-u4-monaco-self-host/plan.md), one PR with self-hosted Monaco 0.57.0 (DM-P1 group B, Owner decision 2026-11-01 instead of the CDN pin): drop the extra decode, pass the code block's language (`language-*` class) from `PreBlock` and start Try It in it (`html`, `javascript` or `cpp` only), keep the example when the tab matches, with automated tests for `50%`, `%20` and a JavaScript example plus a manual editor pass. Code stays text until the learner runs it; no filtering of HTML or JavaScript.
- Exit condition: "Thử ngay" on HTML, JavaScript and C++ examples, including ones with `%`, opens Try It in the matching language with the exact code, and runs it there.

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
