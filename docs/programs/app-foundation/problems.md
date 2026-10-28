# Problems, risks and follow-ups — app-foundation

Plan: [plan.md](plan.md). Progress: [progress.md](progress.md).

## Open

### BL-005: saving a profile without a date of birth fails

- Status: Open (2026-10-25); moved from `docs/backlog/` on 2026-10-28, owned by U3. The same bug is security-hotfix P16.
- Problem: the profile edit dialog defaults an empty `dob` to `""` (`app/(main)/profile/page.tsx:89`) and `handleUpdateProfile` sends it unchanged (`page.tsx:327`), so a user who has never set a date of birth cannot save any other field: the toast reads `Lỗi cập nhật: invalid input syntax for type date: ""`.
- Evidence: infrastructure U6 manual pass row M6, 2026-10-25, as `student@devspace.test` on the local stack (seed `dob` is null); saving with a date set succeeds.
- Direction: U3's profile schema turns blank optional fields into `null`; an e2e row saves a profile with no date of birth.
- Exit condition: a profile with no date of birth saves another field successfully, and the date stays empty.

### AF-001: server actions return raw error text

- Status: Open (2026-10-28, found while planning; outside the program's scope).
- Problem: some server actions return Supabase error text to the browser instead of a generic Vietnamese message, against the `server-actions` return contract: `createNewUser` returns `error.message` from `auth.admin.createUser` (`app/action/user.ts:50`), `deleteUserAccount` from `auth.admin.deleteUser` (`user.ts:79`), and `enrollCourse` from the `enrollments` insert (`app/action/enroll.ts:82`).
- Evidence: read at `cf8c60b`; not yet checked across the payment actions, which H2-2b rewrites.
- Direction: a small task after U2 merges (U2 keeps the messages it does not own); log the detail on the server and return a fixed message, keeping each action's result shape.
- Exit condition: no non-payment server action returns database or Auth error text.

### AF-002: the AI bulk-create on the lessons page does not await its saves

- Status: Open (2026-10-29, found in the U1 plan review; outside U1, whose G4 keeps the handler as it is).
- Problem: `handleAiBulkCreate` maps the generated questions with a block-bodied arrow that calls `addExercise` without `return` (`app/admin/lessons/page.tsx:285-295`), so `Promise.all` awaits nothing and the success path runs before the saves finish or fail; and when `generateQuizFromContent` returns nothing, both AI handlers return without `setIsGenerating(false)` (`page.tsx:247`, `:278`), leaving the button busy.
- Evidence: read at `4179bf5`; not reproduced (it needs the AI key).
- Direction: U5, which converts this page's forms, returns the promises and resets the busy state on every path.
- Exit condition: the bulk create reports success only after all three saves succeed, and every early return clears the busy state.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.
