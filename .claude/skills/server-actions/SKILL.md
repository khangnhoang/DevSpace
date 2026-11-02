---
name: server-actions
description: "Rules for DevSpace server actions in app/action and any server-side request handler: public POST endpoints, auth and ownership inside the action, never trusting client ids or prices, service-role use, server-side validation with the shared Zod schemas in lib/schemas, return contract, uploads, duplicate submits and state transitions. Use when adding, changing or reviewing a server action or the data it accepts."
---

# Server actions

## Use when / do not use when

Use when a task adds, changes or reviews a file in `app/action/`, a route handler, or any server code that accepts input from the browser (form values, ids, prices, file names, upload paths), or the result shape a client component consumes.

Do not use for UI-only state that never crosses to the server. For the database side (policies, RPCs, grants) also use `supabase-migration`; for the screen using the action use `frontend-workflow`.

Server actions validate with Zod: `zod` is a dependency and the shared schemas live in `lib/schemas/` (see Validate on the server). The payment and coupon actions (`app/action/payment.ts`) do not parse with Zod yet: security-hotfix H2-2b rewrites them, so validate by hand there until it does. There is no React Hook Form yet; the form contracts that share a schema between a form and an action arrive with the later units of the app-foundation program ([ADR 0003](../../../docs/adr/0003-app-foundation-program.md)), which extends this skill. Do not add another validation library, or a form library, inside an unrelated task.

## Core rules

