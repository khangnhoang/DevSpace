# AF-U5 detail plan — Admin content forms

Revision: r1, 2026-11-04. Owner approval: 2026-11-04. Master plan or charter: [plan.md](../../plan.md) (r2), unit AF-U5, branch `feat/af-admin-content-forms`.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the admin content forms of master plan Appendix A (course add and edit, chapter add and edit, lesson add and edit, exercise add and edit, and the two AI buttons of the exercise tab) use React Hook Form with a Zod resolver, shared schemas in `lib/schemas/` and shadcn controls; they show field-level Vietnamese errors, block duplicate submits and keep their write paths; the AI bulk create checks the generated questions and reports only what was saved (AF-P2); the skills describe what exists.

| ID | Observable result |
| --- | --- |
| AC1 | An admin adds a course with a name, a slug, a price and no description or instructor: one `courses` row holds the trimmed name and slug, the price as an integer, `description` and `instructor_id` null, and the toast reads `Thêm khóa học thành công`. Editing a course saves the changed fields and keeps its image when no new file is chosen. |
| AC2 | A course with a blank name or slug, or a price that is negative or not a whole number, shows a field error under that control and writes nothing; a blank price saves as 0, as today. |
| AC3 | An admin adds a chapter with a title, an order and a course: one `chapters` row holds them; editing saves the change. A blank title, a blank or non-integer order, or no course shows a field error and writes nothing. |
| AC4 | An admin adds a lesson with a title, a slug, a course and a chapter of that course: one `lessons` row holds them, a blank video URL is stored as null and a blank order as null; the content is stored exactly as typed (not trimmed, may be empty). A blank title or slug, no course or no chapter shows a field error and writes nothing. Changing the course clears the chapter, as today. |
| AC5 | On the exercise tab of a saved lesson, an admin adds a question with four options and a correct answer: one `exercises` row holds the trimmed texts, the answer as `a` to `d` and a blank explanation as null, and the list shows it; editing saves the change. A blank question or option, or no correct answer, shows a field error and writes nothing. |
| AC6 | In every form of AC1 to AC5, a second submit while the first is pending (a double click, a repeated Enter, a repeated `submit` event) sends nothing: one submit makes at most one write. A failed save keeps the form open with what was typed and toasts the failure. |
| AC7 | "Điền vào form" fills the exercise form from the first generated question; when the action returns an error or nothing, the toast names the failure and the AI button is usable again (busy state cleared on every path). |
| AC8 | "Tự động thêm 3 câu" (after its confirm dialog) checks the generated result first: it must be a non-empty list and every question must pass the exercise schema; otherwise nothing is saved and the toast says the AI result was invalid. Otherwise it saves them, waits for every save, then toasts `Đã thêm thành công N câu hỏi!` (N the number saved, 3 when the AI returned three) only when all succeeded, or an error naming how many were saved when some failed; the list reloads and the busy state clears on every path (AF-P2, Owner decision 2026-11-04). |
| AC9 | Every value the current UI legitimately sends still passes (master invariant): any non-blank name, title, slug and option text, any integer order (negative and 0 included), a price of 0 or more, any MDX content, any video URL text. No slug format rule (Owner decision 2026-11-04, BL-P12) and no length limit the database does not have. |
| AC10 | Each schema imports only `zod` (or a sibling schema file) and has unit tests with the payloads of AC9 and the rejected cases of AC2 to AC5; the AI check and the bulk save logic of AC8 are unit-tested without a network. |
| AC11 | The forms keep their current look (layout, dark surfaces, colours, copy, icons); only the controls are shadcn primitives restyled at the usage site; the text and buttons the existing admin e2e rows select on still work. |
| AC12 | `frontend-workflow` (`async-state-and-forms.md`) and `frontend-design` no longer say the admin content forms use controlled state (only the AF-U6 user forms do); `test-quality-strategy` names the new e2e rows; AF-P2 is `Fixed locally, awaiting delivery`. |

### 1.2 Scope and non-goals

