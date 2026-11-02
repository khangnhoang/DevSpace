# Problems, risks and follow-ups — app-foundation

Plan: [plan.md](plan.md). Progress: [progress.md](progress.md).

## Open

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

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AF-P1 — Resolved 2026-11-03: the user, enroll and Gemini actions log the detail and return fixed Vietnamese messages, covered by e2e V8 to V10 and two Gemini unit tests (PR 55, `9d6198c`).
- AF-P5 — Resolved 2026-11-03: the profile transaction header aligns left below `md` and its status filter is the shadcn `Select`, covered by e2e T6 (PR 55, `9d6198c`).
- AF-P4 — Resolved 2026-11-03: the AF-U3 profile schema turns a blank date of birth into null, so a profile without one saves, covered by an e2e row; security-hotfix SH-P16, the same bug, closes with it (PR 53, `33db042`).
