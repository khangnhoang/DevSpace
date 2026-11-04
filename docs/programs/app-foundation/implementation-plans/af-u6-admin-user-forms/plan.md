# AF-U6 detail plan — Admin user forms

Revision: r3, 2026-11-04 (r2: Codex plan gate PASS in round 2; r3 drops the skill snapshot edits after the Owner's decision on AW-U13). Owner approval: 2026-11-04. Master plan or charter: [plan.md](../../plan.md) (r2), unit AF-U6, branch `feat/af-admin-user-forms`.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the user create and user edit forms of `/admin/users` (master plan Appendix A) use React Hook Form with a Zod resolver and shadcn controls, and the create form shares its rules with `createNewUser` through `lib/schemas/user.ts`. The forms show field-level Vietnamese errors, block duplicate submits, keep their write paths, and can no longer save a role other than `user` or `admin` (AF-P7). `server-actions` states the rule this unit introduces: a form that posts to a server action derives its schema from the action's schema (AF-F1).

| ID | Observable result |
| --- | --- |
| AC1 | An admin opens "Thêm thành viên" and submits an email, a password of 8 or more characters, an optional name and the role `user` (the default): one Auth user exists with a profile whose role is `user`, whose name is the trimmed name or null, and whose avatar is null (with a chosen file, the public URL of the uploaded file name). The toast reads `Thêm thành công`, the dialog closes and the list shows the user. With the role `admin` the profile role is `admin` (the action's promotion, unchanged). |
| AC2 | On the create form, a blank or malformed email, a password under 8 characters, or no role chosen shows a Vietnamese error under that control (`aria-invalid="true"`), and neither the avatar upload nor `createNewUser` is called. |
| AC3 | An admin opens a user's edit form with the row's edit button. The button is named `Sửa người dùng <name or email>` and works when clicked anywhere on it. The email is shown and disabled and there is no password field. Saving a changed name and role updates that `profiles` row. A blank name is stored as null. With a chosen file the avatar becomes the public URL of the uploaded file name; with no file chosen it keeps its stored value, and a blank avatar is stored as null. The toast reads `Sửa thành công`. |
| AC4 | The role select offers `user` and `admin` and a placeholder `Chọn vai trò` with an empty value. Submitting the placeholder shows `Vai trò không hợp lệ` and sends nothing. A stored role outside the two (the dev row AF-P7 found) opens as the placeholder and must be changed before the form saves. Neither form can send another role; `createNewUser` refuses one as it does today (e2e V2). |
| AC5 | Enter in a field submits the form. A second submit while the first is pending (a double click, a repeated Enter, a repeated `submit` event) sends nothing: one submit makes at most one upload and one create or update call. |
| AC6 | A failed save keeps the dialog open with what was typed: an action error toasts `Lưu người dùng thất bại: <the action's message>` (for example `Email này đã được sử dụng.`); a failed edit write toasts `Lưu người dùng thất bại. Vui lòng thử lại.` (today it shows `[object Object]`); a failed avatar upload toasts `Lỗi khi upload avatar user` and calls no save; a request that throws or fails in transit is caught and toasted. The submit button is usable again on every path. While a save is pending the dialog cannot be closed (the close button and `Hủy Bỏ` are disabled and Escape does nothing), so a late result never lands on another user's form. |
| AC7 | The create form's schema is derived from `createUserSchema` and the edit form's schema from its `fullName` and `role`, so client and server apply the same rules. Every payload of `__tests__/unit/action-schemas.test.ts`, `action-parse.test.ts` and e2e V1 to V10 gets the same result as before; Vietnamese field messages added to the schema never reach a caller of the action, which still returns `parseFailure` output. |
| AC8 | The forms keep their current look (modal, dark surface, labels, avatar picker, buttons, copy); the placeholders `helo@gmail.com`, `Tối thiểu 8 ký tự`, `Nguyen Van A` and the buttons `Thêm thành viên`, `Thêm Tài Khoản`, `Lưu Thay Đổi`, `Hủy Bỏ` stay, so rows V4, A1, A3, A8 and A10 pass unchanged. The close control is a button named `Đóng`. |
| AC9 | Tests follow master decision 5. Client-only rules (AC2, AC4, AC5, the edit form's fields and the failure branches of AC6) are covered by component tests. Each integration boundary has an e2e row: the create success without an avatar (V4) and with a faked successful upload, the edit write with a faked successful upload and a read-back, the action's refusal of an email already in use shown in the form, a failed avatar upload, a create request that fails in transit, and an edit write (the PostgREST `PATCH`) that fails in transit. Each AC2, AC4 and AC5 rule fails a component test when it is broken on purpose. |
| AC10 | `server-actions` gains one rule with an example pointer: a form that posts to a server action derives its schema from the action's schema and sends the action's input shape (`lib/schemas/user.ts`, `createUserFormSchema`). No skill gets a list of converted forms or of test rows (agent-workflow AW-U13). AF-P7 is `Fixed locally, awaiting delivery`, and the AF-F1 Status says its last part (the shared client and server contract) is done locally, awaiting the PR. |

### 1.2 Scope and non-goals

- In scope:
  - the derived form schemas and Vietnamese field messages in `lib/schemas/user.ts`, with unit tests;
  - the create and edit form, their submit handler, the edit button's name and click target, and the dialog's close button;
  - component tests and the e2e rows of AC9;
  - the skill and record updates of AC10.
- Non-goals:
  - Any change to the code of `createNewUser` or `deleteUserAccount`; any RLS, grant, migration or Storage policy change. A check constraint on `profiles.role` waits for its own migration (Owner decision 2026-11-04, BL-P14).
  - Blocking an admin from changing their own role (Owner decision 2026-11-04, BL-P15).
  - The upload order: the avatar is still uploaded before `createNewUser`, and the object a failed create leaves behind is not removed (Owner decision 2026-11-04, BL-P16).
  - Editing a user's email or password, and any file type or size rule.
  - The list, search, filters, pagination, stats, data loading and the delete dialog (U1).
  - Closing the app-foundation program: that is a separate docs PR after AF-U6 merges (Owner decision 2026-11-04).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. `createUserSchema` accepts and refuses exactly what it does at the baseline, and its first-issue order stays (`password`, then `role`); the change adds messages and derived schemas only. `lib/schemas/user.ts` keeps importing only `zod` and its sibling. | A stricter or reordered schema changes what `createNewUser` returns to a caller (`parseFailure` keeps only the first issue's message), or a working admin flow breaks on production. |
| G2. The writes keep their helpers and arguments: `uploadUserAvatar(file)` before `createNewUser({ email, fullName, role, avatarUrl, password })`, and `editUser(id, { full_name, avatar_url, role }, null)` with the email never sent. The create call sends the action's input shape, not the form's parsed output: `fullName` is the trimmed name or `""` (the action's schema takes a string and turns a blank into null itself), `avatarUrl` the uploaded URL, the stored one or `""`. The edit call sends null for a blank name or avatar. | `profiles.email` diverges from the Auth email; a create without a name fails because `createUserSchema` refuses `null` for `fullName` (`lib/schemas/user.ts:17`); the avatar or role promotion path changes outside the plan. |
| G3. Each submit is guarded by an in-flight ref set before the first await and cleared in `finally`, mirrored in state to disable the submit button, the close button and `Hủy Bỏ`, to ignore Escape and to show `Đang xử lý...` (`async-state-and-forms.md`, Duplicate-submit guard). | Two quick submits create two Auth users or upload two avatars; a dialog closed and reopened on another user while a save is pending gets a fresh ref, and the old save's success closes the new form and loses what was typed. |
| G4. E2E rows write only owned data. A created email is reserved with `reserveAuth` first. Edit rows edit a `createUserFixture` user, never a seed user (A1 and the RLS suite read the seed roles). Avatar uploads are faked with `page.route` (a failure aborts, a success answers like Storage as `learner-forms.spec.ts` F10 does), so no row writes a Storage object. | A seed user ends up with another role and later rows fail, or the end-of-run audit reports residue. |
| G5. No package is added; the forms use the primitives in `components/ui/` (`input`, `label`, `field`, `native-select`). | An unplanned dependency without a trial install or a `dependency-updates` row. |

### 1.4 Owner decisions that bind this unit

- Master plan decisions 1, 4 and 5 and the invariants: the edit write stays in the browser client under RLS, nothing outside the forms is restyled, and client-only rules are tested by component tests.
- 2026-11-04: no check constraint on `profiles.role` in this unit; recorded as BL-P14.
- 2026-11-04: an admin may still change their own role; recorded as BL-P15.
- 2026-11-04: the avatar keeps being uploaded before the user is created, and an orphaned object is recorded as BL-P16.
- 2026-11-04: the program close is a separate PR after this unit.
- 2026-11-04: skills hold no rollout state; agent-workflow AW-U13 removes the snapshot sentences on its own branch and merges before this unit's CP3, so this unit edits no skill except the one rule of AC10.
- Codex gate on this plan and on the diff (master plan section 4: admin roles and passwords).

## 2. Repository facts

Baseline: `78c80ba` (`main` after PR 61), checked 2026-11-04.

- The users page holds both forms in one controlled modal with no `<form>`, so Enter does not submit. The save button calls `handleSave`, which checks only a blank email and, on create, a password under 8 characters, both with toasts. `isLoading` disables the button, but no ref guards it (`app/admin/users/page.tsx:101-154`, `:445-585`) — AC2, AC5, G3.
- The role select's first option is `<option>Chọn vai trò</option>` with no `value`, so its value is its text, and `editUser` stores it unchanged; `profiles.role` has no check constraint (`page.tsx:539-555`; AF-P7) — AC4.
- Create: the avatar is uploaded with `uploadUserAvatar` and its URL, or `previewUrl || ""`, is sent to `createNewUser` (`page.tsx:112-142`). The action parses `createUserSchema` first and returns `{ error }` or `{ success, userId }` (`app/action/user.ts:21-66`) — AC1, G2.
- Edit: `editUser(editingUser.id, { full_name: name, avatar_url: finalAvatarURL, role }, null)` returns `{ error }` holding a PostgREST error object. The page builds `"Lưu người dùng thất bại: " + result.error`, which reads `[object Object]` for an edit failure. A blank name and a blank avatar are sent as `""` (`page.tsx:125-147`; `lib/supabase.ts:488-504`) — AC3, AC6.
- The edit icon's `onClick` sits on the `SquarePen` SVG inside an unnamed button, so a click on the button's padding does nothing; the close control is an `X` SVG with an `onClick` (`page.tsx:385-390`, `:462-466`) — AC3, AC8.
- `createUserSchema` puts `password` and `role` first so their kept messages win; `email` is `z.email()` with Zod's English default message; `fullName` and `avatarUrl` turn blank into null; `parseFailure` returns a kept message or `Dữ liệu không hợp lệ.` (`lib/schemas/user.ts`, `lib/schemas/parse-failure.ts`) — AC7, G1.
- Readers handle null: `CustomAvatar` renders the fallback for a falsy `src`, and the list shows `Chưa điền họ tên` for a falsy name (`app/components/CustomAvatar.tsx:20`, `page.tsx:358`) — AC3.
- Tests: V2 to V5 and V9 cover `createNewUser` through `callAction` and V4 drives the create form by its placeholders and buttons (`__tests__/e2e/action-validation.spec.ts`). A1, A3, A8 and A10 use the list and the delete dialog (`__tests__/e2e/admin.spec.ts`). `createUserFixture` and `reserveAuth` exist (`__tests__/e2e/service-role.ts:617-638`), and so does the `components` Vitest project (QE-U4) — AC8, AC9, G4.

## 3. Bounded implementation hypotheses

- `lib/schemas/user.ts` adds a Vietnamese message to `email` and exports `createUserFormSchema` (`createUserSchema.omit({ avatarUrl: true })`) and `editUserFormSchema` (`createUserSchema.pick({ fullName: true, role: true })`), with their `z.input` and `z.output` types. Unit tests go in `__tests__/unit/action-schemas.test.ts` — may change if AC7 and G1 hold.
- `app/admin/users/_components/UserFormDialog.tsx` is mounted only while open, with `defaultValues` from the edited user (a stored role outside `user` and `admin` loads as `""`, so the placeholder shows) and the role `user` on create, like `CourseFormDialog`. The chosen file and its preview stay in component state. The page keeps the list and passes `onClose` and a reload callback — may change if AC1 to AC6 and AC8 hold.
- `__tests__/unit/components/UserFormDialog.test.tsx` mocks `@/lib/supabase` (`uploadUserAvatar`, `editUser`), `@/app/action/user` (`createNewUser`) and `sonner`. It covers AC2, AC4, AC5 (one call while a pending promise is open), the create payload of G2 (`fullName: ""` for a blank name), the edit fields of AC3, the failure branches of AC6 and the locked close paths while pending — may change if AC9 holds.
- New e2e rows in `__tests__/e2e/admin-user-forms.spec.ts` on the admin session — may change if G4 and AC9 hold:
  - `U1`: edit a fixture's name and role and choose an avatar with the upload faked as a success, then read the profile back (name, role, the public URL of the uploaded file name);
  - `U2`: the email `learner@devspace.test` shows the action's message, the dialog stays open and no Auth user is added;
  - `U3`: an aborted avatar upload toasts and creates no Auth user;
  - `U4`: an aborted create POST toasts and creates no Auth user;
  - `U5`: an aborted edit `PATCH` of a fixture's profile toasts, keeps the dialog open with what was typed and the submit button usable, and the profile reads back unchanged;
  - `U6`: create a user with a name, the role `admin` and an avatar whose upload is faked as a success, then read the profile back (trimmed name, `admin`, the URL).

  V4 stays the create success row.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Schemas with unit tests, the dialog with AC1 to AC6 and AC8, and the component tests, with the AC9 mutations recorded in State. | `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run test:unit`, `npm run build`; `npm run format -- <changed paths>` before the self-review. |
| CP2 | The e2e rows of AC9. | `npm run test:e2e` twice (the rows write), `npm test` once. |
| CP3 | Starts after AW-U13 is merged into `main` and `main` into this branch (each a git action with its own Owner grant). The `server-actions` rule and the records of AC10, and State updated. | `npm run docs:check`; `rg` for "controlled state" across `.claude/` shows no snapshot line came back. |

Every command runs as `fnm exec -- <command>` from the repository root (`AGENTS.md`, Commands).

Verification allocation:

| Guarantee | Layer | Assertion | File / row | Prerequisites |
| --- | --- | --- | --- | --- |
| AC7, G1 schema contract | unit | derived schemas parse the form payloads; `createUserSchema` results and first-issue messages unchanged | `action-schemas.test.ts`, `action-parse.test.ts` | none |
| AC2, AC4, AC5, AC6, G2, G3 client rules and failures | component | field errors and `aria-invalid`; no upload or save called; one call while pending; the create payload; dialog open after a failure; close paths locked while pending | `UserFormDialog.test.tsx` | none |
| AC1 create persists | e2e | profile read back, without and with an avatar | V4 (existing), `U6` | `reserveAuth`; `page.route` success |
| AC3 edit persists | e2e | name, role and avatar URL read back | `U1` | `createUserFixture`; `page.route` success |
| AC6 action refusal | e2e | message shown, no Auth user added | `U2` | seed email |
| AC6 Storage failure | e2e | toast, no Auth user | `U3` | `page.route` abort, `reserveAuth` |
| AC6 transit failure | e2e | create: toast, no Auth user; edit: toast, dialog keeps values, profile unchanged | `U4`, `U5` | `page.route` abort; `reserveAuth`; `createUserFixture` |
| AC8 look | justified manual | screenshots before and after | M1 | dev stack, admin seed user |

Residual manual matrix (local dev stack, after CP2):

| # | Who | Action | Expected | Needs | Reason |
| --- | --- | --- | --- | --- | --- |
| M1 | admin | open create and edit at desktop and 375px, in a light and a dark OS scheme; submit with errors | same look as `78c80ba`; errors readable on the dark surface | dev stack seed | perceptual comparison |
| M2 | admin | create a user with an avatar, then edit it with a new avatar | the avatar image renders in the list | dev stack | rendering a really uploaded image; U1 and U6 fake the upload (G4) |
| M3 | admin | edit the AF-P7 dev row (role `Chọn vai trò`) back to `user` | the form refuses the placeholder, then saves `user` | the dev row, or one set by the Owner | the stored-bad-role path on real data |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A schema change alters what `createNewUser` returns. | G1; the existing action unit tests and V1 to V10 unchanged and green. |
| An edited user's stored role or name no longer loads into the form. | `defaultValues` from the row; AC4 for a bad role; component test for an edit with a null name. |
| shadcn controls follow the OS colour scheme on the always-dark admin surface. | Colours set at the usage site (`frontend-design`); M1 in both schemes. |
| Admin data loses its integrity through the browser client (a role outside the two). | The forms refuse it (AC4); the database rule is BL-P14. |
| AW-U13 is not merged when CP2 ends, or conflicts with this branch. | CP3 waits for it; CP1 and CP2 touch no skill, so a conflict is limited to the one `server-actions` line. |

- Rollout runbook: none beyond the delivery workflow; no migration and no hosted step. A merge deploys to production on Vercel.
- Stop when: a form needs a write path or server action code change, an RLS or Storage change, or a schema change that alters an action result.
- Rollback: revert the PR. Profiles edited after the merge hold null instead of `""` for a blank name or avatar, which every reader handles.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
