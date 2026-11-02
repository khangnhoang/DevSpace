# Problems, risks and follow-ups — app-foundation

Plan: [plan.md](plan.md). Progress: [progress.md](progress.md).

## Open

### AF-P4: saving a profile without a date of birth fails

- Status: Fixed locally, awaiting delivery (2026-11-03, AF-U3 CP1; opened 2026-10-25 and moved from `docs/backlog/` on 2026-10-28). The same bug is security-hotfix P16.
- Problem: the profile edit dialog defaults an empty `dob` to `""` (`app/(main)/profile/page.tsx:89`) and `handleUpdateProfile` sends it unchanged (`page.tsx:327`), so a user who has never set a date of birth cannot save any other field: the toast reads `Lỗi cập nhật: invalid input syntax for type date: ""`.
- Evidence: infrastructure U6 manual pass row M6, 2026-10-25, as `student@devspace.test` on the local stack (seed `dob` is null); saving with a date set succeeds.
- Direction: AF-U3's profile schema turns blank optional fields into `null`; an e2e row saves a profile with no date of birth.
- Exit condition: a profile with no date of birth saves another field successfully, and the date stays empty.

### AF-P1: server actions return raw error text

- Status: Open (2026-10-28, found while planning; outside the program's scope).
- Problem: some server actions return Supabase error text to the browser instead of a generic Vietnamese message, against the `server-actions` return contract: `createNewUser` returns `error.message` from `auth.admin.createUser` (`app/action/user.ts:50`), `deleteUserAccount` from `auth.admin.deleteUser` (`user.ts:79`), and `enrollCourse` from the `enrollments` insert (`app/action/enroll.ts:82`).
- Evidence: read at `cf8c60b`; not yet checked across the payment actions, which H2-2b rewrites.
- Direction: a small task after AF-U2 merges (AF-U2 keeps the messages it does not own); log the detail on the server and return a fixed message, keeping each action's result shape.
- Exit condition: no non-payment server action returns database or Auth error text.

### AF-P2: the AI bulk-create on the lessons page does not await its saves

- Status: Open (2026-10-29, found in the U1 plan review; outside U1, whose G4 keeps the handler as it is).
- Problem: `handleAiBulkCreate` maps the generated questions with a block-bodied arrow that calls `addExercise` without `return` (`app/admin/lessons/page.tsx:285-295`), so `Promise.all` awaits nothing and the success path runs before the saves finish or fail; and when `generateQuizFromContent` returns nothing, both AI handlers return without `setIsGenerating(false)` (`page.tsx:247`, `:278`), leaving the button busy.
- Evidence: read at `4179bf5`; not reproduced (it needs the AI key).
- Direction: AF-U5, which converts this page's forms, returns the promises and resets the busy state on every path.
- Exit condition: the bulk create reports success only after all three saves succeed, and every early return clears the busy state.

### AF-P3: the transactions page reloads its orders without handling a failure

- Status: Open (2026-10-29, found in the U1 Codex diff review; outside U1, which keeps data loading as it is).
- Problem: `fetchPayments()` is called without `await` or a catch after an approve or reject (`app/admin/transactions/page.tsx`, the `toast.promise` success callback and `handleReject`), and it sets `isLoading` true before `getAllPayments()`; if that call rejects, the rejection is unhandled and the table stays on "Đang tải dữ liệu...".
- Evidence: read at `e44489f`; the same calls exist at `4179bf5`. Not reproduced.
- Direction: a small task, or H2-2b when it rewrites the payment actions: catch the reload, clear `isLoading` in `finally`, and show an error with a retry.
- Exit condition: a failed reload shows an error state instead of a stuck loader, with no unhandled rejection.

### AF-P5: the profile transaction history header centres itself on a phone, and its status filter uses the browser's option list

- Status: Open (2026-11-03, Owner QA of AF-U3 at iPhone SE width; outside AF-U3, which does not touch this section).
- Problem: the "Lịch sử giao dịch" heading and the status filter sit in `flex flex-col md:flex-row justify-between items-center` (`app/(main)/profile/page.tsx`), so below `md` both are stacked and centred instead of aligned left. The filter is a bare `<select>`, so its open option list is drawn by the browser, unstyled and with emoji markers. On a real iPhone Safari shows its own picker; the boxed list in the screenshot is Chrome's desktop popup in device emulation.
- Evidence: Owner screenshot on the dev stack, 2026-11-03; the same markup exists at `fff1b13`, before AF-U3.
- Direction: a small task or the app-foundation unit that next touches this page: align the header left below `md` (`items-start md:items-center`). For the list, the shadcn `Select` (Radix, not yet in `components/ui/`) draws a styled popup; `NativeSelect` styles only the closed control. Adding `Select` is a design choice for the Owner, and its e2e and accessibility checks come with it.
- Exit condition: at 375px the heading and filter align with the table, and the filter's open list matches the decided control.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.
