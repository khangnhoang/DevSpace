# Problems, risks and follow-ups — backlog

Problems that no open program owns. This is not a program: it has no plan and no progress.

## Open

### BL-002: `next/image` optimizes images from any HTTPS host

- Status: Open (2026-10-23).
- Problem: `images.remotePatterns` in `next.config.ts` ends with `hostname: '**'`, so `/_next/image` fetches and optimizes an image from any HTTPS host. On Vercel anyone can spend the project's image-optimization quota through DevSpace's domain; self-hosted, an open pattern is the precondition of image-optimizer advisories such as GHSA-9g9p-9gw9-jx7f.
- Evidence: `next.config.ts` on `adb3262`; found while reading the `next` advisories for infrastructure INF-001.
- Direction: list the hosts the content really uses (Supabase Storage and the course image hosts already named in the file) after checking the stored image URLs, then drop `**`. Small task once the host list is confirmed.
- Exit condition: `remotePatterns` names only explicit hosts, and every course image and avatar still loads.

### BL-003: lint rules suppressed line by line where the real fix changes behavior

- Status: Open (2026-10-25, Owner decision D28 of infrastructure U6).
- Problem: U6 made lint blocking with 0 problems while keeping behavior identical, so five lines carry an `eslint-disable-next-line` with a reason instead of the real fix: `react-hooks/set-state-in-effect` at `app/(main)/course/[slug]/page.tsx:125` (the review list resets `page` and `hasMore` before the refetch), and `@next/next/no-img-element` at `app/(main)/course/[slug]/page.tsx:298` (review avatar), `app/admin/users/page.tsx:502` (`blob:` avatar preview), `app/components/CoursePaymentModal.tsx:167` (payment QR from an external URL) and `app/components/Header.tsx:232` (search result image with an `onError` fallback).
- Evidence: `grep -rn "eslint-disable" app lib` on the U6 branch lists exactly these five; [U6 plan](../programs/infrastructure/implementation-plans/u6-lint-cleanup/plan.md) D28 and G4.
- Direction: one small UI task with a manual browser pass: move the images to `next/image` with explicit sizes (`unoptimized` for `blob:`, a fallback for the Header image, the QR host listed), after BL-002 settles the host list; restructure the review reset so it no longer sets state synchronously in the effect, checking paging and the `hasEnrolled` change by hand.
- Exit condition: `grep -rn "eslint-disable" app lib` finds nothing, lint stays at 0, and the review list, avatars, QR and search images behave as before.

### BL-004: the quiz completion screen never renders

- Status: Open (2026-10-25).
- Problem: `app/components/Quiz.tsx` declares `isCompleted` but never sets it (U6 removed the unused setter without changing behavior), so the completion branch at `Quiz.tsx:92` is unreachable and a finished quiz never shows its completion screen.
- Evidence: `git show b8e3e0f:app/components/Quiz.tsx` has no `setIsCompleted(...)` call; found by the infrastructure U6 lint cleanup. Related to security-hotfix P20 (quiz results are not stored), which covers persistence, not this screen.
- Direction: small UI task: set the completion state after the last question and check the screen by hand; decide with P20 whether completion should also be stored.
- Exit condition: answering the last question of a quiz shows the completion screen.

### BL-005: saving a profile without a date of birth fails

- Status: Open (2026-10-25).
- Problem: the profile edit dialog defaults an empty `dob` to `""` (`app/(main)/profile/page.tsx:89`) and `handleUpdateProfile` sends it unchanged (`page.tsx:327`), so a user who has never set a date of birth cannot save any other field: the toast reads `Lỗi cập nhật: invalid input syntax for type date: ""`.
- Evidence: infrastructure U6 manual pass row M6, 2026-10-25, as `student@devspace.test` on the local stack (seed `dob` is null); the same lines exist at `b8e3e0f`, before U6, which changed only types in this file. Saving with a date set succeeds.
- Direction: small fix in the dialog or `updateProfile`: send `null` for an empty date (and check the other optional fields), with a manual pass or an e2e row for a profile without a date.
- Exit condition: a profile with no date of birth saves another field successfully, and the date stays empty.

### BL-006: the avatar menu is already open after signing back in

- Status: Open (2026-10-25).
- Problem: `handleLogout` in `app/components/Header.tsx:161` signs out and routes to `/login` without closing the user menu, and the header stays mounted across that route, so `showUserMenu` is still `true` and the menu shows open right after the next sign-in.
- Evidence: reported by the Owner during the infrastructure U6 manual pass, 2026-10-25 (sign out as `student@devspace.test`, sign in as `admin@devspace.test` on the local stack); cause read from the code, not yet confirmed by a fix. U6 changed only types and one suppression comment in this file.
- Direction: small UI fix: close the menu in `handleLogout` (and check whether the menu should also close on route change), then check sign out and sign in by hand.
- Exit condition: after signing out and signing in again, the avatar menu is closed until clicked.

### BL-008: the admin course list falls back to an image that does not exist

- Status: Open (2026-10-27).
- Problem: `app/admin/courses/coursesclient.tsx:198` shows `/placeholder.jpg` for a course without `image_url`, but `public/` has no such file, so the image request fails with a 404 and the course card shows a broken image.
- Evidence: the `e2e` web server logs `internal image response failed for /placeholder.jpg 404` in CI runs 40374119999, 40379238483 and 40383406684, before and after infrastructure FEAT-018; the tests still pass. The seed sets no `image_url` (`supabase/seed.sql`), and the line above is the only reference to the file in `app` and `lib`.
- Direction: small UI task: add a fallback image to `public/` or render a placeholder block instead, and check the admin course list by hand; FEAT-015 (seed images) would hide the 404 locally but not fix the fallback.
- Exit condition: the admin course list shows a working fallback for a course without an image, and the `e2e` log has no `/placeholder.jpg 404`.

### BL-010: hosted `exercises` rows may hold uppercase correct answers

- Status: Open (2026-10-27).
- Problem: the seed stored `correct_answer` as `A`, `B` and `C` while `Quiz.tsx:83` compares the selected lowercase option exactly (infrastructure INF-002, fixed in the seed only). The hosted `exercises` table may hold uppercase answers too, and then those quizzes never accept a correct answer on production.
- Evidence: found as the separate read-only check named in INF-002; nothing has been read from hosted. The admin form writes `a` to `d` (`app/admin/lessons/page.tsx`), so only rows created another way can differ.
- Direction: count `exercises` rows whose `correct_answer` is not one of `a` to `d`, read-only on hosted (reading data rows needs the Owner's approval, `.claude/rules.md` section 4). If any exist, fix them through a reviewed data change (a separate grant), or make the comparison case-insensitive.
- Exit condition: hosted `exercises` holds only lowercase answers, or the Owner confirms there are none.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-002 — Moved to [agent-workflow](../programs/agent-workflow/problems.md)
- BL-001 — Done: the docs checker treats a `Moved to` line as a pointer and the moved FEAT entries use the template lines again (PR #8)
- BL-007 — Done: README demo accounts removed and their hosted passwords rotated by the Owner (PR #21)
- BL-009 — Moved to [dependency-maintenance](../programs/dependency-maintenance/problems.md)
