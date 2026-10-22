# RPC, triggers and concurrency

Read this when adding, changing or reviewing an RPC, trigger, SQL helper, lock, retry or race-sensitive transition. The core rules are in `SKILL.md`.

## RPC

Use an RPC when an operation must be atomic, permission-sensitive or concurrency-safe in the database; not to hide ordinary CRUD. Before writing one:

1. Inspect existing RPCs and helpers (the snapshot lists definitions). Note that the code may call an RPC that does not exist on the database (P5).
2. Decide whether `security definer` is needed. If so, set a fixed `search_path` (for example `set search_path = public`), check the caller's permission and the row's current state inside the function, and revoke execute from `public, anon, authenticated` before granting it to the intended role.
3. Make a retryable transition idempotent and avoid duplicate side effects.
4. Return only what the caller needs.
5. Update the calling action and the contract in the same plan.

For every RPC review report each boundary, even when the answer is "unknown" or "not applicable": why `security definer` is or is not needed, `search_path` and caller access, the return shape, and success, invalid state, unauthorized caller and retry.

## Triggers

Inspect existing triggers first. Reuse a shared helper such as `handle_updated_at` if it exists and fits. State the intended effect and any effect on unrelated rows; do not touch auth provisioning triggers (`handle_new_user`) unless the task is about provisioning. Do not report a planned trigger test as executed.

## Races and idempotency

For counters, reservations, payments, webhooks, enrollment and status changes:

- name the shared row and the invariant;
- prefer an atomic `update ... where ... returning`; use `select ... for update` only when serialization is needed, take locks in a fixed order (for example by id), and keep the scope short;
- never call an external service inside the lock;
- make retries safe, and test duplicate or simultaneous requests when a way to run them exists.

DevSpace cases: coupon use counts and reservation (P5, P6), approving or rejecting a payment together with its enrollment (P25), duplicate submit.

## Verification details

RPC: success, invalid state, unauthorized caller, idempotent retry. Trigger: the effect, and unaffected rows. Race-sensitive change: duplicate, retry or concurrent request, and the final invariant. Without a local database these are written in the plan as Main's checks and stay `pending` until run.
