# AF-U4 detail plan — Auth forms

Revision: r4, 2026-11-03 (r3 passed the Codex plan review in round 3; r4 adds the separation of the auth pages, Owner decision 2026-11-03). Owner approval: pending. Master plan or charter: [plan.md](../../plan.md) (r2), unit AF-U4, branch `feat/af-auth-forms`.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the sign-in, sign-up (two steps), forgot-password and reset-password forms of master plan Appendix A use React Hook Form with a Zod resolver, shared schemas in `lib/schemas/` and shadcn controls. They show field-level Vietnamese errors and block duplicate submits. Their `supabase.auth` calls, arguments and redirect targets do not change. The sign-up phone rule is tightened and unknown sign-up errors no longer show Supabase's English text. Inside the auth pages, validation, the handling of each auth result and the presentation are separated (`AGENTS.md` rule 14), with no new auth layer.

| ID | Observable result |
| --- | --- |
| AC1 | A seed user enters their email and password on `/login` and presses "Đăng nhập": the message box reads `Đăng nhập thành công!` and the page goes to `/` (e2e `L1` keeps passing unchanged). With a wrong password the box reads `Email hoặc mật khẩu không đúng`, the page stays on `/login` and the typed email stays; correcting the password then signs in (BL-F2 M2). `email_not_confirmed`, the rate-limit and the thrown-request messages stay as they are. |
| AC2 | On sign in, a blank email, an email the browser's own `type="email"` check refuses (the HTML email rule, which accepts `legacy@localhost`) or a blank password shows a field error under that field and sends no auth request. The password has no length rule on sign in, so an account with a 6-character password can still sign in. No password or confirmation is trimmed in any form; it is sent as typed. |
| AC3 | Sign-up step 1 shows field errors and does not advance for a blank or malformed email, a password under 8 characters (`Mật khẩu phải có ít nhất 8 ký tự`) or a confirmation that differs (`Mật khẩu xác nhận không khớp`); valid values advance to step 2, and "Quay lại bước trước" returns with the step 1 values kept. |
| AC4 | Sign-up step 2 requires a full name that is not blank after trim and a phone of exactly 10 digits starting with `03`, `05`, `07`, `08` or `09` (Owner decision 2026-11-03); `8412345678` and a 9-digit number show `Số điện thoại không hợp lệ (10 số)` and send no sign-up request. Gender stays `male`, `female` or `other`, default `male`. |
| AC5 | A visitor completes both steps with a new email on the local stack (confirmations off): the box reads `Đăng ký thành công! Đang đăng nhập...`, the page goes to `/`, and the new `profiles` row holds the trimmed full name, the phone and the gender. Without a session (hosted with confirmations on) the box still reads the check-your-mail message and the page stays. |
| AC6 | Sign up with an email already registered shows `Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập.` and creates no user. Any other sign-up error shows a Vietnamese message, never Supabase's text: `weak_password` reads `Mật khẩu quá yếu`, a rate limit (`over_email_send_rate_limit`, `over_request_rate_limit` or status 429) reads `Bạn thử quá nhiều lần, vui lòng đợi một lúc rồi thử lại`, and anything else, a thrown request included, reads `Đăng ký thất bại, vui lòng thử lại`, with the detail logged to the console the typed values kept and the button enabled again (Owner decision 2026-11-03). |
| AC7 | On "Quên mật khẩu?", a blank or malformed email shows a field error and sends nothing; a valid email calls `resetPasswordForEmail` with `redirectTo` `${origin}/auth/callback?next=/auth/reset-password` and shows the existing success message, or the existing failure message `Gửi yêu cầu thất bại (Thử lại sau 1p)` on an error. |
| AC8 | On `/auth/reset-password` without a session, the toast `Liên kết không hợp lệ hoặc đã hết hạn.` shows and the page goes to `/login` (unchanged). With a session, a new password under 8 characters or a confirmation that differs shows a field error under its field (today a toast) and calls nothing; a valid one calls `updateUser({ password })` and on success toasts `Khôi phục mật khẩu thành công!` and goes to `/`; `same_password`, `weak_password` and other errors keep their current toasts. |
| AC9 | In every form of AC1 to AC8, a second submit while the first is pending (a double click or a repeated Enter) sends no second auth request, and the submit button is disabled while pending. |
| AC10 | The forms keep their current look (card, blue header, input borders and focus ring, message box, button, icons, copy); only the controls are shadcn primitives restyled at the usage site. "Quay lại đăng nhập" and "Quay lại bước trước" become buttons with the same look, and the password toggles get the names `Hiện mật khẩu` and `Ẩn mật khẩu`. The placeholders `Email...` and `Mật khẩu...` and the button name `Đăng nhập` stay (e2e `L1`, `S6`). |
| AC11 | The schemas live in `lib/schemas/`, import only `zod`, and have unit tests with the accepted and rejected payloads of AC2 to AC4, AC7 and AC8. |
| AC12 | `frontend-design` and `async-state-and-forms.md` say that only the admin forms still use controlled state; `test-quality-strategy` names the new e2e rows; BL-F2 drops the scenarios this unit automates (M2 wrong password, M12 same-password message); AF-F1 is unchanged (its open part is AF-U6). |
| AC13 | Each flow (sign in, sign up, forgot password, reset password) has its own pure function from the auth result to the outcome (message, whether to redirect, whether the values stay) and its own submit helper that receives the auth call as a parameter. The helper handles both channels: an `error` returned in `{ data, error }` goes to that flow's function, and a thrown or rejected call shows that flow's generic message with the values kept; in every case the in-flight guard and the pending state are released. Messages with different meanings stay apart (a wrong password and an email already registered never share a message), and G3 holds for sign in and forgot password. Unit tests cover, per flow, each mapped error code, each success branch (sign up: with a session, without one, `identities` empty) and a thrown call. |

