# UX-U1 detail plan — Upgrade the learner profile page

Revision: r1, 2026-11-03. Owner approval: 2026-11-03. Master plan or charter: [README.md](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the learner profile page (`/profile`) leads back into learning from each course card, shows every enrolled course in a useful order, fits a phone without sideways scrolling, hides empty profile fields, and shows dates and amounts the Vietnamese way. It implements the eight findings of [UX-F1](../../future-features.md) and the Owner decisions in 1.4, as an upgrade under `frontend-design`: the layout, palette and identity of the page stay.

| ID | Observable result |
| --- | --- |
| AC1 | A learner with an unfinished started course sees a "Tiếp tục học" link on its card that opens the course's next unfinished lesson in chapter and lesson order, the lesson the course page's "Tiếp tục học ngay" opens; a completed course shows "Ôn lại" linking to its last lesson; a course with no lesson links to `/course/<slug>`. |
| AC2 | A learner enrolled in a course with no completed lesson sees that course on the profile at 0% with a "Bắt đầu học" link to its first lesson; a course neither enrolled nor started does not appear, as today. |
| AC3 | The course cards are ordered in progress (above 0% and below 100%) first, then not started, then completed; within a group the order is stable. |
| AC4 | With more than four courses the section shows four cards and a "Xem tất cả (n)" button that shows every card in place and then reads "Thu gọn"; with four or fewer there is no button. Cards sit in two columns from `md`. |
| AC5 | The course title on a card is a heading one level below the section heading "Khóa học của tôi" (not an `<h1>`). |
| AC6 | The profile card shows a gender, date of birth or province row only when it has a value, never "Trống"; when all three are empty it shows one line that invites the learner to add their details, and the existing "Chỉnh sửa hồ sơ" action opens the same dialog. |
| AC7 | At 768px the name and the "Chỉnh sửa hồ sơ" button do not wrap mid-label; at 375px the profile card is a compact horizontal header (avatar beside name and email) and the "Khóa học của tôi" heading starts within the first 812px of the page; from `lg` the card is the side column as today. |
| AC8 | At 375px the transaction history shows each transaction as a compact block (course, date, amount, status) with no horizontal scroll of the page or the history; from `md` it stays a table. The status filter, its accessible name and the pagination work at every width. |
| AC9 | Dates in the history show day, month, year and hour:minute without seconds; amounts use the Vietnamese thousands separator ("199.000đ"). |
| AC10 | No profile, payment or progress data is written by the page beyond what it wrote before; the edit dialog, its validation and the avatar upload behave as before. |

### 1.2 Scope and non-goals

- In scope: `app/(main)/profile/page.tsx` and `ProgressBar.tsx` in that folder; the dashboard read in `lib/supabase.ts` (`getUserDashboardData` and the lesson-order logic it may share with `getLastAccessedLessonSlug`); unit and e2e tests; `UX-F1` and the `ui-ux` progress.
- Non-goals: the edit dialog's form, schema and upload (app-foundation AF-U3 owns their contract, unchanged here); server actions, RLS, migrations and seed data; the course page, lesson pages and `Header`; a page `<h1>` or new route; payment logic; a new package, font or palette.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Reads go through the browser client under the existing RLS only (own `enrollments`, own `user_progress`, `lessons`, `chapters`, `courses`); no service-role client, server action or policy change. | A UI unit widens what a learner can read, reviewed as styling. |
| G2. The next-lesson rule is the one `getLastAccessedLessonSlug` applies (chapter `order_index`, then lesson `order_index`, then `created_at`, nulls last); share it rather than writing a second copy. | The profile and the course page send the learner to different lessons. |
| G3. The course links are real links (`next/link` or `<a href>`), computed when the page loads, with no per-click query. | Middle-click and keyboard users lose the link, and a slow click shows nothing. |
| G4. Existing e2e rows L4, T6, F1 to F12 keep their guarantees; a row changed for the new markup asserts the same behaviour at least as strongly. | A rewrite hides a regression in the filter, the form or the avatar. |
| G5. No `dark:` class and no OS-scheme token on this always-light page; shadcn pieces set their own surface and text colours. | The page turns partly dark in a dark OS scheme. |

### 1.4 Owner decisions that bind this unit

- (2026-11-03) All eight UX-F1 findings are in scope (charter decision 2).
- (2026-11-03) "Tiếp tục học" opens the next unfinished lesson, as the course page does, falling back to the course page.
- (2026-11-03) Enrolled courses with no completed lesson appear at 0% with "Bắt đầu học".
- (2026-11-03) "Xem tất cả" expands the list in place; no new page.

## 2. Repository facts

Baseline: `1c689ba`, checked 2026-11-03.

- `getUserDashboardData` (`lib/supabase.ts:157`) reads every course, every lesson (`id, course_id`) and the caller's `user_progress`, and returns only courses with a completed lesson (`isStarted`), in the order the courses query returns — justifies AC2 and AC3.
- `getLastAccessedLessonSlug` (`lib/supabase.ts:718`) returns the first unfinished lesson in chapter and lesson order, the last lesson when all are done, `null` when the course has none; the course page builds `/learn/<course>/<lesson>` from it — justifies AC1 and G2.
- `lessons` grants `authenticated` only `id, title, slug, course_id, chapter_id, order_index, created_at, has_video, word_count` (`20261021185249_h2_1b_restrict_reads.sql`), enough for the next-lesson rule without content — justifies G1 for AC1.
- `enrollments` has the select policy "Users can view own enrollments" (`auth.uid() = user_id`, baseline migration) — justifies G1 for AC2.
- The profile cards are `div`s with no link, the title is an `<h1>` and the list is one column with no limit (`page.tsx:480-514`) — findings 1, 6 and 8.
- The profile card prints "Trống" for empty fields and sits in `md:w-1/4` with a 128px avatar (`page.tsx:422-470`) — findings 3, 4 and 5.
- The history is a four-column table in `overflow-x-auto`, dates use `toLocaleTimeString("vi-VN")` (seconds) and amounts `toLocaleString()` with the browser locale (`page.tsx:559-622`) — findings 2 and 7.
- Seed: the student is enrolled in course 2 (lessons 3 and 4, lesson 3 completed); the learner is enrolled nowhere and has no gender, date of birth or province; course 1 is free with lessons 1 and 2 — the data the e2e rows use.
- `ProgressBar.tsx` carries a `dark:bg-gray-700` class — G5.
- `MobileBlocker` is used only on `/try_it`, so `/profile` is meant to work on a phone.

## 3. Bounded implementation hypotheses

- `getUserDashboardData` also reads the caller's enrollments and the lesson slug, chapter and order columns, and returns each course's destination path and an `enrolled`/`started` flag; the sort of `getLastAccessedLessonSlug` moves into a shared pure helper both use — may change if G1 and G2 hold.
- Pure helpers for the course order (AC3), the visible slice (AC4) and the date and amount formats (AC9) live beside the page or in `lib/`, unit-tested — may change if each rule is tested.
- The course card becomes its own small component in the profile folder; the transaction list renders blocks below `md` and the table from `md` from one data list — may change if AC4 and AC8 hold.
- The page container moves to `lg:flex-row` with the side column from `lg`, and a compact header below it — may change if AC7 holds at 375px, 768px and desktop.
- `ProgressBar` loses its `dark:` class and its generic `aria-label` gains the course name — may change if G5 holds.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Courses section: AC1 to AC5 (data read, order, links, four-card limit with "Xem tất cả", two columns, heading level). | `npx tsc --noEmit`; `npm run lint` (0 problems); `npm run test:unit` with new cases for the order, the slice and the next-lesson rule (in progress, completed, no lesson, null orders); `npm run test:e2e` with new rows: the student's card links to `/learn/javascript-can-ban/ham-va-vong-lap` and opens it; the learner, after the L5-style free enrollment of course 1 (existing `prepareLearnerEnrollment` cleanup), sees "Bắt đầu học" to `/learn/lam-quen-voi-html/cau-truc-mot-trang-html`. AC4's toggle gets an e2e row if a bounded fixture extension (extra course fixtures with owned enrollments) fits `test-quality-strategy`; otherwise unit coverage of the slice plus the visual review, with the reason reported. |
| CP2 | Profile card and history: AC6 to AC9, with T6 updated under G4. | `tsc`; lint; `npm run test:unit` (formats); `npm run test:e2e` rows: the learner's card shows no "Trống" and shows the invitation; with `acquireStudentProfile` values set, the three rows show; at 375px the page and the history have no horizontal overflow, the student's payment shows "199.000đ" and a date without seconds, and the courses heading starts above 812px; at 768px the edit button's label does not wrap. Then `npm run test:e2e` a second time and `npm test` once. |
| CP3 | Visual review and records: AC10 confirmed, UX-F1 `Fixed locally, awaiting delivery`, State updated. | Visual review per `frontend-design` at 375px, 768px and desktop on the dev stack signed in as the student and the learner (Owner signs in), at most three rounds, screenshots in the report; `npm run docs:check`. |

Manual QA (Owner): M1, the page at the three widths for perceptual judgement of the upgrade (spacing, hierarchy, the expanded list), which assertions cannot judge.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The extra reads slow the page for a learner with many courses. | One query per table, as today, plus one for enrollments; no per-course query (G3). |
| Sharing the lesson sort changes the course page's continue target. | The helper is pure and unit-tested with the cases of the old function; the course page keeps its call. |
| The T6 rewrite for blocks below `md` weakens the filter check. | G4; T6 keeps its desktop table assertions and checks the blocks at 375px. |
| A long course name or many statuses break the compact blocks. | The visual review includes a long name; text wraps, never overflows. |

- Rollout runbook: none (no hosted step; Vercel deploys on merge).
- Stop when: a change needs a policy, server action or schema change; the shared sort cannot keep the course page's current target; a row in G4 can pass only by asserting less.
- Rollback: revert the PR; no data is written.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
