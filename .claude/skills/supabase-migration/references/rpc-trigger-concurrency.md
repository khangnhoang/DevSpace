# RPC, triggers and concurrency

Read this when adding, changing or reviewing an RPC, trigger, SQL helper, lock, retry or race-sensitive transition. The core rules are in `SKILL.md`.

## RPC

Use an RPC when an operation must be atomic, permission-sensitive or concurrency-safe in the database; not to hide ordinary CRUD. Before writing one:

1. Inspect existing RPCs and helpers (the snapshot lists definitions). Check that every RPC the code calls is defined in the migrations; a call to a missing one fails at runtime.
2. Decide whether `security definer` is needed. If so, set a fixed `search_path` (for example `set search_path = public`), check the caller's permission and the row's current state inside the function, and revoke execute from `public, anon, authenticated` before granting it to the intended role.
3. Make a retryable transition idempotent and avoid duplicate side effects.
4. Return only what the caller needs.
5. Update the calling action and the contract in the same plan.

For every RPC review report each boundary, even when the answer is "unknown" or "not applicable": why `security definer` is or is not needed, `search_path` and caller access, the return shape, and success, invalid state, unauthorized caller and retry.

## Triggers

Inspect existing triggers first. Reuse an existing trigger helper from the snapshot when one fits. State the intended effect and any effect on unrelated rows; do not touch auth provisioning triggers (`handle_new_user`) unless the task is about provisioning. Do not report a planned trigger test as executed.

## Races and idempotency

For counters, reservations, payments, webhooks, enrollment and status changes:

- name the shared row and the invariant;
- prefer an atomic `update ... where ... returning`; use `select ... for update` only when serialization is needed, take locks in a fixed order (for example by id), and keep the scope short;
- never call an external service inside the lock;
- make retries safe and plan relevant duplicate/competing requests through [test-quality-strategy](../../test-quality-strategy/SKILL.md#coverage-model); identify contenders and assert the final persisted invariant. Sequential retry and stale-tab interaction do not prove concurrency; independent requests/connections and controlled synchronization may be needed.

DevSpace cases: coupon use counts and reservation, approving or rejecting a payment together with its enrollment, duplicate submit.

## Verification details

RPC: success, invalid state, unauthorized caller, idempotent retry. Trigger: the effect and unaffected rows. Race-sensitive change: relevant duplicate, retry and genuinely concurrent requests, with the final invariant. Allocate assertions and safe fixtures through [test-quality-strategy](../../test-quality-strategy/SKILL.md#select-checks-from-the-contract). Use existing `rls` API tests where sufficient; when API reachability or minimal seed is insufficient, plan a bounded local integration mechanism/data extension within approved scope or name a concrete blocker and resolution. Do not turn absent harness support into unstructured manual fallback. Main-only SQL/hosted checks retain their actor and authority boundaries (`SKILL.md`, Verification plan; `AGENTS.md` section 4); unrun checks stay `pending`.