### 1.2 Scope and non-goals

- In scope: `app/(main)/login/page.tsx` (three views and the two sign-up steps) and the files it is split into under `app/(main)/login/`, `app/auth/reset-password/page.tsx` and its helper beside it, schemas in `lib/schemas/` with unit tests, e2e rows with their service-role helpers, and the skill and record updates of AC12.
- Non-goals:
  - Any change to a `supabase.auth` call, its arguments, its redirect target or the timing of the redirect after success (master decision 3); `app/auth/callback/route.ts`, `safeNextPath`, `proxy.ts`, `lib/supabase.ts` and the auth helpers.
  - The `handle_new_user` trigger, profiles RLS, Auth configuration (`supabase/config.toml`, hosted settings) and the password rule of Supabase itself.
  - Any new package or font; a new shadcn primitive only if a form cannot be built from the nine in `components/ui/` (then by `frontend-design`).
  - The sign-in redirect honouring a `next` parameter, social sign-in, a password strength meter, a "remember me" option.
  - The activation mail (BL-P6, BL-P7), the avatar menu after sign in (BL-P3), the signup-link PKCE problem in security-hotfix (`problems.md`, the P14 entry).
  - The admin forms (AF-U5, AF-U6) and AF-F2 (unsaved-input warning).
  - An auth service, client wrapper or other layer around `supabase.auth`, which the techstack migration replaces (`AGENTS.md`, roadmap); one submit helper shared by the four forms; moving the auth helpers into `lib/`. The `supabase.auth` calls stay in the components and are passed to the helpers.
  - `AGENTS.md` rule 14 itself: it lands in its own `chore(agent-rules)` commit before CP1, outside the implementor's checkpoints.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The auth calls stay exactly as at the baseline: `signInWithPassword({ email, password })`; `signUp` with `options.data` `{ full_name, phone, gender }` and `emailRedirectTo` `${window.location.origin}/auth/callback`; `resetPasswordForEmail` with the `redirectTo` of AC7; `updateUser({ password })`; the `getSession` check. After success, sign in calls `router.refresh()` then `router.push("/")` after 1000 ms and sign up with a session the same after 2000 ms; reset calls only `router.push("/")` after 1500 ms, with no refresh. | A changed redirect breaks the hosted PKCE mail flows, which the local e2e cannot drive end to end. |
