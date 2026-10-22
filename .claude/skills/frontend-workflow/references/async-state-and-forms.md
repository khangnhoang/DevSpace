# Async state and forms

Read this before implementing or reviewing an async mutation, optimistic update, form, dynamic field or complex client-state transition. Form and validation libraries are not in the repo yet; forms use controlled state and the server action's validation.

## Async behavior

- Disable the affected controls while pending and prevent duplicate submission; guard against a second click before the state update lands (a ref or an in-flight flag), not only by the disabled attribute.
- Show pending, success and a safe error. Wait for the server's confirmation unless an optimistic strategy was approved; if so, define the optimistic state, the confirmation, the rollback, duplicate handling and the failure message.
- Use the action's real result as is (read its shape; many return `{ error }` / `{ success }`, others `null`, arrays or `{ data }`); never turn an error into a success toast. Show the generic message the action returned, not an exception.
- Handle overlapping and stale responses: ignore a result that belongs to an older request (compare an id or use an aborted flag), and clean up timers, subscriptions and realtime channels on unmount.
- After a mutation, refresh or revalidate data the way the neighbours do (`router.refresh()` or the action's `revalidatePath`) instead of hand-patching several copies.
- The same account can be open in two tabs; an action can be called twice. The server must be repeat-safe (`server-actions`); the client must not assume otherwise.

## Forms

- Required versus optional fields are visible; field errors sit next to the field; server errors are shown separately from local checks.
- Keep what the user typed after a recoverable failure. Trim text, and send `null` rather than `""` for an empty optional field (P16).
- Do not send or trust server-owned fields (user id, role, price, status); the server derives them.
- Keyboard and mobile: labels, enter-to-submit where natural, proper input types.
- Dynamic lists: stable keys (not the array index when items are removed or reordered), keep values on add and remove, keep errors by the item, and submit the intended order. A removal that loses data confirms first (`frontend-design`).

## States

Implement the meaningful ones: initial, loading, loaded, empty, error, submitting, success, disabled, permission denied, stale or partial data. Check null values, long text, missing images, slow and failed requests, empty collections and repeated actions.