- In scope: schemas for the four forms in `lib/schemas/` with unit tests; the course, chapter, lesson and exercise forms and their submit handlers; the two AI handlers of the lessons page and a route-private helper for the AI check and bulk save; parameter types of the write helpers in `lib/supabase.ts` where a field becomes nullable; e2e rows for AC1 to AC6; the skill and record updates of AC12.
- Non-goals:
  - Any write moved into a server action, any RLS, grant, migration, Storage or auth change (master decision 1); `generateQuizFromContent` itself, including its empty-response `return;` (a server action change would add the Codex gate).
  - The course image upload (`addCourse` and `updateCourse` keep their file name, bucket and order), the image preview, and any file type or size rule.
  - Slug format or uniqueness (BL-P12); the exercise form's values after a successful save (they stay as today).
  - Lists, search, filters, pagination, the delete dialogs (U1), data loading, the tabs and the MDX editor component itself.
  - The admin user forms (AF-U6), AF-P3, BL-P9, BL-P10.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Schemas refuse only blank required fields, a missing selection, a non-integer order or price and a negative price (AC9). Text is trimmed except lesson `content`, which is passed unchanged; optional text becomes null only where the column is nullable and every reader already handles null (`courses.description`, `lessons.video_url`, `exercises.explanation`). | A stricter rule refuses a stored value on edit and the admin can no longer save that record; trimming MDX changes rendered content. |
| G2. The writes keep their helpers and arguments (`addCourse`, `updateCourse` with the chosen file, `addChapter`, `editChapter`, `addLesson`, `editLesson`, `addExercise` with the saved lesson id, `editExercise`), and the success and failure toasts keep their text. | A changed write path drops the image upload or the lesson-id check; an e2e row or the Owner's habit relies on a toast that changed. |
| G3. Each submit is guarded by an in-flight ref set before the first await and cleared in `finally`, mirrored in state only to disable the button and show a spinner (`async-state-and-forms.md`, Duplicate-submit guard). | The chapter, lesson and exercise buttons have no pending state today, so a double click inserts two rows. |
| G4. The AI check and bulk save live in a route-private `_lib/` module that imports no Supabase client, React or Next module, takes `addExercise` as a parameter, and returns the outcome the page shows (`frontend-workflow`, Route-private files). | AC8 cannot be unit-tested without the AI key, which no test has. |
| G5. E2E rows write only owned data: rows created through the UI reserve their exact name, title or question through `FixtureScope` first; edit rows edit fixtures from `createCourseFixture`, `createChapterFixture`, `createLessonFixture` and `createExerciseFixture`; no row uploads a course image or calls the AI action. | A row leaves residue the end-of-run audit reports, or changes seed data another spec reads (A1 asserts the seed courses, chapters and lessons). |
| G6. No package is added: the forms use the primitives already in `components/ui/` (`input`, `textarea`, `label`, `field`, `native-select`). | An unplanned dependency without a trial install or a `dependency-updates` row. |

### 1.4 Owner decisions that bind this unit

- Master plan decisions 1 and 4 and the invariants: client-side Zod is UX, RLS stays the enforcement, nothing outside the forms is restyled.
- 2026-11-04: the AI bulk create validates the generated questions with the exercise schema before saving; if any fails, none is saved (AC8).
- 2026-11-04: no slug format rule in this unit; the gap is recorded as BL-P12.
- 2026-11-04: BL-P11 (local minimum password length 8) ships in the same PR as its own commit, with its own verification in the PR body (`planning`, batch).
- No Codex gate: the unit changes no server action, auth call or permission (master plan section 4); a revision that adds one adds the gate.

## 2. Repository facts

Baseline: `cc2d5ff` (`main` after PR 59), checked 2026-11-04.

