# AF-U2 detail plan — Zod in server actions

Revision: r2, 2026-11-02. Owner approval: 2026-11-02. Master plan or charter: [plan.md](../../plan.md) (r2), unit AF-U2, branch `feat/af-action-validation`.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: `zod` is a dependency; every server action of master plan Outcome 2 parses its arguments with a shared schema in `lib/schemas/` before it uses them and keeps its result shape; the callers in the app keep working; `server-actions`, `dependency-updates` and `test-quality-strategy` describe what exists.

| ID | Observable result |
| --- | --- |
| AC1 | A caller who posts `enrollCourse`, `generateQuizFromContent`, `createNewUser` or `deleteUserAccount` with an argument of the wrong type, a missing field, an out-of-range number or a value outside the allowed set gets `{ error: <short Vietnamese message> }`, and the action body stops at the parse: it runs no auth check, query, mutation or provider call, so there is no enrollment, no Auth user, no deleted user and no request to Gemini. (The proxy's session refresh, `lib/supabase.proxy.ts:28`, runs before any action and is outside this promise.) The message never contains Zod's issue list, a path or raw input. |
| AC2 | The messages the admin users page shows today stay word for word: `Mật khẩu phải có ít nhất 8 ký tự` for a password under 8 characters and `Vai trò không hợp lệ` for a role other than `user` or `admin`; `generateQuizFromContent` keeps `Nội dung quá ngắn (cần > 50 ký tự).` for content under 50 characters. Any other parse failure returns `Dữ liệu không hợp lệ.` |
| AC3 | Every payload the app sends today passes its schema: a learner enrolls in the free course from its page (`[L5]`); an admin creates a user from `/admin/users` with no avatar and an empty name; an admin deletes a user (`[A8]`); the lessons page's AI fill and AI bulk-create payloads (the lesson content, quantity 1 or 3, and the lesson's `DBExercise` rows as `previousQuestion`) pass the `generateQuizFromContent` schema, reach the prompt (the quantity and each previous question) and, with the provider answering a JSON array, return `{ data }` with that array as today. |
| AC4 | `createNewUser` stores blank optional text as `null`: a user created with an empty name and no avatar has `profiles.full_name` and `profiles.avatar_url` null, not `""`. An avatar URL that is not `http` or `https` is refused (AC1). |
| AC5 | `markAsRead` parses its id and, on invalid input, returns before it creates the session client and still returns nothing; on valid input it updates through the caller's session as today, with RLS as its only ownership check (it calls no auth helper today, and this unit adds none). |
| AC6 | A learner who posts a valid `createNewUser` payload is refused with the existing auth error and no Auth user is created; `enrollCourse`, `generateQuizFromContent`, `createNewUser` and `deleteUserAccount` still run their auth check before every read and write. |
| AC7 | `lib/schemas/` imports only `zod`; each schema has unit tests with the payloads the UI sends and the rejected cases of AC1. |
| AC8 | `server-actions` describes the Zod rules that exist on `main` after this unit (where schemas live, parse before use, the failure message and shape, blank-to-null) in place of its "no Zod yet" paragraph and in its frontmatter description ("server-side validation without a schema library"); `dependency-updates` has a `zod` row; `test-quality-strategy` drops "Zod-specific procedures arrive with the schemas and package in app-foundation U2" and names the schema unit tests; AF-F1 records its AF-U2 part. |

### 1.2 Scope and non-goals