| G2. The sign-in password has no length or format rule, only "not empty", and no password is trimmed; the sign-in email rule is the HTML email rule the browser applied, not the stricter sign-up regex. | An existing account with a 6- or 7-character password (allowed before H1 and by `minimum_password_length = 6`), a password with edge spaces, or an address such as `legacy@localhost` can no longer sign in. |
| G3. The messages that hide whether an email is registered stay as they are: the generic sign-in error and the forgot-password success, which is shown for any accepted request. | The form reveals which emails have accounts. |
| G4. Each form's submit is guarded by an in-flight ref set before the first await, not only by the disabled attribute or `isSubmitting`; the forms set `noValidate` so the Vietnamese field errors replace the browser's own bubbles. | Two quick Enter presses send two auth requests and hit the 30-per-5-minutes sign-in limit sooner; the browser bubble shows in English. |
| G5. E2E rows never change a seed user's password or profile: the sign-up row reserves its email with `FixtureScope.reserveAuth` and deletes the user; the reset row uses `createUserFixture`; the forgot-password rows fulfil or hold the `/auth/v1/recover` request with `page.route`, because the local stacks send no mail (`[local_smtp] enabled = false`, no SMTP configured) and a row must not depend on what Auth does without a mailer. Failure paths abort a request with `page.route`, never answer with a 5xx, which the network guard fails. | `L1` and the `rls` setup fail to sign in; a row passes or fails by what local Auth does without a mailer; a 5xx stub fails the run. |
| G6. Generated or reused primitives are edited as `frontend-design` says (`cn` from `@/lib/utils`, no `dark:` class, `tailwindcss-animate` classes only), and colours are set at the usage site. | The light login card follows a dark OS scheme. |
| G7. The per-flow functions and helpers import no Supabase client, React or Next module, so the unit tests run them without a network or a DOM. | A helper that imports `lib/supabase.ts` needs the environment in unit tests, or the tests mock the module and no longer prove the mapping. |

### 1.4 Owner decisions that bind this unit

- Master plan decision 3: the four auth forms move to React Hook Form, Zod and shadcn; their `supabase.auth` calls stay unchanged.
- Master plan decision 4 and invariants: nothing outside the forms is restyled; text the e2e suite selects on stays or the test changes in the same PR; each converted form gets an e2e row for a successful submit and a rejected field.
- 2026-11-03: the sign-up phone rule becomes `^0[35789]\d{8}$` (AC4).
- 2026-11-03: sign-up errors other than "email taken" are mapped to Vietnamese messages (AC6).
- 2026-11-03: separation of concerns applies inside the auth pages only (AC13), with one result function and one submit helper per flow, no shared helper and no auth layer; `AGENTS.md` gains rule 14 as a general principle.
- Codex gate on this plan and on the implementation diff (master plan section 4, auth area).

## 2. Repository facts

Baseline: `186530e` (`main` after PR 57), checked 2026-11-03.

