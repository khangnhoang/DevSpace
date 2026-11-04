# Problems, risks and follow-ups — app-foundation

Plan: [plan.md](plan.md). Progress: [progress.md](progress.md).

## Open

### AF-P3: the transactions page reloads its orders without handling a failure

- Status: Open (2026-10-29, found in the U1 Codex diff review; outside U1, which keeps data loading as it is).
- Problem: `fetchPayments()` is called without `await` or a catch after an approve or reject (`app/admin/transactions/page.tsx`, the `toast.promise` success callback and `handleReject`), and it sets `isLoading` true before `getAllPayments()`; if that call rejects, the rejection is unhandled and the table stays on "Đang tải dữ liệu...".
- Evidence: read at `e44489f`; the same calls exist at `4179bf5`. Not reproduced.
- Direction: a small task, or H2-2b when it rewrites the payment actions: catch the reload, clear `isLoading` in `finally`, and show an error with a retry.
- Exit condition: a failed reload shows an error state instead of a stuck loader, with no unhandled rejection.

### AF-P7: the admin user form can save the role "Chọn vai trò"

- Status: Open (2026-11-04, found by the Owner in AF-U5 manual QA; for AF-U6, which converts the admin user forms).
- Problem: the role select in `app/admin/users/page.tsx` has a placeholder `<option>Chọn vai trò</option>` with no `value`, so its value is its text; the form sends it unchanged through `editUser` (and `createNewUser`), and `profiles.role` has no check constraint, so a user is saved with the role "Chọn vai trò". Such a user is neither `admin` nor `user` in the counters and filters.
- Evidence: Owner screenshot on the dev stack: student@devspace.test shows the role "Chọn vai trò" after an edit; `supabase/migrations/20261021000000_baseline.sql` has no constraint on `profiles.role`.
- Direction: AF-U6's user schema accepts only `user` or `admin` (the placeholder an empty value that fails) on client and server; a check constraint on `profiles.role` is a separate, Codex-gated migration (QE-F9 would catch its absence). The dev row is fixed by editing the user back to `user`.
- Exit condition: neither the form nor the action can store a role other than `user` or `admin`.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AF-P1 — Resolved 2026-11-03: the user, enroll and Gemini actions log the detail and return fixed Vietnamese messages, covered by e2e V8 to V10 and two Gemini unit tests (PR 55, `9d6198c`).
- AF-P5 — Resolved 2026-11-03: the profile transaction header aligns left below `md` and its status filter is the shadcn `Select`, covered by e2e T6 (PR 55, `9d6198c`).
- AF-P4 — Resolved 2026-11-03: the AF-U3 profile schema turns a blank date of birth into null, so a profile without one saves, covered by an e2e row; security-hotfix SH-P16, the same bug, closes with it (PR 53, `33db042`).
- AF-P6 — Resolved 2026-11-04: the price-error clearing that e2e row C2 doubted is proven by a component test of `CourseFormDialog` (an emptied price clears its error and `aria-invalid`), and C2 moved there; the e2e timing cause stays unnamed (quality-engineering QE-U4, this commit).
- AF-P2 — Resolved 2026-11-04: the AI bulk create awaits every save and reports a partial save, and both AI handlers clear the busy state in `finally`, covered by `__tests__/unit/ai-exercises.test.ts` (PR 60, `8384545`).