- In scope: `zod` in `package.json` and `package-lock.json`; `lib/schemas/`; the five actions of master plan Outcome 2; unit tests for the schemas; e2e rows (CP2) and the bounded extension of the action caller's worker map; the skill and record updates of AC8.
- Non-goals: the payment and coupon actions (master decision 2); any form, React Hook Form or client-side validation (AF-U3 to AF-U6); the raw error text that actions return from Supabase or Auth after a valid parse (AF-P1); the early `return;` when Gemini answers empty and the busy state of the lessons page (AF-P2); the admin users page's `editUser` path (AF-U6); the actions that take no argument (master plan section 7); any RLS, grant, migration or auth helper change; an `.max()` on text the UI does not limit today.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Each action parses first, then runs its existing auth check (`markAsRead` has none; it keeps creating the session client after the parse), then the rest unchanged; every later line uses only the parsed values. | A value used before the parse, or a later line still reading the raw argument, keeps the hole the parse was meant to close. |
| G2. The exported signatures keep their parameter list and TypeScript types for callers (`enrollCourse(courseId: number)`, `generateQuizFromContent(content, quantity = 1, previousQuestion)`, `createNewUser(formData)`, `deleteUserAccount(userId)`, `markAsRead(notificationId)`); the parse runs on the received values. | A caller in `app/` stops compiling, or an AF-U6 form loses the shape it will share. |
| G3. Object schemas strip unknown keys (Zod's default `z.object`), never `strict`. | The lessons page sends whole `DBExercise` rows as `previousQuestion`; a strict schema refuses every AI call. |
| G4. Schemas in `lib/schemas/` import only `zod`, and each exports its input type with `z.input` or `z.infer` for the callers of later units. | A schema that cannot run in the browser or in NestJS (master invariant). |
| G5. `zod` is added as a dependency with a `^` range like its neighbours, from the version the trial installed (4.6.7). | A dev-only placement breaks the production build; an exact pin differs from the neighbours without a row saying why. |
| G6. A parse failure returns the action's own shape and the message of AC2; the detail is not logged with the raw input. | A leak through the result, or user passwords written to the server log by a failed `createNewUser` parse. |

### 1.4 Owner decisions that bind this unit

- Master plan decisions 1 and 2: server-side Zod covers server actions only; the payment and coupon actions stay out.
- Master plan risk table: parsing before `requireAdmin` or `requireUser` changes what an anonymous caller sees for an invalid payload (a validation error instead of the auth error); accepted.

## 2. Repository facts

Baseline: `60c369a` (`main` after PR 50), checked 2026-11-02.

- Signatures and callers: `enrollCourse(courseId: number)` (`app/action/enroll.ts:57`), called with `course!.id` (`app/(main)/course/[slug]/page.tsx:522`); `generateQuizFromContent(content: string, quantity = 1, previousQuestion: { question: string }[])` (`app/action/gemini.ts:7`), called with the lesson content, `1` or `3`, and the `DBExercise[]` state `exercise` (`app/admin/lessons/page.tsx:244`, `:279`, state at `:83`); `createNewUser({ email, fullName, role, avatarUrl, password? })` (`app/action/user.ts:19`), called with `avatarUrl: previewUrl || ""` replaced by the uploaded URL when a file is chosen, and `fullName` that may be `""` (`app/admin/users/page.tsx:109-143`); `deleteUserAccount(userId: string)` (`user.ts:69`), called with the row id (`users/page.tsx:85`); `markAsRead(notificationId: number)` (`app/action/get-notifications.ts:5`) — AC3, G2, G3.
- `createNewUser` checks the password (`user.ts:29`) and role (`:32`) after `requireAdmin` and returns the two messages of AC2; the page prepends `Lưu người dùng thất bại` (`users/page.tsx:147`) — AC2.
- `generateQuizFromContent` checks the API key before the content (`gemini.ts:12`, `:26`) and returns `Nội dung quá ngắn (cần > 50 ký tự).`; `previousQuestion.length` is read before the null check (`:19`), so a non-array argument throws today — AC1, AC2.
- The profile trigger copies `raw_user_meta_data->>'full_name'` and `'avatar_url'` into `profiles` (`supabase/migrations/20261021131351_h1_block_role_escalation.sql:20-21`), both nullable `text` columns — AC4.
- Seed users have no `avatar_url` in their metadata, so their profiles already hold null; `CustomAvatar` takes `src?: string | null` and renders the fallback when it is falsy (`app/components/CustomAvatar.tsx:6`, `:20`); the profile form reads `full_name || ""` and `avatar_url || ""` (`app/(main)/profile/page.tsx:86-91`) — AC4, risk table.
- `lib/supabase.proxy.ts:34-43` redirects an anonymous request to any `/admin/` path to `/login`, a server action POST included, so the action caller cannot reach the admin pages' actions as `anon`; a signed-in learner's POST reaches the action, as `payment-learner.spec.ts:183` does for `approvePayment` — AC6, `[V3]`.
- `markAsRead` creates the caller's session client and updates `notifications` without an auth helper (`app/action/get-notifications.ts:6-11`); the notification policies of the baseline migration (`supabase/migrations/20261021000000_baseline.sql:904`) limit the update to the receiver — AC5, AC6, G1.
- The proxy calls `supabase.auth.getUser()` for every matched request before the action runs (`lib/supabase.proxy.ts:28`) — AC1 (scope of "nothing is read").
- Owner decision 2026-11-01 (`docs/backlog/future-features.md`, BL-F9): no renewed Gemini key; the provider move to DeepSeek is BL-F9 — residual QA.
- `FixtureScope.reserveAuth` accepts only an email that ends in `@devspace.test` and contains the scope tag (`__tests__/helpers/fixture-ownership.ts:121`); `prepareLearnerEnrollment(courseId)` checks the free course, the learner and the admin, refuses an occupied slot and reserves the learner's enrollment and the admin notification (`__tests__/e2e/service-role.ts:29-46`) — `[V1]`, `[V2]`.
- `markAsRead` has no caller, and the trial build's `.next/server/server-reference-manifest.json` has no entry for it: no page imports it, so today it is not a reachable action endpoint. Master plan Outcome 2 calls it "still a public endpoint"; this plan keeps its schema (AC5, cheap and future-proof once a page imports it) and covers it by unit tests only — AC5, CP2.
- The action caller (`__tests__/helpers/server-action-core.ts:10`) maps only the course page and `/admin/transactions` workers; the trial manifest lists `createNewUser` and `deleteUserAccount` under `app/admin/users/page` and `generateQuizFromContent` under `app/admin/lessons/page` — CP2.
- The e2e build sets `GEMINI_API_KEY` to a placeholder (`__tests__/helpers/e2e-env.ts:21`) and the server guard fails a test that tries a non-local host, so a valid `generateQuizFromContent` call cannot run under e2e; an invalid one must return before the Gemini call — AC1, CP2, residual QA.
- Seed user ids are RFC 4122 version 4 (`supabase/seed.sql`, `11111111-1111-4111-8111-…`), as Auth generates — AC3 (`deleteUserAccount`).
- Trial install on `60c369a` in a detached throwaway worktree (removed afterwards): `npm install zod@^4.6.7` resolved 4.6.7 (published 2026-10-12, MIT, no dependencies), already in the tree as a dependency of `eslint-plugin-react-hooks` through `eslint-config-next`, so the lockfile only marks it direct; a schema file under `lib/schemas/` and `enrollCourse` parsing with `safeParse`: `npx tsc --noEmit` exit 0, `npm run lint` 0 problems, `npm run build` (CI placeholder env) exit 0. No type-only edit was needed — G5.

## 3. Bounded implementation hypotheses

- Files: `lib/schemas/enrollment.ts`, `lib/schemas/quiz.ts`, `lib/schemas/user.ts`, `lib/schemas/notification.ts`, or one file per action area — may change if G4 holds.
- Schemas: positive integers for `courseId` and `notificationId`; `z.uuid()` for `userId`; `z.string()` content with the 50-character rule and its message, `quantity` an integer 1 to 3 with default 1, `previousQuestion` an array of `{ question: string }`; `createNewUser` with `email` trimmed and checked by `z.email()`, `fullName` trimmed with blank to `null`, `role` `z.enum(["user", "admin"])` with the AC2 message, `avatarUrl` trimmed, blank to `null`, otherwise an `http`/`https` URL, `password` a string of at least 8 with the AC2 message — may change if AC1 to AC4 hold and every caller payload passes.
- A small `parseFailure(error)` helper in each action or in `lib/schemas/` that picks the first issue's custom message when it is one of AC2's, otherwise `Dữ liệu không hợp lệ.` — may change if AC2 and G6 hold.
- Unit tests: `__tests__/unit/action-schemas.test.ts` for the schemas; `__tests__/unit/action-parse.test.ts` for the action bodies at their controlled boundaries, with `vi.mock` on `@google/genai`, `@/lib/auth.server` and `@/lib/supabase.server` (`test-quality-strategy`, Mocking: Gemini is outside the subject): `generateQuizFromContent` as an admin with quantity 1 and 3 and full `DBExercise` rows sends a prompt holding the quantity and each previous question and returns `{ data }` with the mocked array; an invalid payload calls neither `requireAdmin` nor the SDK; `enrollCourse`, `createNewUser` and `deleteUserAccount` with a malformed argument each return their expected error without calling `requireUser` or `requireAdmin` or any method of the service-role client during the call (`@supabase/supabase-js` `createClient` mocked, since both files build that client at import); `markAsRead` with an invalid id returns `undefined` without calling `createSupabaseServerClient`, and with a valid id updates through it — may change if the same guarantees are asserted.
- E2e rows (CP2) in a new `__tests__/e2e/action-validation.spec.ts`, using `callAction`, `owned` and `recordMutations`; the worker map gains `app/admin/users/page` → `/admin/users` and `app/admin/lessons/page` → `/admin/lessons`, with the unit test of `findAction` extended — may change if the rows below assert what they say.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | `zod` (G5) with its `dependency-updates` row; `lib/schemas/` (G4) with unit tests (AC7); the five actions parse (AC1, AC2, AC4, AC5, G1 to G3, G6), with the action-level unit tests of section 3 (AC1, AC3, AC5). | `npx tsc --noEmit`; `npm run lint` 0 problems; `npm run build`; `npm run test:unit`; `npm test`; `npm run test:e2e` (existing `[L5]`, `[A8]`, `[A9]` stay green); `npm audit --omit=dev` count unchanged from the baseline. |
| CP2 | The e2e rows below and the worker map extension (AC1, AC3, AC4, AC6). | `npm run test:unit`; `npm run test:e2e` twice; `npm test`. |
| CP3 | Skills and records (AC8): `server-actions` (frontmatter description, Use when paragraph, Validate on the server, Workflow, Checklist), the `zod` row (already in CP1), `test-quality-strategy` Select checks and Server action rows, AF-F1 Status, `progress.md` State; the skill changes follow `skill-authoring` (Maintaining). | `npm run docs:check` (it runs the skill-shape and link checks); each skill claim read against the files after CP2. |

E2e rows (`[V…]`, `action-validation.spec.ts`; each asserts the result shape and the persisted state, and `serverRecords` sees no outbound call and no mail):

- `[V1] enrolling with a malformed course id is refused and enrolls nobody`: `prepareLearnerEnrollment(1)` first (preflight and reservation of the enrollment and notification); as `learner`, `enrollCourse` with `"1"`, `-1` and `1.5`; each returns `{ error: "Dữ liệu không hợp lệ." }`; `learnerEnrollmentCount(1)` stays 0 and no row matches the reserved notification.
- `[V2] creating a user with an invalid field is refused and creates no account`: as `admin`, each case submits a reserved, scope-tagged email: role `owner` (AC2 role message), a 7-character password (AC2 password message) and avatar `javascript:alert(1)` (generic message) with a valid reserved email; and a malformed but reservable address, `<tag>@@devspace.test` (two `@`, so `z.email()` refuses it while `reserveAuth` accepts it), reserved before the call (generic message). After each case no Auth user exists for the exact email submitted.
- `[V3] a learner cannot create a user with a valid payload`: as `learner`, with a reserved email; the existing auth error of `requireAdmin`; no Auth user for that email. An anonymous POST to `/admin/users` is redirected by the proxy before the action runs (section 2), so it has no row.
- `[V4] an admin creates a user from the form with no avatar and no name`: on `/admin/users`, add a user with a reserved email and an 8-character password, no name, no file; `Thêm thành công`; the profile has role `user` and null `full_name` and `avatar_url`; the `owned` scope deletes it.
- `[V5] an admin creates an admin user through the action`: `createNewUser` with role `admin`; `{ success: true, userId }`; the profile role is `admin`; cleaned up by the scope.
- `[V6] deleting a malformed user id is refused and deletes nobody`: as `admin`, `deleteUserAccount` with `"not-a-uuid"` and `42`; the generic message; the three seed users still exist.
- `[V7] a malformed quiz request is refused before Gemini is called`: as `admin`, `generateQuizFromContent` with quantity `0`, quantity `4`, `previousQuestion` `null`, and content of 49 characters (AC2 message); each returns its error; `serverRecords` records no outbound connection.

Not automated, with reasons: a valid `generateQuizFromContent` call through the e2e server would reach Google, which the guard forbids; its application path (parse, prompt, `{ data }`) is covered by the action-level unit test with the SDK mocked (section 3). The live provider's answer stays unverified: the Owner decided on 2026-11-01 not to renew the Gemini key (BL-F9), so this unit asks for no live pass and its merge does not wait on one. `markAsRead` is not an endpoint (section 2), so unit tests only. No manual matrix: every other caller path is an e2e row.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A schema refuses a payload the app sends on production (a numeric id as a string, an empty avatar, extra keys). | Section 2 read every caller; G3; unit tests with the UI's payloads; `[L5]`, `[A8]`, `[V4]` drive the real pages. |
| Blank-to-null changes how a new user's name or avatar shows. | Null is already the seed users' state and every reader handles it (section 2); `[V4]` checks the stored values and that the new user shows in the users list. |
| A failed parse logs a password. | G6. |
| A Next update changes the manifest format the worker map relies on. | Already covered by the action caller's unit test; the map extension is one entry per page. |

- Rollout runbook: none. No migration or hosted step; merging to `main` deploys to Vercel production, so CI is green before the Owner merges.
- Stop when: a caller payload fails a schema and the fix would change the caller (that is AF-U3 to AF-U6 work); an e2e row needs a weaker network or error guard; a skill line would describe something not on `main`.
- Rollback: a revert PR of the unit's merge commit. Users created in the meantime keep null instead of `""` in the two profile columns, which every reader already treats the same.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
