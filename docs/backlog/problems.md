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

### BL-007: README published two hosted demo accounts with their password

- Status: Fixed on hosted, awaiting delivery (the Owner set new passwords for both accounts on 2026-10-25; the README lines were removed in `1f13cef`). Closes as one `Done` line when the U4 PR exists.
- Problem: `README.md:124-127` at `5e62bc1` listed `admin@devspace.com` and `student@devspace.com` with a shared weak password in plain text. U4 removed the lines, but they stay in Git history, so if the accounts exist on hosted they can be signed in to, one of them possibly as admin.
- Evidence: `git show 5e62bc1:README.md`, lines 124-127. The same password is the old admin-page default that [security-hotfix](../programs/security-hotfix/plan.md) section 6 already asks the Owner to rotate.
- Direction: the Owner checks on hosted whether the two accounts exist and rotates their passwords or deletes them, alongside the security-hotfix rotation step. No agent reads user rows or signs in for this.
- Exit condition: neither account can sign in with the published password.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-002 — Moved to [agent-workflow](../programs/agent-workflow/problems.md)
- BL-001 — Done: the docs checker treats a `Moved to` line as a pointer and the moved FEAT entries use the template lines again (PR #8)
