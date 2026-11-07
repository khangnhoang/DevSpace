# QE-U6 detail plan — E2e coverage gaps and the e2e layer audit

Revision: r1, 2026-11-07. Owner approval: 2026-11-07. Master plan or charter: [README.md](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the behaviors from the infrastructure U6 manual pass that no test asserted yet (QE-F10, moved from BL-F2) are covered at the smallest sufficient layer, and every row of `__tests__/e2e/` carries a recorded layer classification, so the QE-F8 moves can be planned form by form. No e2e row is moved or deleted.

| ID | Observable result |
| --- | --- |
| AC1 | An anonymous visitor types part of a seed course name in the Header search and sees that course in the results, linking to its course page; a query that matches nothing shows no course result (M1). |
| AC2 | A visitor on a course with more reviews than one page sees exactly the first page, newest first; "Xem thêm đánh giá cũ hơn" loads the rest and then disappears (M3, paging). |
| AC3 | The student who already reviewed a course sees the form in edit mode ("Chỉnh sửa đánh giá của bạn") with the stored rating and text; saving a change updates that one row and creates no second one (M3, edit). |
| AC4 | The student presses the complete button on a lesson with exercises: the "Bạn cần hoàn thành bài tập trước!" message shows, the browser goes to that lesson's quiz, and the student's progress rows for that lesson are unchanged (M5). |
| AC5 | The student completes a whole lesson quiz: every question is answered, the completion screen shows and the answer buttons are gone (M5, full quiz; the completion screen itself is already a component test). |
| AC6 | The student presses the complete button on the last lesson of a course with no exercise: "Đã hoàn thành bài học!" shows, one progress row exists for that lesson, and the browser reaches `/learn/<course>/finish` (M5b). |
| AC7 | The admin dashboard shows its stat cards, top students and recent activity with values derived from the seed (M8, render). |
| AC8 | The admin opens the header bell, sees an unread fixture notification with the unread count, opens it, and the notification is stored as read and the count drops; "mark all read" stores the admin's other unread fixture notifications as read and leaves other users' notifications unread (M8, bell). |
| AC9 | On the admin transactions page each status filter (all, pending, success, failed) lists only the orders of that status, and a filter with no order shows the empty text (M10, component test). |
| AC10 | In the user dialog, choosing an avatar file shows its preview image before saving (M11, component test). |
| AC11 | Every row in `__tests__/e2e/*.spec.ts` has a recorded classification in its spec's test-plan header: the integration boundary it needs (persistence, server/database/Auth refusal, real failed request, permission, upload, redirect, real-browser layout), or "client-only" with the component test file it would move to. QE-F8 lists the client-only rows and their counts per spec. |
| AC12 | When the rows land, QE-F10 is closed with the PR, QE-F8 stays open for the moves, and `npm run docs:check` reports 0 violations. |

### 1.2 Scope and non-goals

- In scope: AC1 to AC12; the fixture helpers those rows need. The QE-U5 docs catch-up (PR 74), the BL-F2 move to QE-F10 and the backlog entry for `searchLesson` are already in the plan commit.
- Residual manual QA: the M1 fallback image when a course image fails, and the M5b confetti, are perceptual; Main checks them once in the browser on the dev stack after the Final checks and reports them.
- Non-goals: moving or deleting any e2e row (a later initiative, form by form); the M1 fallback image and the M5b confetti (manual, see 1.3); fixing app bugs these tests find (recorded under `AGENTS.md` section 5, or a `knownBugE2e` row when the Owner agrees); QE-P7, QE-P9; any app code change.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. No row changes a seed user's account or a seed row it does not restore: reviews, progress, notifications and orders a row needs are created as owned fixtures or reserved first (`reserve*`, `acquire*` in `service-role.ts`), and the scope removes or restores them and verifies it. | Rows depend on run order, the end-of-run audit marks the run unclean, or manual-QA data drifts on the next reset. |
| G2. Waits use Playwright auto-waiting and `waitForURL`/`expect` polling, never a fixed sleep, including the 1.5 s finish redirect. | Flaky rows that pass locally and fail in CI. |
| G3. The network guard, the server guard and the "no 5xx" rule stay as they are; no row reaches a non-local host. | A green suite that hides a hosted call. |
| G4. A component test mocks only modules outside the component (data writes, router, toast, `next/image`); the filter and the preview logic run for real, and each new test fails under a mutation of the logic it covers. | A test that cannot fail. |
| G5. Each new e2e row is justified by an integration boundary under the e2e rule of `test-quality-strategy`; client-only assertions go to a component test. | The audit's own rule is broken by the rows it adds. |
| G6. The audit classifies; it changes no row, no assertion and no timeout. | The PR grows into the moves the Owner kept for later. |

### 1.4 Owner decisions that bind this unit

- Charter decision 6 (2026-11-07): QE-U6 covers the BL-F2 gaps and the QE-F8 audit as a classification only; moves wait for a later initiative; the QE-U5 docs catch-up ships in this PR; BL-F2 moves to quality-engineering.

## 2. Repository facts

Baseline: `259f123`, checked 2026-11-07.

- The open BL-F2 scenarios against the current rows: M2, M4, M6, M7, M9 and M12 are asserted (`auth-forms` AU1/AU7, `payment-learner`, `learner-forms` F1, `student` T6, `public` S5–S8 and `admin` A12/A13, `admin-content-forms` C3/H3/L3/E3 and `admin` A7). M1, M3 paging and edit, M5 complete gating and full quiz, M5b, M8, M10 and M11 have no assertion (`Header.test.tsx` covers logout only; `UserFormDialog.test.tsx` has no preview test; `TransactionsPage.test.tsx` has no filter test) — justifies AC1 to AC10.
- `searchLesson` (`lib/supabase.ts:228`) queries `courses` with `ilike` from the browser client — AC1 needs the real database, so e2e.
- The course page pages reviews with `.range(from, to)` ordered by `created_at` descending (`app/(main)/course/[slug]/page.tsx:96-102`) and switches to edit mode on `isEditing` — AC2/AC3 depend on stored rows, so e2e.
- `CompleteLessonButton` calls `checkAndSaveProgress` (`lib/supabase.ts:737`, `user_progress`), pushes to the quiz when `hasExercise`, else shows the success toast and, with no next lesson, fires confetti and pushes to `/finish` after `setTimeout(1500)` — AC4/AC6 need persistence and a redirect, so e2e; G2.
- `HeaderAdmin` reads and updates `notifications` (`is_read`) through the browser client, and "mark all read" updates every unread row of the signed-in receiver (`app/components/HeaderAdmin.tsx:78-153`); the only seed notification belongs to the student (`supabase/seed.sql:103`) — AC8 needs RLS and persistence, and owned fixture notifications for the admin, with the student's seed row as the untouched control (G1).
- The seed already stores a progress row for the student on lesson 3 (`supabase/seed.sql:100`), the lesson with two exercises — AC4 asserts the rows are unchanged rather than absent.
- The transactions filter is client state over loaded payments (`app/admin/transactions/page.tsx:35,96`) and the avatar preview is `URL.createObjectURL` in the dialog (`UserFormDialog.tsx:129`) — AC9/AC10 are client-only, so component tests.
- `__tests__/e2e/` holds 146 rows in 11 specs; program folders accept only role files (`docs:check` rule `file-role`), so the audit lives in the spec headers and the QE-F8 entry — justifies AC11.
- Adjacent, outside scope: `searchLesson` interpolates the query into a PostgREST `.or()` filter, so a query with `,` or `)` can change or break the filter; recorded in the backlog (BL-P20), not fixed here.

## 3. Bounded implementation hypotheses

- `public.spec.ts` gains the M1 row; `learner-forms.spec.ts` or `student.spec.ts` the review paging/edit, complete and quiz rows; `admin.spec.ts` the dashboard and bell rows — may change if each row keeps one boundary and its own scope.
- Review paging creates enough owned fixture reviews from `createUserFixture` users on one seed course, or on a fixture course — whichever keeps G1 and the run time lower.
- New scoped helpers in `service-role.ts` (for example `reserveStudentProgress`, a fixture notification for the admin) follow the existing `reserve*` pattern — may change if G1 holds.
- The full quiz uses a seed lesson whose stored answers match what `Quiz.tsx` compares; if none does, an owned fixture lesson with exercises — record which.
- Component tests extend `TransactionsPage.test.tsx` and `UserFormDialog.test.tsx` with `URL.createObjectURL` stubbed.
- The audit adds a classification block to each spec's header; the spec file stays the inventory.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | AC9, AC10: component tests | `npm run test:unit`; each new test fails under its mutation (filter returns all; preview not set). |
| CP2 | AC1 to AC6: learner and public rows with their helpers | the touched specs once, then `--repeat-each=3` of the new rows; `npm test` if a helper touched by `rls` changes. |
| CP3 | AC7, AC8: admin rows | the touched spec once, then `--repeat-each=3` of the new rows. |
| CP4 | AC11, AC12: audit in the spec headers, QE-F8 summary, QE-F10 closed | `npm run docs:check`; a count check that the headers classify every `test(` row (146 plus the new ones). |
| Final | Whole diff | `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm test`, `npm run test:e2e`, `npm run build`, `npm run docs:check`, once each; Main's residual manual QA (1.3). |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A new row finds a real app bug (for example the seed quiz answers, or the bell's mark-all scope). | Stop that row, report to Main; the Owner chooses a fix task or a `knownBugE2e` row. |
| New rows lengthen the e2e run. | Rendering rows share a page visit where possible; report the e2e duration before and after. |
| Review fixtures collide with `[F2]`/`[F3]` on the same course. | Reserve exact selectors or use a fixture course (hypothesis 2). |
| The finish redirect races the progress write. | Assert the stored row after `waitForURL`, through the service role. |

- Rollout runbook: none (tests and docs only, no hosted step).
- Stop when: a row needs an app change, a seed change or a weaker guard; an audit classification is unclear (ask Main).
- Rollback: revert the PR; no data or hosted state changes.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