- Course form: controlled state, no client check; `handlePriceChange` uses `parseFloat`, so `1.5` is sent while `courses.price` is `integer default 0`; `description` is sent as `""` when blank; the save button is disabled by `isSaving` with no ref (`app/admin/courses/coursesclient.tsx:108-174`); `addCourse` returns `{ insertError }` and `updateCourse` `{ error }` (`lib/supabase.ts:270-345`) — AC1, AC2, G2, G3.
- Chapter form: `handleSave` refuses a missing title, a null order or no course with `Vui lòng điền đầy đủ thông tin!`; the order input shows 0 as blank (`value={orderIndex || ""}`) and a cleared input stores `Number("")`, so a blank order is silently saved as 0 today, while AC3 refuses it with a field error; no pending state (`app/admin/chapters/page.tsx:64-97`, `:301-307`) — AC3, G3.
- Lessons page (1020 lines): the lesson form refuses missing title, slug, course or chapter; `addLesson` and `editLesson` turn `video_url` `""` into null and `order_index` `""` into null (`lib/supabase.ts:376-409`); the exercise form refuses a blank question, option or answer, offers answers `a` to `d`, and has no pending state; neither form has one (`app/admin/lessons/page.tsx:140-225`) — AC4, AC5, G3.
- AI handlers: both return without `setIsGenerating(false)` when the action returns nothing (`page.tsx:246-249`, `:280-283`), and the bulk create's map callback has a block body without `return`, so `Promise.all` awaits nothing and the success toast runs first (`:290-303`) — AF-P2, AC7, AC8. `generateQuizFromContent` returns `undefined` when Gemini returns no text and `{ data }` with the parsed JSON otherwise, unchecked (`app/action/gemini.ts`) — AC8.
- Tables: `courses.name`, `slug` not null, no unique slug; `chapters.title`, `course_id` not null, `order_index integer`; `lessons.title`, `slug` (unique), `course_id` not null, `chapter_id`, `content`, `video_url`, `order_index` nullable; `exercises` question, options and `correct_answer` not null text, `explanation` nullable (`supabase/migrations/20261021000000_baseline.sql`) — G1, AC9.
- Readers: `course.description` renders nothing or falls back when null (`app/(main)/course/[slug]/page.tsx:653`, `app/(main)/page.tsx:85`); `explanation` is read only by the admin page; `video_url` is already stored null when blank — G1.
- E2E: the admin session exists; A4 to A9 open these pages, click the edit button of a row (`getByRole("button").first()`), the `Trắc nghiệm` tab and the AI menu; fixtures and their cleanup exist in `__tests__/e2e/service-role.ts:132-174`; A1 reads the seed courses, chapters and lessons — G5, AC11.
- `MdxEditor` takes `value` and `onChange(value?: string)` (`app/components/MdxEditor.tsx`), so the content needs a `Controller` — hypothesis.

## 3. Bounded implementation hypotheses

- Schemas in `lib/schemas/admin-content-forms.ts` (`courseSchema`, `chapterSchema`, `lessonSchema`, `exerciseSchema`), reusing the `blankToNull` pattern of `learner-forms.ts`; number inputs enter as strings and the schema turns them into integers (blank price to 0, blank lesson order to null); `correct_answer` is trimmed and lowercased before the `a` to `d` check, so an AI answer `A` passes — may change if AC9 and G1 hold.
- Each form uses `useForm<z.input, unknown, z.output>` with `reset` when the dialog opens on a record; `register` for inputs and native selects, a `Controller` for the MDX editor; the course image file stays in component state outside the schema — may change if AC1 to AC6 and AC11 hold.
- `app/admin/lessons/_lib/ai-exercises.ts` exports `checkAiExercises(data)` and `saveAiExercises(lessonId, items, addExercise)`; unit tests in `__tests__/unit/ai-exercises.test.ts` cover a valid set, an invalid item, a non-array, a failed save among three and a thrown save — may change if G4 and AC8 hold.
- The lessons page may split each form into a component under `app/admin/lessons/_components/`; lists and data loading stay where they are — may change if the non-goals hold.
- E2E rows in a new `__tests__/e2e/admin-content-forms.spec.ts` on the admin session: `C1` to `C3` (course add with read-back, blank name refused, edit), `H1` to `H3` (chapter), `L1` to `L3` (lesson), `E1` to `E3` (exercise on a fixture lesson), and `D1` (a repeated Enter and a repeated `submit` on each of the four forms write one row each; the lesson save button sits in the dialog header, so it is tied to its form with the `form` attribute) — may change if G5 and AC1 to AC6 hold.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Schemas with unit tests; the course and chapter forms with AC1 to AC3, AC6 and their e2e rows. | `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run test:unit`, `npm run build`, `npm run test:e2e` twice (rows that write), `npm test` once; `npm run format -- <changed paths>` before the self-review. |
| CP2 | The lesson and exercise forms with AC4 to AC6, the AI handlers and helper with AC7 and AC8 and their tests; AF-P2 `Fixed locally, awaiting delivery`. | As CP1. |
| CP3 | Skills and records of AC12; State updated. | `npm run docs:check`; `rg` for "admin forms still use controlled state" and the other replaced lines across `AGENTS.md`, `.claude/` and `docs/` (skill-authoring, Maintaining). |

