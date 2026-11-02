# AF-U3 detail plan — Learner forms and React Hook Form

Revision: r1, 2026-11-02. Owner approval: 2026-11-02. Master plan or charter: [plan.md](../../plan.md) (r2), unit AF-U3, branch `feat/af-learner-forms`.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the four learner forms of master plan Appendix A (profile edit, course review, lesson comment add and edit, lesson note) use React Hook Form with a Zod resolver, shared schemas in `lib/schemas/` and shadcn controls; they show field-level Vietnamese errors, block duplicate submits and keep their write paths; a profile with no date of birth saves (AF-P4); `frontend-workflow` and the neighbouring skills describe what exists.

| ID | Observable result |
| --- | --- |
| AC1 | A learner whose profile has no date of birth (seed `student`) opens "Chỉnh sửa hồ sơ", changes another field and saves: the toast reads `Cập nhật thành công`, the field is stored and `profiles.dob` stays null (AF-P4). Blank name, gender and province are stored as null, not `""`. |
| AC2 | When the profile save fails (the avatar upload or the update returns an error), the dialog stays open with what the learner entered and the toast names the failure; it closes only after a successful save. |
| AC3 | An enrolled learner submits a review with a rating and text: one `reviews` row for (learner, course) holds that rating and the trimmed text, and the list shows it. Submitting with blank text shows a field error under the text box and writes nothing. |
| AC4 | A signed-in learner sends a comment of 3 to 999 characters after trim: one row is inserted and shown. A comment of fewer than 3 characters shows a field error and inserts nothing; one of 1000 or more cannot be sent (field error), matching `comments_content_check`. Editing a comment follows the same limits and saves the trimmed text. |
| AC5 | A learner adds a note with text: one `notes` row is inserted and listed. A blank note shows a field error and inserts nothing. |
| AC6 | In every form of AC1 to AC5, a second submit while the first is pending (a double click or a repeated Enter) sends nothing: one submit makes at most one write. |
| AC7 | Every value the current UI legitimately sends still passes (master invariant): any name, a gender and province from their lists or blank, a date from the date input or blank, ratings 1 to 5, review and note text of any length that is not blank, and the existing comment duplicate and spam checks keep their messages. No new length limit beyond `comments_content_check` (Owner decision 2026-11-02). |
| AC8 | Each schema in `lib/schemas/` imports only `zod` and has unit tests with the payloads of AC7 and the rejected cases of AC3 to AC5. |
| AC9 | The forms keep their current look (layout, colours, copy, icons); only the controls are shadcn primitives restyled at the usage site, and the course review keeps its dark surface in a light or dark OS scheme. |
| AC10 | `frontend-workflow` and its `async-state-and-forms.md` describe React Hook Form, the Zod resolver, the field error pattern and the duplicate-submit guard as they exist on `main` after this unit; `frontend-design` lists the added primitives and no longer says there is no form library; `dependency-updates` has rows for `react-hook-form` and `@hookform/resolvers`; `test-quality-strategy` names the new e2e rows; AF-F1 records its AF-U3 part and keeps open only the shared client and server contract, which first exists in AF-U6; AF-P4 is `Fixed locally, awaiting delivery`. |

### 1.2 Scope and non-goals

- In scope: `react-hook-form` and `@hookform/resolvers` in `package.json` and `package-lock.json`; the shadcn primitives the forms use (`input`, `textarea`, `label`, `field`, `native-select`, and `separator`, which `field` imports); `lib/schemas/` schemas for the four forms with unit tests; the four forms and their submit handlers; the parameter types of `updateProfile` in `lib/supabase.ts` so it accepts null; e2e rows for AC1 to AC6; the skill and record updates of AC10.
- Non-goals:
  - Moving any write into a server action, or any RLS, grant, migration, Storage policy or auth helper change (master decision 1).
  - The avatar upload itself (`uploadUserAvatar`, its file name and bucket, SH-P10) and any new file type or size rule.
  - The full name in the activation mail (BL-P7, Owner decision 2026-11-02: not merged into this unit).
  - The review list, its average, its pagination and the form emptying its text after a successful submit.
  - The comment list, menus and delete dialog (U1); the note list, jump and delete; the video player.
  - Data loading on the profile page, the transaction history and its filter, which is not a form (master plan section 7).
  - The auth forms (AF-U4) and the admin forms (AF-U5, AF-U6); the shared client and server contract, which first exists when a form posts to a server action (AF-U6, `createNewUser`).
  - AF-P1, AF-P2, AF-P3, BL-P1 to BL-P3.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Schemas accept every value the forms send today (AC7): gender and province stay trimmed strings with blank to null, not enums; dob is an ISO date or blank to null. | A legacy stored value (a gender not in `GENDER_OPTIONS`, a province spelled differently) pre-fills the form and the learner can no longer save anything. |