- `app/(main)/login/page.tsx` (462 lines) holds the views `login`, `register` (steps 1 and 2) and `forgot` in one `<form onSubmit={handleSubmit}>` with `useState` fields and one `message` box (`:14-42`, `:203-218`, `:389-395`); `switchView` clears only the email and password (`:220-226`) — AC1 to AC7, AC10.
- Sign in checks only that both fields are filled, then maps `email_not_confirmed`, a 429 or `over_request_rate_limit`, and every other error to the generic message (`:45-85`); the inputs have `type="email"` without `noValidate`, so the browser's HTML email rule blocks a malformed email today; that rule accepts `legacy@localhost`, which the step 1 regex refuses (Zod's `html5Email` regex, `node_modules/zod/src/v4/core/regexes.ts:47`, matches the browser) — AC1, AC2, G2, G3, G4.
- Step 1 checks email with `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, password length 8 and the confirmation (`:24-26`, `:88-111`); step 2 requires name and phone and tests `/(84|0[3|5|7|8|9])+([0-9]{8})\b/g`, which accepts `8412345678`; the phone input keeps digits only with `maxLength={10}` (`:18-22`, `:113-124`, `:368-375`) — AC3, AC4.
- `handleSignUp` treats `user_already_exists`, or a user with no identities, as "email taken", shows `error.message` raw for any other error, and has no try/catch, so a thrown request leaves `loading` true (`:128-169`) — AC6.
- `handleForgotPassword` sends `redirectTo` `${window.location.origin}/auth/callback?next=/auth/reset-password` (`:171-200`) — AC7, G1.
- "Quay lại đăng nhập" and "Quay lại bước trước" are clickable `div`s (`:287-292`, `:356-361`); the password toggles have no name; the inputs are styled by a `<style jsx>` `.input-field` class (`:437-459`) — AC10.
- `app/auth/reset-password/page.tsx` (176 lines) checks `getSession` on mount, validates with toasts, maps `same_password` and `weak_password`, and pushes `/` after 1500 ms with no `router.refresh()` (`:19-72`) — AC8, G1.
- The sign-in form and the reset page do not trim the password; the e2e network guard fails a test on any response with status 500 or more (`__tests__/e2e/fixtures.ts:75`), and `learner-forms.spec.ts` (`:170`) shows the double-`requestSubmit()` pattern for an in-flight guard — G2, G4, G5.
- `lib/schemas/user.ts` holds the admin `createUserSchema` with `PASSWORD_TOO_SHORT_MESSAGE` from `parse-failure.ts`, the same text as the sign-up rule; `lib/schemas/learner-forms.ts` shows the AF-U3 pattern (messages exported next to the schemas, `z.input`/`z.output` types) — AC11.
- Local Auth (`supabase/config.toml`): `enable_confirmations = false`, `minimum_password_length = 6`, `sign_in_sign_ups = 30` per 5 minutes; `[local_smtp] enabled = false` and `[auth.email.smtp]` is commented out, so neither local stack has a mail inbox (`:104-107`, `:198-201`); `handle_new_user` copies `full_name`, `phone` and `gender` from the metadata into `profiles` (`supabase/migrations/20261021131351_h1_block_role_escalation.sql:9-28`), and `profiles.id` cascades on delete of the Auth user — AC5, G2, G5.
- E2E: `auth.setup.ts` (`L1`) signs in through `Email...`, `Mật khẩu...` and the `Đăng nhập` button and waits for `/`; `public.spec.ts` `S6` checks the two placeholders; `service-role.ts` has `createUserFixture` (a confirmed user with a known local password) and the scope's `reserveAuth`, which refuses an email outside the scope — AC10, G5.
- `frontend-design` and `async-state-and-forms.md` say the auth and admin forms still use controlled state; BL-F2 lists M2 (wrong-password recovery) and M12 (same-password message) as outstanding — AC12.
- No package is added: `input`, `label`, `field`, `native-select` and `button` exist in `components/ui/`, and `react-hook-form`, `@hookform/resolvers` and `zod` are dependencies; no trial install is needed.

## 3. Bounded implementation hypotheses

- Schemas in `lib/schemas/auth-forms.ts`: `signInSchema`, `signUpAccountSchema` (step 1, with a refine on the confirmation), `signUpProfileSchema` (step 2), `forgotPasswordSchema`, `resetPasswordSchema`, with the HTML email rule on sign in and the baseline regex on sign up and forgot password, no trim on passwords, and reusing `PASSWORD_TOO_SHORT_MESSAGE` — may change if AC2 to AC4, AC7, AC8 and AC11 hold.
- `page.tsx` under `app/(main)/login/` keeps the `view` state and renders one component per view (`SignInForm`, `SignUpForm` with its two steps, `ForgotPasswordForm`), each with its own `useForm`; the per-flow result functions and submit helpers sit in a module beside them (for example `auth-outcomes.ts`), and the reset page's beside it in `app/auth/reset-password/`; switching view resets the forms, which also clears the confirmation and step 2 fields that `switchView` keeps today (accepted: AC3 keeps only the step 1 values when going back from step 2) — may change if AC1 to AC7 hold.
- Server-side errors stay in the existing message box (login page) and toasts (reset page); field errors sit under their control with `Field` and `FieldError` — may change if AC1 to AC8 and AC10 hold.
- `Input` replaces the `.input-field` class with usage-site classes of the same border, padding, radius and focus ring, and the `<style jsx>` block goes if nothing uses it — may change if AC10 holds.
- E2E rows in a new `__tests__/e2e/auth-forms.spec.ts` on an anonymous context: `AU1` wrong password, `AU2` blank and malformed sign-in fields with no token request, `AU3` sign up and profile read-back, `AU4` step 1 and step 2 rejections including `8412345678`, `AU5` email taken, `AU6` forgot password (blank and malformed email with no recover request, then a valid one with the request fulfilled and its `redirect_to` asserted), `AU7` reset password for a fixture user (mismatch, same password, success), `AU8` reset page without a session, `AU9` per auth form (sign in, sign up step 2, forgot, reset): `page.route` holds the first request, a double Enter and two `requestSubmit()` in one task send one request with the button disabled, then aborting it re-enables the form with the values kept (for sign up this is AC6's failure path), `AU10` sign up with the signup response fulfilled as a user without a session (the check-your-mail branch of AC5) — may change if G5 and every AC row hold.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Schemas with unit tests; the login page split into its view components; the result functions and submit helpers of sign in and forgot password with their unit tests; sign in and forgot password on React Hook Form with AC1, AC2, AC7, AC9 for those views; rows `AU1`, `AU2`, `AU6` and the sign-in and forgot parts of `AU9`. | `fnm exec -- npx.cmd tsc --noEmit`, `npm.cmd run lint` (0 problems), `npm.cmd run test:unit`, `npm.cmd run test:e2e`. |
| CP2 | The result functions and submit helpers of sign up and reset password with their unit tests; sign up and reset password with AC3 to AC6, AC8, AC9; rows `AU3`, `AU4`, `AU5`, `AU7`, `AU8`, `AU10` and the sign-up and reset parts of `AU9`; AC10 across the four forms. | Static checks, `npm.cmd run test:unit`, `npm.cmd run test:e2e` twice (rows that write), `npm.cmd test` once, `npm.cmd run build`. |
| CP3 | Skills and records of AC12; State updated. | `npm.cmd run docs:check`; `rg` for "auth and admin forms" and the replaced lines across `AGENTS.md`, `.claude/` and `docs/` (skill-authoring, Maintaining). |

Every command runs as `fnm exec -- <command>` from the repository root (`AGENTS.md`, Commands).

Verification allocation:

| Guarantee | Layer | Assertion | File / row | Prerequisites |
| --- | --- | --- | --- | --- |
| AC2 to AC4, AC7, AC8 rules; AC11 | unit | each schema's result for accepted and rejected payloads, including `8412345678`, a 6-character sign-in password, a password with edge spaces kept as typed and `legacy@localhost` on sign in | `__tests__/unit/auth-form-schemas.test.ts` | none |
| AC1 success | e2e | `L1` unchanged for the three seed users | `auth.setup.ts` | none |
| AC1 wrong password; G3 | e2e | generic message, URL `/login`, email kept; the right password then reaches `/` | `AU1` | the learner seed email |
| AC2 | e2e | field errors, no `/auth/v1/token` request | `AU2` | none |
| AC3, AC4 | e2e | field errors, no step change or no `/auth/v1/signup` request | `AU4` | none |
| AC5 with a session | e2e | URL `/`, `profiles` row read back | `AU3` | `reserveAuth` on a scoped email; the user is deleted |
| AC5 without a session | e2e | check-your-mail message, URL stays `/login` | `AU10` | `page.route` fulfils `/auth/v1/signup` with a user and no session; nothing is written |
| AC6 email taken | e2e | message, no new `auth.users` row | `AU5` | the student seed email |
| AC6, AC13 per-flow outcomes | unit | per flow: each mapped error code, each success branch and a thrown call give the right message, redirect decision and kept values, and the guard and pending state are released; sign in never reveals whether an email is registered | `__tests__/unit/auth-outcomes.test.ts` | G7: the auth call is a stub passed in |
| AC6 failure recovery | e2e | after the held signup request is aborted: the generic message, values kept, button enabled | `AU9` (sign up) | `AU9` covers an error that supabase-js returns (it turns an aborted request into `AuthRetryableFetchError`); the rejected-promise path (`signUp` rethrows a non-Auth error) is covered by the thrown case of `auth-outcomes.test.ts` |
| AC7 | e2e | blank and malformed email: field error, no recover request; valid: request query `redirect_to`, success message | `AU6` | `page.route` fulfils the recover request (G5) |
| AC8 | e2e | field errors; `same_password` toast; success toast and `/`; no-session redirect | `AU7`, `AU8` | `createUserFixture`, signed in through the form |
| AC9 | e2e | per form: one auth request after a double Enter and two `requestSubmit()` in one task, button disabled while the request is held | `AU9` | `page.route` holds then aborts the request, so it never reaches Auth; the reset part signs in its own `createUserFixture` user through the form first |
| AC10 look | justified manual | screenshots before and after | M1 | dev stack |

Residual manual matrix (local dev stack, after CP2):

| # | Who | Action | Expected | Needs | Reason |
| --- | --- | --- | --- | --- | --- |
| M1 | visitor and a fixture user | open the four forms and both sign-up steps at desktop and 375px, light and dark OS scheme, with and without field errors | same look as `186530e`; errors readable under their fields | dev stack | perceptual comparison |

Not verified by this unit: the real reset mail link through `/auth/callback`. Neither local stack sends mail and enabling an inbox is an Auth configuration change (out of scope). The unit does not touch that leg: the `redirectTo` it passes is held by G1 and asserted by `AU6`, the callback is unchanged, and `AU7` covers the reset page with a session. The check is not a merge blocker.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A rule is stricter than what a user sends today and blocks sign in. | G2; the sign-in schema checks only non-empty fields and the HTML email rule the browser already enforced; unit tests with a 6-character password, a password with edge spaces and `legacy@localhost`. |
| A changed redirect or call breaks a hosted mail flow that local tests cannot drive. | G1; `AU6` asserts the `redirect_to` sent; the Codex diff gate compares the calls with the baseline. |
| The new e2e rows push the local sign-in or mail limits. | G5: six extra sign-in and sign-up requests per run (`AU1` two, `AU3`, `AU5`, `AU7` and the sign in before the reset part of `AU9`) plus the three of `L1`, nine in all, against 30 per 5 minutes; the held requests of `AU9` and `AU10` never reach Auth; no row sends mail. |
| Resetting the forms on a view switch loses input a visitor expected to keep. | Today's `switchView` already clears email and password; AC3 keeps the step 1 values on "Quay lại bước trước". |

- Rollout runbook: none beyond the delivery workflow; no migration and no hosted step. A merge deploys to production on Vercel.
- Stop when: a form needs a change to an auth call, its arguments or redirects; a schema must reject a value an existing account needs to sign in; a server action, RLS or Auth configuration change appears necessary.
- Rollback: revert the PR; no data shape changes.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
