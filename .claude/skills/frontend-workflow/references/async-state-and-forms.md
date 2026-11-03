# Async state and forms

Read this before implementing or reviewing an async mutation, optimistic update, form, dynamic field or complex client-state transition. The learner forms and the four auth forms use React Hook Form with a Zod resolver and shadcn controls (Forms with React Hook Form below); only the admin forms still use controlled state until the later units of the app-foundation program convert them, and a form that posts to a server action also keeps the action's own validation (`server-actions`).

## Async behavior

- Disable the affected controls while pending and prevent duplicate submission; guard against a second click before the state update lands (a ref or an in-flight flag), not only by the disabled attribute.
- Show pending, success and a safe error. Wait for the server's confirmation unless an optimistic strategy was approved; if so, define the optimistic state, the confirmation, the rollback, duplicate handling and the failure message.
- Use the action's real result as is (read its shape: `server-actions`, Return contract); never turn an error into a success toast. Show the generic message the action returned, not an exception.
- Handle overlapping and stale responses: ignore a result that belongs to an older request (compare an id or use an aborted flag), and clean up timers, subscriptions and realtime channels on unmount.
- After a mutation, refresh or revalidate data the way the neighbours do (`router.refresh()` or the action's `revalidatePath`) instead of hand-patching several copies.
- The same account can be open in two tabs; an action can be called twice. The server must be repeat-safe (`server-actions`); the client must not assume otherwise.

## Forms

- Required versus optional fields are visible; field errors sit next to the field; server errors are shown separately from local checks.
- Keep what the user typed after a recoverable failure. Trim text, and send `null` rather than `""` for an empty optional field (P16).
- Do not send or trust server-owned fields (user id, role, price, status); the server derives them.
- Keyboard and mobile: labels, enter-to-submit where natural, proper input types.
- Dynamic lists: stable keys (not the array index when items are removed or reordered), keep values on add and remove, keep errors by the item, and submit the intended order. A removal that loses data confirms first (`frontend-design`).

## Forms with React Hook Form

The profile dialog, the course review, the lesson comments (add, and the edit box of one comment) and the lesson notes show the pattern; read one of them before building the next form.

- **Schema.** One Zod schema per form in `lib/schemas/` (the learner forms: `learner-forms.ts`), importing only `zod` so the server can reuse it. It refuses what the database refuses or what is blank, never a value the form sends today: a stored gender or province outside today's lists must still save (trimmed strings, not enums), optional text trims and a blank becomes `null` (`blankToNull`), and there is no length limit the database does not have (a comment is 3 to 999 characters like `comments_content_check`, counted by code point like `char_length`). Messages are short Vietnamese strings next to the schema. Unit tests with the payloads the form sends and each rejected case ship with it (`__tests__/unit/learner-form-schemas.test.ts`).
- **Form.** `useForm<z.input<S>, unknown, z.output<S>>({ resolver: zodResolver(S), defaultValues })`; `defaultValues` come from the loaded record (`""` for a blank), and `reset(values)` loads a record that arrives later. `register` drives the native and shadcn controls (`Input`, `Textarea`, `NativeSelect`), a `Controller` drives a custom control (the star rating), `useWatch` reads a value during render. The `<form>` has `noValidate` and a real submit button, so Enter submits and a disabled submit button blocks Enter too. State that is not a text field (a chosen file) stays in component state, outside the schema.
- **Field errors.** Each control sits in a `Field` with `data-invalid`, an `id` and `FieldLabel htmlFor` (or an `aria-label` when the design has no visible label), `aria-invalid` on the control, and `<FieldError errors={[errors.name]} />` right under it. Errors show on the first submit and update as the learner types.
- **Submit.** The handler receives the parsed (trimmed, nulled) values and keeps its write helper and arguments; ids such as the user id come from the session, never from a field. Call `handleSubmit(save)(event)` from an event handler (`(e) => handleSubmit(save)(e)`): passing a function that reads a ref to `handleSubmit` during render fails the `react-hooks/refs` lint rule.
- **Duplicate-submit guard.** Set an in-flight ref before the first await in `save` and clear it in `finally`; mirror it in state only to disable the control and show the spinner. The resolver runs asynchronously before React Hook Form sets `isSubmitting`, and two Enter presses can both pass a state check before React renders, so neither `isSubmitting` nor the `disabled` attribute is the guard. Do not rely on disabling a registered input while it submits: a disabled control's value is undefined.
- **Failure.** A dialog closes only when the save returned success (`onSave` resolves a boolean): a failed save keeps the dialog open with what was typed and toasts the failure. A thrown error is caught and toasted the same way.
- **Auth forms.** Sign in, sign up (two steps, two forms: the first checks the account fields and hands them up, the second sends everything), forgot password (`app/(main)/login/`) and reset password (`app/auth/reset-password/`) follow the pattern with schemas in `lib/schemas/auth-forms.ts` and the controls of `app/components/AuthFields.tsx`. The `supabase.auth` call stays in the component and is passed to a submit helper in `auth-outcomes.ts` (`reset-outcome.ts` for the reset page), one helper and one pure result function per flow, importing no Supabase client, React or Next module. The helper owns the in-flight flag and the pending state, handles an `error` returned in `{ data, error }` and a rejected call alike, and returns the outcome (message, redirect, whether the values stay), which the component shows and acts on. Never trim a password, give the sign-in password no length rule, and keep the messages that hide whether an email is registered (`server-actions` and the AF-U4 plan, G2 and G3).
- **Tests.** E2E rows in `__tests__/e2e/learner-forms.spec.ts` cover the accepted and the refused path of each form, a repeated Enter and a repeated `submit` event (`form.requestSubmit()` twice in one task) with exactly one row, and the Storage boundary of the avatar: `page.route` fakes the upload on the failure and wiring paths, and one row uploads for real to the test stack and removes its own object (see `test-quality-strategy`).

## States

Implement the meaningful ones: initial, loading, loaded, empty, error, submitting, success, disabled, permission denied, stale or partial data. Check null values, long text, missing images, slow and failed requests, empty collections and repeated actions.