| G2. The writes keep their helpers and arguments: `updateProfile`, the `reviews` upsert (`onConflict: "user_id, course_id"`), `addComment` and `editComment` (with their spam check), `createNote`; the user id still comes from the session, never from a form field. | A changed write path drops a check the helper does (the 5-minute duplicate check), or a form starts sending an owner id. |
| G3. Each form's submit is guarded by an in-flight flag set before the first await (a ref, not only the disabled attribute or React Hook Form's `isSubmitting`, which is set after the resolver runs), and the control is disabled while pending, including the Enter paths of the comment and note inputs. | The note input's Enter path ignores `isSaving` today (`NoteManager.tsx:165`), and two Enter presses before a state update both pass a state-only check, so duplicate rows are inserted. |
| G4. Generated primitives are edited as `frontend-design` says: `cn` from `@/lib/utils`, `npm uninstall cn` after `shadcn add`, every `dark:` class removed, only `tailwindcss-animate` classes; colours that the page needs are set at the usage site. | `shadcn add` leaves the `cn` package in `package.json`; a `dark:` class follows the OS scheme on a light learner page or a dark course page. |
| G5. E2E rows write only owned data: the profile rows acquire the student's `full_name`, `gender`, `province`, `dob` and `avatar_url` and restore them; review, comment and note rows reserve or create their rows through `FixtureScope` and remove them; no row uploads an avatar (`F9` aborts and `F10` fulfils the upload request). | A row changes seed data another spec reads, or leaves a Storage object that the end-of-run audit reports as residue. |
| G6. Packages are added with `^` ranges like their neighbours, from the versions the trial installed: `react-hook-form` `^7.91.0`, `@hookform/resolvers` `^7.0.1`. | A different version than the trial proved, or an exact pin without a row saying why. |

### 1.4 Owner decisions that bind this unit

- Master plan decision 1: client-side Zod is UX; RLS stays the enforcement and no write moves into a server action.
- Master plan decision 4 and invariants: nothing outside the forms is restyled; text the e2e suite selects on stays or the test changes in the same PR.
- 2026-11-02: the schemas add no length limit beyond what the database already enforces (`comments_content_check`); review and note text only must not be blank.
- 2026-11-02: BL-P7 stays separate; `full_name` keeps its current rule (trimmed, any length).
- No Codex gate: the unit changes no server action, auth call or permission (master plan section 4); a plan revision that adds one adds the gate.

## 2. Repository facts

Baseline: `84d3def` (`main` after PR 52), checked 2026-11-02.

