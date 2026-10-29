# Master plan — app-foundation

Revision: r2, 2026-10-28. Roadmap: [ADR 0003](../../adr/0003-app-foundation-program.md), step 3 of [ADR 0001](../../adr/0001-modernization-roadmap.md) as amended. Baseline: `cf8c60b` (`main` after PR 35).

Progress: [progress.md](progress.md). Problems: [problems.md](problems.md). Future features: [future-features.md](future-features.md). Each unit gets a detail plan at `implementation-plans/af-u<n>-<slug>/plan.md` before it starts.

## 1. Goal and outcome

- Goal: every form and confirmation in DevSpace is built on one foundation (shadcn components, React Hook Form and Zod), and every server action that accepts input validates it on the server with a Zod schema that can move to the NestJS backend, without a visual redesign or a change to who may do what.
- Outcome 1: shadcn primitives live in the repo with tokens that keep the current look, and every `window.confirm` (9 call sites, P21) is a named confirm dialog (FEAT-006).
- Outcome 2: every server action outside the payment and coupon flow that takes an argument (`enrollCourse`, `markAsRead`, which has no caller but is still a public endpoint, `generateQuizFromContent`, `createNewUser`, `deleteUserAccount`) parses it with a shared Zod schema before using it, and keeps its result shape.
- Outcome 3: every form in Appendix A uses React Hook Form with a Zod resolver and shadcn controls, shows field-level Vietnamese errors, and blocks duplicate submits; where a server action receives the form, client and server use the same schema.
- Outcome 4: a profile with no date of birth saves (AF-P4, the same bug as security-hotfix P16).
- Outcome 5: the skills describe the new stack in the PR that brings each part (AF-F1): `frontend-design` (shadcn, the confirm dialog), `server-actions` (Zod), `frontend-workflow` (React Hook Form), the package rows of `dependency-updates`, and the matching rows of `test-quality-strategy`. `server-actions` and `frontend-workflow` are extended rather than joined by new skills (agent-workflow D15, D16), and the text is written from this repository: the VocaSpace skill AF-F1 names is off limits (`.claude/rules.md` section 4).
- Size and risk: large and high-risk. It adds runtime dependencies, changes the validation of server actions (one of them creates users with an admin role), rewrites the sign-in, sign-up and password forms, and touches the admin transaction page of the payment flow.

## 2. Owner decisions

1. (2026-10-28) Server-side Zod covers server actions only. Forms that write through the browser Supabase client (`lib/supabase.ts`) get their Zod schema on the client as UX; RLS stays the enforcement, and no write moves into a server action (the techstack migration owns that).
2. (2026-10-28) The payment and coupon actions (`createPendingPayment`, `updatePaymentWithCoupon`, `cancelPayment`, `approvePayment`, `rejectPayment`, `getAllPayments`) and the coupon form of `CoursePaymentModal` stay out; security-hotfix H2-2b rewrites them and may use Zod then.
3. (2026-10-28) The sign-in, sign-up, forgot-password and reset-password forms move to React Hook Form, Zod and shadcn; their `supabase.auth` calls stay unchanged.
4. (2026-10-28) The program is complete when every form in Appendix A is converted, no `window.confirm` remains, and the skills are updated. Nothing outside forms and dialogs is restyled.

## 3. Shared invariants