Every command runs as `fnm exec -- <command>` from the repository root (`AGENTS.md`, Commands).

Verification allocation:

| Guarantee | Layer | Assertion | File / row | Prerequisites |
| --- | --- | --- | --- | --- |
| AC9, AC10 accepted and rejected payloads | unit | each schema's parse result for the AC9 payloads and the AC2 to AC5 rejections; blank to null and to 0 | `__tests__/unit/admin-content-form-schemas.test.ts` | none |
| AC7, AC8 AI check and bulk save | unit | invalid set saves nothing; all saved toasts success; partial failure reports the count; busy cleared | `__tests__/unit/ai-exercises.test.ts` | none (no AI key) |
| AC1, AC2 course | e2e | row read back; blank name shows the error and no row; edit saves | `C1` to `C3` | reserve the course name; `createCourseFixture` |
| AC3 chapter | e2e | row read back; blank order refused; edit saves | `H1` to `H3` | reserve the title; `createChapterFixture` |
| AC4 lesson | e2e | row read back (`video_url` null); no chapter refused; edit saves | `L1` to `L3` | reserve title and slug; `createLessonFixture` |
| AC5 exercise | e2e | row read back (answer, explanation null); no answer refused; edit saves | `E1` to `E3` | `createLessonFixture`, reserve the question; `createExerciseFixture` |
| AC6 single write | e2e | double Enter and two `requestSubmit` calls write one row | `D1` | as above |
| AC11 look | justified manual | screenshots before and after | M1 | dev stack, admin seed user |
| AC8 with the real AI | manual, blocked | the bulk create saves three real questions | M2 | a Gemini key (expired; BL-F9) |

Residual manual matrix (local dev stack, after CP2):

| # | Who | Action | Expected | Needs | Reason |
| --- | --- | --- | --- | --- | --- |
| M1 | admin | open each form (add and edit) at desktop and 375px, light and dark OS scheme; submit with an error | same look as `cc2d5ff`; errors readable on the dark surface | dev stack seed | perceptual comparison |
| M2 | admin | "Điền vào form" and "Tự động thêm 3 câu" on a lesson with content | the form fills; three questions are saved and listed | a working Gemini key | real provider; not possible while the key is expired, recorded as not verified |
| M3 | admin | add a course with an image, edit it with a new image | the image shows on the card | dev stack | the upload path is unchanged and no row uploads |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A schema refuses a stored record on edit (a legacy price, an order of 0, an answer in capitals). | G1; unit tests with those values; `reset` from the loaded record. |
| The lessons page conversion drifts beyond the forms (tabs, lists, the AI menu). | Non-goals; A6, A7 and A9 keep passing; M1. |
| shadcn controls follow the OS colour scheme on the always-dark admin surface. | Colours set at the usage site (`frontend-design`); M1 in a light and a dark OS scheme. |
| A rejected field error is unreadable or hidden in the scrolling lesson dialog. | `FieldError` colour set for the dark surface; M1 at 375px. |
| The AI bulk create cannot be proven end to end without a key. | The logic sits in a unit-tested helper (G4); M2 stays not verified until BL-F9. |

- Rollout runbook: none beyond the delivery workflow; no migration and no hosted step. A merge deploys to production on Vercel.
- Stop when: a form needs a write path change, a server action change or an RLS change; a schema must refuse a value the current UI sends; a generated primitive needs a change outside the usage site.
- Rollback: revert the PR; records saved after the merge hold null instead of `""` for a blank course description or exercise explanation, which every reader handles.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