- Profile: `EditProfileModal` keeps `full_name`, `gender`, `dob`, `province`, `avatar_url` as strings defaulted to `""` (`app/(main)/profile/page.tsx:86-92`); `handleSaveClick` awaits `onSave` and then always calls `onClose` (`:108-113`), so a failed save closes the dialog and loses the input; `handleUpdateProfile` sends the strings unchanged and toasts `Lỗi cập nhật: ` with the raw message (`:318-339`) — AC1, AC2.
- `updateProfile(userId, dataUser: { full_name: string; gender: string; dob: string; province: string; avatar_url: string }, newImageFile?)` uploads the file first and returns `{ error: { message: "Lỗi upload avatar" } }` when the upload fails (`lib/supabase.ts:990-1020`); `profiles.dob` is a `date`, the other fields nullable `text` (`supabase/migrations/20261021000000_baseline.sql:413-424`) — AC1, scope (`updateProfile` types).
- Gender options are `male`, `female`, `other` and province options are the `PROVINCES` list in `lib/constants.ts`; the form renders the stored value into a native `<select>` — G1.
- Every reader of `full_name` falls back when it is null (`app/action/payment.ts:295`, `app/(main)/course/[slug]/page.tsx:314`, `app/action/admin-dashboard.ts:125`, the profile page's `displayName`) — AC1 (blank name to null).
- Review: `CourseReviews` renders the form only when `hasEnrolled`; `handleSubmit` returns on blank text with no message, sends the untrimmed text with `user_id` from `supabase.auth.getUser()` and `created_at`, and on success empties the text and refetches (`app/(main)/course/[slug]/page.tsx:162-194`, `:243-282`); `reviews_rating_check` is 1 to 5 and the content column has no limit; the seed has no review because `reviews` is unique on (user, course) (`supabase/seed.sql:110`); the insert policy requires an enrollment (`supabase/migrations/20261031073938_h2_2a_community_write_integrity.sql:7-16`) — AC3, AC7.
- Comments: `comments_content_check` requires `char_length(trim(content)) > 2 and char_length(content) < 1000` (`baseline.sql:193`); `addComment` and `editComment` trim before writing, and `addComment` refuses an identical comment from the same user within 5 minutes with `Bạn thao tác quá nhanh! Vui lòng không spam nội dung cũ.` (`lib/supabase.ts:1038-1090`); `LessonComments` also refuses a duplicate of one of the user's loaded comments with `Bạn đã bình luận nội dung này rồi, vui lòng không spam!` and sends on Enter from a single-line input (`app/components/LessonComments.tsx:91-127`, `:364-374`); `handleUpdate` has no pending state (`:150-160`) — AC4, AC6, G2.
- Notes: `NoteManager` is mounted for every lesson whether or not it has a video, with `player` null when there is none, so the timestamp is 0 (`app/components/LearnClient.tsx:195-199`, `NoteManager.tsx:64`); `handleAddNote` returns on blank text with no message and the Enter path calls it without checking `isSaving` (`NoteManager.tsx:60-75`, `:165`); `notes.content` is `text not null` with no check (`baseline.sql:336-343`) — AC5, G3.
- E2E: the student session is enrolled in the paid course 2 and `T4`/`T5` already open the comments of `/learn/javascript-can-ban/bien-va-kieu-du-lieu` (lesson 3) and create comment fixtures through `createFixture` (`__tests__/e2e/student.spec.ts`, `__tests__/e2e/service-role.ts:108`); `FixtureScope.acquire(table, id, fields, expected)` restores acquired fields and `reserve` records an empty selector (`__tests__/helpers/fixture-ownership.ts:87-118`); the student's seed `dob` is null (AF-P4 evidence) and no spec asserts the student's name (`L4` asserts the learner's); the audit snapshot covers `storage.objects` (`scripts/test-stack/audit.mjs:22`) — G5.
- Trial install (2026-11-02, throwaway worktree at `84d3def`, Node 26.13.0, npm 11.20.0): `npm install react-hook-form@^7.91.0 @hookform/resolvers@^7.0.1` adds both to `dependencies` and `@standard-schema/utils` is already in the lockfile; the lockfile also moves `ajv` 6.15.0 and `json-schema-traverse` 0.4.1 from the root to `eslint/node_modules` and `@eslint/eslintrc/node_modules` (dev only), because the resolver declares an optional peer `ajv@^8`; `npx shadcn@4.23.0 add input textarea label field native-select` created those five files plus `separator.tsx`, imported `cn` from `"cn"` and installed the `cn` package; after `npm uninstall cn`, the import fix and removing the `dark:` classes, a probe form with `useForm<z.input, unknown, z.output>` and `zodResolver` over a schema with a blank-to-null transform, `Field`, `FieldLabel`, `FieldError`, `Input` and `NativeSelect` passed `npx tsc --noEmit`, `npm run lint` (0 problems) and `npm run build` with the CI placeholder env — G4, G6.
- `@hookform/resolvers` 7.0.0 (2026-10-31) is a major only for the TypeBox resolver; 6.x and 7.x keep the Zod resolver and peer `zod ^3.25.0 || ^4.0.0`, matching `zod` 4.6.7 — G6.
- `frontend-design` still says "There is **no form library yet**" and `async-state-and-forms.md` says "There is no form library yet"; AF-F1 lists the AF-U3 part as open (`docs/programs/app-foundation/future-features.md`) — AC10.

## 3. Bounded implementation hypotheses

- Schemas: one file per form or a `lib/schemas/learner-forms.ts` (`profileSchema`, `reviewSchema`, `commentSchema`, `noteSchema`), reusing the `blankToNull` pattern of `lib/schemas/user.ts`; the field messages are short Vietnamese strings defined next to the schemas — may change if AC7, AC8 and G1 hold.
- Each form uses `useForm<z.input<…>, unknown, z.output<…>>({ resolver: zodResolver(…) })`, `register` for inputs and a `Controller` for the star rating; `Field`, `FieldLabel` and `FieldError` place the error under its control; the avatar file stays in component state outside the schema — may change if AC1 to AC6 and AC9 hold.
- The profile dialog stays the hand-written modal; `onSave` returns whether the save succeeded and the dialog closes only then — may change if AC2 holds.
- The comment edit box gets its own small form per edited comment — may change if AC4 and AC6 hold.
- E2E rows in a new `__tests__/e2e/learner-forms.spec.ts` on the student session (`F1` profile without dob, `F2` review submit, `F3` blank review, `F4` comment add and double Enter, `F5` short comment, `F6` comment edit, `F7` note add and double Enter, `F8` blank note, `F9` failed avatar upload, `F10` avatar wiring), with service-role helpers in `service-role.ts` to acquire the profile fields, reserve the student's review on course 2 and read rows back — may change if G5 and the AC rows hold.
- No profile row is rejected through the UI: every profile field is optional and the controls cannot produce an invalid value (lists, a date input), so the profile's rejected-field case is covered by unit tests only — the master invariant allows this with the reason stated.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Packages, primitives, schemas with unit tests, and the profile form with AC1, AC2 and its e2e row; AF-P4 `Fixed locally, awaiting delivery`. | `fnm exec -- npx.cmd tsc --noEmit`, `npm.cmd run lint` (0 problems), `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run test:e2e`; the `package.json` and lockfile diff matches the trial fact. |
| CP2 | The review, comment and note forms with AC3 to AC6 and their e2e rows. | Static checks, `npm.cmd run test:unit`, `npm.cmd run test:e2e` twice (rows that write), `npm.cmd test` once, `npm.cmd run build`. |
| CP3 | Skills and records of AC10; State updated. | `npm.cmd run docs:check`; `rg` for "no form library" and the other replaced lines across `AGENTS.md`, `.claude/` and `docs/` (skill-authoring, Maintaining). |

Every command runs as `fnm exec -- <command>` from the repository root (`AGENTS.md`, Commands).

Verification allocation:

| Guarantee | Layer | Assertion | File / row | Prerequisites |
| --- | --- | --- | --- | --- |
| AC7, AC8 accepted and rejected payloads | unit | each schema's parse result for the AC7 payloads and the AC3 to AC5 rejections; blank to null | `__tests__/unit/learner-form-schemas.test.ts` | none |
| AC1 profile without dob | e2e | toast, `profiles` read back (field changed, `dob` null) | `F1` | acquire and restore the student's four fields |
| AC2 failed save keeps input | e2e | with the avatar upload request aborted by `page.route`, the dialog stays open with the typed name and the toast names the failure; `profiles` unchanged | `F9` | acquire the student's fields; an aborted request writes no Storage object |
| AC1, AC2 avatar wiring | e2e | with the upload request fulfilled by `page.route` (the Storage boundary, outside the form), the saved `avatar_url` is the public URL of the chosen file name | `F10` | acquire `avatar_url` and restore it; no Storage object is written |
| AC3 review | e2e | row read back (rating, trimmed text); blank shows the field error and no row | `F2`, `F3` | reserve (student, course 2) |
| AC4 comment | e2e | one row inserted; short text shows the error and no row; edit saves trimmed text | `F4`, `F5`, `F6` | comment fixtures through `createFixture`; count by owned label |
| AC5 note | e2e | one row inserted; blank shows the error and no row | `F7`, `F8` | reserve or record the student's notes on lesson 3 |
| AC6 single write | e2e | double Enter on comment and note inserts one row | `F4`, `F7` | as above |
| AC9 look | justified manual | screenshots compared before and after | M1 | Owner signs in, or Main uses the saved e2e sessions as in U1 |

Residual manual matrix (local dev stack, after CP2):

| # | Who | Action | Expected | Needs | Reason |
| --- | --- | --- | --- | --- | --- |
| M1 | student | open the profile dialog, the course review form, the comments drawer and the notes dialog at desktop and 375px, light and dark OS scheme | same look as `84d3def`; errors readable under their fields; review form stays dark | dev stack seed | perceptual comparison |
| M2 | student | change the avatar to a real image and save | the new avatar shows on the profile card and in the header | dev stack seed | a real Storage write and image rendering; `F10` fakes the upload response |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A schema is stricter than a stored value, so a learner cannot save. | G1; unit tests with legacy-looking values (an unknown gender, an unlisted province). |
| shadcn controls change the look of the forms (border, height, focus ring) or follow the OS scheme. | G4; usage-site classes keep the current colours; M1 compares before and after. |
| React Hook Form's `register` on the native `<select>` and date input loses the pre-filled value. | `defaultValues` from the loaded profile; `F1` reads back an unchanged field. |
| E2E profile row races another spec that reads the student's profile. | No spec asserts the student's name today (repository facts); the row acquires its fields through `FixtureScope`. |
| `@hookform/resolvers` 7.0.1 is two days old. | The trial proved tsc, lint and build; the Zod resolver did not change in 7.0.0; `npm test` and `npm run test:e2e` run on it before delivery. |

- Rollout runbook: none beyond the delivery workflow; no migration and no hosted step. A merge deploys to production on Vercel.
- Stop when: a form needs a write path change, a server action, or an RLS change; a schema must reject a value the current UI sends; a generated primitive needs a change to a shared component outside `components/ui/`.
- Rollback: revert the PR; no data shape changes, except that profiles saved after the merge hold null instead of `""` for blank fields, which every reader already handles.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