- A package is added in the unit that first imports it, with its row in the `dependency-updates` table, and from a trial install recorded in that unit's detail plan — prevents unused runtime packages (DM-001 removed `@radix-ui/react-slot` and `class-variance-authority` for this reason) and type fallout found mid-unit (DM-002).
- Shared schemas live in `lib/schemas/` and import only `zod`: no `next`, React, Supabase or server-only module — prevents schemas that cannot run in the browser, in a server action and later in NestJS.
- A server action parses its input before using it and returns its existing result shape; a parse failure returns the action's own error shape with a short Vietnamese message, never Zod's issue list or raw text. `markAsRead` returns nothing today (`app/action/get-notifications.ts:5`), so on invalid input it returns before any query and still returns nothing — prevents broken callers and leaked internals (`server-actions`, Return contract).
- Client-side validation is UX only: the enforcement of every write (RLS, the server action's own checks) is unchanged, and no RLS policy, grant, migration or auth helper changes — prevents treating a browser check as security, and modernizing what the migration replaces (ADR 0001).
- A schema accepts every value the current UI legitimately sends (read from the callers, not guessed), and normalizes blank optional text to `null` — prevents a stricter schema from breaking a working flow, and keeps P16 from coming back.
- Screens keep their current look: shadcn tokens are mapped to the existing palette, and only form controls and dialogs change — prevents a hidden redesign shipped to production on merge.
- Text and placeholders the e2e suite selects on (`Email...` and `Mật khẩu...` on the sign-in form, the `/admin/transactions` confirm handled in `__tests__/e2e/payment-helpers.ts:76-78`) stay, or the test changes in the same PR — prevents a red smoke or a silently weaker test.
- Each converted form gets an e2e row for a successful submit and one rejected field, and the confirm dialog gets cancel and confirm rows, or the detail plan states why one is not practical (`test-quality-strategy`); each shared schema gets unit tests — ADR 0003 asks every unit to add tests where it changes a form or a validation contract.
- A skill line states only what exists on `main` after the unit merges — prevents agents following instructions for code that is not there.

## 4. Units

| Unit | Branch | Outcome | Dependencies | Gate to start or enable |
| --- | --- | --- | --- | --- |
| U1 shadcn base and confirm dialog | `feat/af-confirm-dialog` | 1, 5 (`frontend-design`) | none | Owner approves this plan and the U1 detail plan; Codex gate on plan and diff (new runtime packages, the payment admin page). |
| AF-U2 Zod in server actions | `feat/af-action-validation` | 2, 5 (`server-actions`) | none on U1 | U1 merged (one open unit at a time); Codex gate on plan and diff (server-action validation, admin user creation). |
| AF-U3 Learner forms and React Hook Form | `feat/af-learner-forms` | 3, 4, 5 (`frontend-workflow`) | hard on U1 (controls), AF-U2 (`zod` installed, schema folder) | AF-U2 merged. |
| AF-U4 Auth forms | `feat/af-auth-forms` | 3 | hard on AF-U3 (the form pattern) | AF-U3 merged; Codex gate on plan and diff (auth area). |
| AF-U5 Admin content forms | `feat/af-admin-content-forms` | 3 | hard on AF-U3; soft on AF-U2 (the `generateQuizFromContent` schema) | AF-U4 merged. |
| AF-U6 Admin user forms | `feat/af-admin-user-forms` | 3 | hard on AF-U2 (the `createNewUser` schema), AF-U3 | AF-U5 merged; Codex gate on plan and diff (admin roles and passwords). |

Every unit is one PR with its own detail plan, approved by the Owner before it starts. Units without a Codex gate get one when their detail plan finds a change to a server action, an auth call or a permission. Commit, push, PR creation and merge are separate grants per unit (`.claude/rules.md` section 4).

## 5. Order and rollout gates

1. This plan PR: the master plan, `progress.md`, `problems.md`, `future-features.md`, the Programs row, and the backlog moves (AF-F1, FEAT-006, AF-P4). Self-review, Codex plan gate, then the Owner approves and grants commit, push and PR separately.
2. U1 to AF-U6 in table order, each after the previous merge. No unit has a migration or a hosted database step. A merge to `main` deploys to production on Vercel, so each unit's manual QA runs on the local stack (`frontend-workflow`) and CI is green before the Owner merges; the rollback of a unit is a revert PR.
3. U1 adds the shadcn setup and its packages; the later units add only the components they use.
4. AF-U2 adds `zod`; AF-U3 adds `react-hook-form` and its resolver package; each with its `dependency-updates` row.
5. Program close: State completed, open problems resolved or moved, the backlog reviewed with the Owner (BL-F2 keeps only the rows the units did not cover), the dependency check run, Programs row `closed`.

## 6. Program risks

| Risk | Mitigation |
| --- | --- |
| `shadcn init` rewrites `app/globals.css` (base layer, tokens, the body font) and changes every page, not only forms. | U1 runs the init in a throwaway worktree first, the detail plan lists each change to `globals.css` and keeps only what the components need, and U1 compares screenshots of the public, learner and admin pages before and after. |
| shadcn on Tailwind 4 expects `tw-animate-css`, while the repo loads `tailwindcss-animate` with `@plugin` and uses its classes on 25 lines in `app/`. | U1's trial install decides whether both coexist or the components use the existing plugin; removing `tailwindcss-animate` is out of scope unless the detail plan shows no class breaks. |
| A Zod schema is stricter than what a caller sends today (an empty `avatarUrl`, a numeric id sent as a string), so a working admin or learner flow starts failing on production. | Each schema is written from the real callers, unit-tested with the payloads the UI sends, and each caller is exercised by an e2e row or the manual pass before merge. |
| Moving the parse before `requireAdmin` or `requireUser` (the `server-actions` order) changes what an anonymous caller sees. | Accepted: the result is still an error and leaks nothing; AF-U2 states it and keeps the auth checks before every read and write. |
| The confirm dialog on `/admin/transactions` changes how the payment smoke approves and rejects, so `payment-admin.spec.ts` breaks or stops asserting. | U1 updates `payment-helpers.ts` to click the dialog's confirm button in the same PR, keeps every AP and K row asserting what it asserts today, and runs the full e2e suite. |
| Converting large client pages (`app/admin/lessons/page.tsx` is 981 lines with two forms, an AI button that fills the exercise form and an AI button that creates and saves three exercises) drifts behavior beyond the form. | Units change the form and its submit handler only; data loading and lists stay; the detail plan's QA matrix covers each form's create, edit and error paths. |
| Zod 4, `@hookform/resolvers` and React 19 versions do not fit together. | The trial install of AF-U2 and AF-U3 runs `tsc`, lint and build on the target versions before the plan goes to the Owner. |
| The sign-in form loses a behavior (the error for a wrong password, the redirect to `/` after sign-in at `app/(main)/login/page.tsx:79`, the reset link's `redirectTo` at `page.tsx:184`). | AF-U4 keeps every `supabase.auth` call, its redirect targets and the auth callback (`safeNextPath`) unchanged, and adds e2e rows for the wrong password (BL-F2 M2) and the redirect to `/`. |

## 7. Out of scope

- Moving any write from the browser client to a server action (decision 1); any RLS, grant, migration or auth helper change.
- The payment and coupon actions and the coupon form (decision 2); they stay with security-hotfix H2-2b.
- The `supabase.auth` calls, `proxy.ts` and the auth callback (decision 3).
- Restyling pages, tables, cards or navigation; dark mode; non-form inputs (the Header search, the quiz answers, the try-it editor, list filters).
- The error-message leaks in `enroll.ts`, `user.ts` and their neighbours (AF-P1), and the backlog entries BL-P1, BL-P2 and BL-P3.
- Server actions that take no argument (`getAdminDashboardStats`, `getTopStudents`, `getRecentActivities`, `getAdminCourseChartData`, `getLessonsForAdmin`).

## Appendix A: forms in scope

Read from the code at the baseline. "Client" means the browser Supabase client in `lib/supabase.ts` or `supabase.auth`, guarded by RLS or Supabase Auth.

| Form | File | Write path | Unit |
| --- | --- | --- | --- |
| Profile edit, with avatar | `app/(main)/profile/page.tsx` | client `updateProfile` | AF-U3 |
| Course review | `app/(main)/course/[slug]/page.tsx` | client `reviews` upsert | AF-U3 |
| Lesson comment add and edit | `app/components/LessonComments.tsx` | client `addComment`, `editComment` | AF-U3 |
| Lesson note | `app/components/NoteManager.tsx` | client `createNote` | AF-U3 |
| Sign in, sign up, forgot password | `app/(main)/login/page.tsx` | `supabase.auth` | AF-U4 |
| Reset password | `app/auth/reset-password/page.tsx` | `supabase.auth.updateUser` | AF-U4 |
| Course add and edit | `app/admin/courses/coursesclient.tsx` | client `addCourse`, `updateCourse` | AF-U5 |
| Chapter add and edit | `app/admin/chapters/page.tsx` | client `addChapter`, `editChapter` | AF-U5 |
| Lesson add and edit; exercise add and edit, which one AI button fills (`page.tsx:240`); a second AI button creates and saves three exercises with `addExercise` (`page.tsx:267`) | `app/admin/lessons/page.tsx` | client `addLesson`, `editLesson`, `addExercise`, `editExercise`; action `generateQuizFromContent` | AF-U5 |
| User create, with avatar | `app/admin/users/page.tsx` | client `uploadUserAvatar`, then action `createNewUser` | AF-U6 |
| User edit, with avatar | `app/admin/users/page.tsx` | client `editUser`, `uploadUserAvatar` | AF-U6 |

The confirm dialogs of U1 replace `window.confirm` in `app/admin/chapters/page.tsx`, `app/admin/courses/coursesclient.tsx`, `app/admin/lessons/page.tsx` (3), `app/admin/transactions/page.tsx` (2), `app/admin/users/page.tsx` and `app/components/LessonComments.tsx`. Excluded: the coupon form of `CoursePaymentModal` (decision 2).
