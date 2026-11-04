# Future features — app-foundation

Direction the Owner has set that this program delivers in a later unit. Each entry closes as `Done` in the PR that ships its last part (plan: [plan.md](plan.md), Outcomes 1 and 5).

## AF-F1: Zod, React Hook Form and shadcn in the skills

- Status: Planned (moved here on 2026-10-28 from `docs/backlog/`, where agent-workflow had moved it): `server-actions` in AF-U2 and `frontend-workflow` in AF-U3, each with its `dependency-updates` and `test-quality-strategy` rows. The U1 part is delivered by PR #38: `frontend-design` describes the shadcn primitives and the confirm dialog, and `dependency-updates` has the rows for `radix-ui` and `class-variance-authority`. The AF-U2 part is delivered by PR #51: `server-actions` describes the Zod rules (schemas in `lib/schemas/`, parse before use, the failure message and shape, blank to null), `dependency-updates` has the `zod` row, `test-quality-strategy` names the schema and action-parse unit tests and the extended worker map, and `frontend-design` no longer says there is no Zod. The AF-U3 part is delivered by PR #53: `frontend-workflow` (`async-state-and-forms.md`) describes React Hook Form, the Zod resolver, the field error pattern and the duplicate-submit guard, `frontend-design` lists the added primitives, `dependency-updates` has the `react-hook-form` and `@hookform/resolvers` rows and `test-quality-strategy` names the learner-form rows. The last part, the shared client and server contract, is done locally in AF-U6, awaiting the PR: `server-actions` states that a form posting to an action derives its schema from the action's and sends the action's input shape, with `lib/schemas/user.ts` as the example.
- Direction: extend `server-actions` with Zod schemas, parsing and the shared client and server contract instead of creating a second skill (agent-workflow D15); extend `frontend-workflow` with React Hook Form, shadcn controls, async state and forms (D16); update `frontend-design`, which said there was no shadcn and no UI library (done in U1). The text is written from this repository, not from VocaSpace (off limits).
- Target program: app-foundation.

## AF-F2: Warn before losing unsaved learner form input

- Status: Deferred (2026-11-03, Owner after AF-U3 manual QA).
- Direction: a learner who leaves a form with unsaved text loses it silently. This happens when they navigate to another page, reload or close the tab. Closing the comments panel keeps the draft only because the panel slides away instead of unmounting. `app/` has no `beforeunload` handler and no navigation guard. When a learner form is dirty (React Hook Form `formState.isDirty`), warn on reload, tab close or leaving the site through `beforeunload`, which shows the browser's own prompt. For in-app navigation, which the App Router cannot block by itself, and for closing a panel or dialog, confirm through `ConfirmDialog`. Covers the profile dialog, the course review, the comment add and edit boxes and the lesson note. Planned after AF-U3; its e2e rows come with it.
- Target program: app-foundation.

## Closed

- FEAT-006 — Done: U1 replaces all nine native confirmations with the shared ConfirmDialog; the Owner accepts closure with real Gemini execution unverified due to an expired key (PR #38)