- A function in a `"use server"` file is a **public POST endpoint**. Anyone can call it with any arguments, whether or not your UI exposes it. Treat every argument as hostile.
- **Authenticate and authorize inside the action**, every time, with `lib/auth.server.ts`: `requireUser()` for a signed-in user, `requireAdmin()` for admin (role read from `profiles` with the caller's own session, never from `user_metadata`), `requireCourseAccess()` for enrolled access. Do this before any read or write. A check that exists only in the page or component is no check. `requireUser()` and `requireAdmin()` return `{ user } | { error }`; map the error into the action's own result shape. `requireCourseAccess()` is for pages: it returns `{ user, course, isAdmin }`, `{ redirect }` or `{ notFound }`, and the page calls `redirect()` or `notFound()`.
- **Never trust client-sent ids, owners, roles, statuses, prices, discounts, counters or paths.** Derive them on the server: the user id from the session, the price from the course row, the discount from the coupon row, the status from the current row. Check that the target row belongs to the caller (ownership) or that the caller is admin.
- **The service role bypasses RLS.** `lib/supabase.admin.ts` (and any `createClient` with `SUPABASE_SERVICE_ROLE_KEY`) is server-only and may be used only after the action has done its own authorization. Prefer the caller's session client (`lib/supabase.server.ts`) when RLS can enforce the rule. Never import the service-role client from client code, never return its rows unfiltered.
- **Validate on the server with a schema.** Every argument is parsed with `safeParse` against a schema from `lib/schemas/` before anything uses it, and every later line uses only the parsed value, never the raw argument. The exported signature keeps its parameter list and types, so callers compile unchanged; the parse runs on the values received. A schema file imports only `zod` (or a sibling schema file), so it can run in the browser and in a future backend, and exports its input type with `z.input`. Object schemas strip unknown keys (Zod's default `z.object`); never `strict`, because a caller may send a whole database row where the action needs two fields. A schema accepts every value the UI really sends (read the callers) and states ranges and allowed sets. Client-side checks are UX, not enforcement.
- **Normalize empty strings to `null`** for nullable columns (a blank date of birth sent as `""` breaks a `date` column, P16). Trim text; reject blank required text. In a schema this is a transform, as `fullName` and `avatarUrl` of `createUserSchema` do.
- **Order:** parse the input, authenticate, authorize and check ownership, check the current state, mutate, then side effects (email, notifications). Do not send mail or notify before the mutation succeeded. Parsing first means a caller who is not signed in and sends a malformed argument sees the validation error instead of the auth error; that is accepted, and the auth check still runs before every read and write.

## State transitions and duplicates

- Write a transition so a repeat is harmless: filter on the expected current state in the write (`update ... eq("id", id).eq("status", "pending")`) and treat zero rows as "already handled" (P25: approving or rejecting a processed order must not run twice).
- Mutations that must go together (a payment status and its enrollment) belong in one database operation; otherwise a half-failure leaves them inconsistent. Do not ignore the error of the second write.
- Guard duplicate submits on the client too (`frontend-workflow`), but the server guard is the one that counts.

## Return contract

The most common shape is `{ error: string }` on a failure and `{ success: true, ...data }` on success, so callers test `"error" in result`, but shapes vary: `app/action/admin-dashboard.ts` returns `null` or arrays, `gemini.ts` returns `{ data }`, `get-notifications.ts` returns nothing. Read the action's real shape and every caller first, and keep a boundary's contract unless the task changes it (then update the callers in the same change). A parse failure returns the action's own failure shape (`markAsRead` returns nothing, before it creates its client) with `parseFailure(error)` from `lib/schemas/parse-failure.ts`: the generic `Dữ liệu không hợp lệ.`, or the one first-issue message that the admin pages already show (password length, role, quiz content length), which is listed in that file; a new message that must reach the user is added to that list. Never return Zod's issue list, a path or the raw input, and never log a parse failure with its input (a failed `createNewUser` parse holds a password). The helper lives in `lib/schemas/` because a `"use server"` file may export only async functions. Messages are short, natural Vietnamese and generic enough to leak nothing. Do not return raw exceptions, stack traces, SQL or Supabase error text, secrets or full rows. Log the detail on the server instead. Do not turn an error into a fake success.

## Boundaries validation does not cover

Checking a value's shape does not make it safe to use elsewhere:

- **SQL:** use the Supabase query builder or RPC arguments. Never build SQL from strings, and never write a regex that tries to detect SQL injection.
- **XSS:** user-written text, HTML or markdown (comments, notes, reviews, profile fields) is escaped on output or sanitized by the repository's established policy before it is rendered as HTML. Lesson MDX is admin-authored content, not a place to render user input.
- **CSRF:** Next.js checks the `Origin` header for server actions. A route handler (`route.ts`) has no such check, so it must not make a business mutation on `GET`, and must authenticate and verify the request itself. Protocol callbacks, such as the PKCE auth callback that exchanges a code for a session, are the exception: they verify their protocol inputs (code, verifier, allowlisted redirect).

## Uploads, payments and external callbacks

Read [uploads-and-payments.md](references/uploads-and-payments.md) when the work reads or writes a file, a Storage path, a payment or coupon, an email link or an external callback. Skip it for ordinary CRUD.

## Workflow

1. Read the action, its callers and the data it touches (and the policies and grants if the database is involved). Note what the UI hides but the endpoint still allows.
2. List the arguments and, for each, who controls it and what the server derives instead.
3. Write the schema in `lib/schemas/` (or extend one), parse first in the action, then the checks in the order above, reusing the helpers in `lib/auth.server.ts`. Do not add a second auth helper.
4. Keep changes surgical. Do not rename actions or reshape results used by other components unless the task says so.
5. Map validation, actor/ownership, state-transition and persistence guarantees to tests under [test-quality-strategy](../test-quality-strategy/SKILL.md#select-checks-from-the-contract), then run its server-action commands. Use hostile-call reasoning to find cases (direct call, another user, anon, twice, wrong id); reasoning is not execution evidence. Plan bounded missing worker/fixture support with the feature or report its concrete blocker/resolution. Assert the actor response and unchanged/persisted data where applicable; report each unrun probe honestly.

## Anti-patterns

Authorization only in the UI; trusting a client price or user id; using the service role before checking the caller; two writes with the second error ignored; leaking `error.message` from the database; returning success on failure; sending email before the write succeeds; reading the raw argument after the parse, or hand-written checks beside the schema; a `strict` object schema for a payload that carries whole rows; returning Zod's messages or logging the rejected input; adding another validation library, or a form library, in an unrelated task.

## Checklist

- [ ] every argument is treated as untrusted and parsed with a schema from `lib/schemas/` before use, later lines use only the parsed value, and privileged values come from the server
- [ ] auth and ownership are checked inside the action before any access
- [ ] service role used only after authorization
- [ ] state transitions are filtered and repeat-safe; related writes are atomic or their errors handled
- [ ] result keeps the action's existing shape and its callers still work, a parse failure included; messages are generic Vietnamese; nothing internal leaks
- [ ] checks run and hostile-call cases that could not be run are stated
