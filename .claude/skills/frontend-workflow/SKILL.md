---
name: frontend-workflow
description: "Engineering workflow for non-trivial DevSpace frontend tasks: read contracts and data first, plan states and transitions, implement without duplicate submits or stale responses, and validate manually in the browser pane. Use for pages, components, forms, dialogs, tables and client/server flows; pair with frontend-design for the visual side."
---

# Frontend workflow

## Use when / do not use when

Use for non-trivial frontend work: pages, components, forms, dialogs, tables, learning and admin flows, client/server boundaries, async behavior, server action or Supabase integration, and manual validation.

Do not use for docs only, database-only work, generated files, or a trivial text or class-name change. Visual direction belongs to `frontend-design`. A frontend task must not silently grow into server action, RLS or migration changes: use `server-actions` and `supabase-migration` and stop for a plan if the task needs them.

The only automated browser tests are the Playwright smoke (`npm run test:e2e`, `test-quality-strategy`); they do not check layout, copy or a changed interaction. Verification is `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run test:e2e` when a smoke path is affected, and manual validation below. Say plainly what was not run.

## Core rules

- Read before writing: the business flow, not only the visible controls. Inspect the repository before proposing paths, components or data shapes. Do not invent behavior, APIs, fields, enums, permissions or status transitions; report a missing contract.
- Do not implement non-trivial work without an approved plan (`planning`). Recheck the plan against the repo and stop on conflict.
- Prefer existing components, helpers and conventions; surgical changes. Do not change a shared component for one screen; do not install packages.
- Do not fake production success. Typed mock data is allowed only behind an explicit boundary and must never reach a production path. It is deterministic, clearly named, easy to replace and covers the state variants (complete, empty, error, long, null, status). Do not scatter mocks through production components, and never use local storage as a hidden backend; when a mutation is missing use a typed callback, a disabled action or ask whether backend scope should be added.
- Never rely on the client to protect data. Whatever a server component passes as props is in the page payload the browser receives, so locked content must not be fetched and passed down just to hide it in the UI (P13). Gate on the server (`server-actions`, `lib/auth.server.ts`).

## Workflow

1. **Understand:** the user and goal, current and expected behavior, state transitions, scope and exclusions, permission-sensitive behavior, the data the UI needs.
2. **Read contracts and data first.** Open the page, layout and similar screens; the shared components used; the types in `lib/types.ts`; the real action signatures and result shapes (often `{ error }` / `{ success }`, but they vary: some return `null`, arrays or `{ data }`, so read each action and its callers); the tables, nullable and server-owned fields, status values; the RLS that decides what the caller actually receives. Trace the flow from the click to the persisted state and back to the UI feedback.
3. **Plan UI and states** with `frontend-design`: hierarchy, actions, dialogs, responsive, accessibility. Decide where each value lives (local, derived, URL, server) and prefer derived values over copies. Avoid independent booleans that allow impossible combinations. Do not add a state library.
4. **Implement** in the approved scope. Cover the meaningful states: loading, empty, error, success, pending, disabled, permission denied. Read [async-state-and-forms.md](references/async-state-and-forms.md) for any mutation, form, dynamic list or complex client state.
5. **Performance:** look only for real risks (request waterfalls, duplicate fetches, unnecessary client components, large lists or payloads, images). No speculative `useMemo`, `useCallback` or caching without a reason.
6. **Verify:** `npx tsc --noEmit`, `npm run lint`, then manual validation: read [manual-ui-validation.md](references/manual-ui-validation.md) before planning or running it.
7. **Audit the diff:** scope, no unrelated changes, accurate contracts, states and failure paths safe, no duplicate or impossible state, shared components untouched, temporary logs and dead code removed, comments only for non-obvious correctness (`.claude/rules.md` section 9).

## Hard stops

Stop and report when business behavior, a status or a transition is unclear; the plan and the repo conflict; a needed contract or data is missing; backend or database work outside the approved scope would be needed; the impact on a shared component is uncertain; mock data could reach production; a server-owned field would be exposed; or an optimistic update has no safe rollback.

## Resources

| Resource | Read when | Skip when |
| --- | --- | --- |
| [async-state-and-forms.md](references/async-state-and-forms.md) | implementing or reviewing a mutation, optimistic update, form, dynamic field or complex client state | static composition with no async or form |
| [manual-ui-validation.md](references/manual-ui-validation.md) | planning, running or reporting manual validation in the browser | no browser check is planned or the Owner deferred it |

## Final report

Implemented behavior and direction; files changed and why; contracts inspected or changed; shared components and mocks used; states and permission behavior; responsive, accessibility and performance review; checks run with exact results; manual checks done and pending; known limits and what was left out.

## Definition of done

Approved behavior implemented; contracts inspected; states and transitions safe; boundaries respected; responsive and accessibility reviewed; `tsc` and lint clean (0 problems); manual validation done or explicitly pending (never summarized as complete while checks remain); diff audited.
