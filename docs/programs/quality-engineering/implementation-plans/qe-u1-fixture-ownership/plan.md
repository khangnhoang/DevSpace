# QE-U1 detail plan — Owned fixtures and safe cleanup

Revision: r2, 2026-10-30. Owner approval: 2026-10-30, after independent Codex plan PASS. Charter: [quality-engineering](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: existing RLS and E2E tests use shared ownership-aware setup and cleanup. A normal run, failed setup or failed test cannot delete another run's or manual QA's data. Interrupted-run recovery is explicit and bounded to recorded ownership.

| ID | Observable result |
| --- | --- |
| AC1 | Before a suite writes, it verifies the intended local stack, obtains exclusive use and checks the baseline conditions it actually needs. A conflicting owner or failed readiness check prevents test writes and unowned cleanup. |
| AC2 | Cleanup removes only resources created by its scope and restores only fields that scope acquired for mutation. Seed, unrelated and foreign-run rows/accounts survive, including rows whose text starts with E2E or rls-test. |
| AC3 | An ordinary setup failure after creating some fixtures and a failure inside the test both clean all attributable owned resources, in dependency order, with error handling and read-back. Repeated cleanup is safe. |
| AC4 | A denied write that unexpectedly succeeds is still attributable and cleaned even if its response provides no ID. Tracking precedes the write; a denied-path assertion never becomes permission for a broad delete. |
| AC5 | A separate process targeting the same stack cannot run RLS/E2E or managed dev concurrently with an acquired exclusive test run. Losing ownership stops new writes. Ownership covers descendant writer processes and outstanding requests, not only the coordinator PID: cleanup cannot finalize or release the target until they are confirmed stopped or settled. A killed coordinator, unresolved request or uncertain writer lifetime leaves a blocking journal for explicit recovery. Successful exit, setup error and signals release only the caller's fully settled ownership. |
| AC6 | Recovery identifies one interrupted run and its local target, refuses a live/ambiguous owner or mismatched target, and cleans only positively attributed resources. Normal setup never sweeps old markers or automatically resets the database. Unknown/unattributable state blocks recovery with an actionable report. |
| AC7 | E2E fixture labels, slugs, coupon codes and Auth emails are scope-specific; Auth deletion uses owned user IDs, verifies absence, and preserves error diagnostics. Routine cleanup does not enumerate the first page of users to infer ownership. |
| AC8 | RLS and E2E retain their current allowed/denied-path, known-bug, mail, network and UI assertions. New safety assertions prove unrelated-data preservation, two independent ownership scopes, failure cleanup and refusal of cross-process conflicts. |
| AC9 | PR #41 documentation reflects merged AW-F4/AW-P2; Quality Engineering has one charter/State owner; transferred work and identifier mappings remain traceable. |

### 1.2 Scope and non-goals

- Shared ownership, readiness, cleanup and recovery support for current local test writes; migrate affected E2E fixtures/specs and RLS setup/helpers/specs together.
- Coordinate managed dev with suite exclusivity because dev and tests share the same local database. Keep normal command names and per-job CI isolation; documentation explains direct-command limits.
- Open Quality Engineering; transfer BL-F6 to QE-F1, BL-F7 to QE-F2 and BL-F8 to QE-F3, retaining scope and pointers. Only QE-F1 is implemented by this initiative.
- Include AW-F4/AW-P2 merge catch-up from PR #41. Update current test-safety descriptions only where changed mechanisms make them obsolete.
- Non-goals: product code, business rules, auth helpers, RLS/grant/schema/migration changes, new dependencies/frameworks, hosted calls, extra Supabase stacks, broad coverage expansion, failure/race product tests from QE-F2, CI optimizations from QE-F3, AF-U2 implementation.
- Keep BL-F3's separate dev/test stacks deferred; do not silently introduce that work as a prerequisite.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Read local target metadata through existing local-stack support; validate stack identity as well as loopback URLs. Do not read .env files or print keys. | A local host alone can identify the wrong disposable stack. |
| G2. Exclusive-use coordination must work across processes and checkouts addressing the same local stack, not only one Node module, cwd or worker. Never steal a lock by age alone. | Another suite or managed dev can mutate seed data between snapshot and restore. |
| G3. Managed-command coordination is cooperative. Before database writes or any reset, separately verify no direct server, SQL client or manual QA owns the target. If that cannot be established, block; never claim a lock controls every external writer. | An uncooperative process bypasses the launcher and loses data. |
| G4. Use owned IDs, reserved scope-specific natural keys or exact acquired row/field snapshots. Record mutation intent before issuing a request and resolve partially completed creation without a broad scan/delete. | Assertion/setup failure or a lost response leaves unowned residue or deletes someone else's row. |
| G5. Acquire an existing seed row only after required baseline checks pass. Snapshot only affected fields; restore and verify the acquired value, not a blanket hard-coded seed rewrite. A failed preflight has an empty mutation ledger. | A failing setup overwrites existing manual changes. |
| G6. Keep recovery metadata outside build/report directories that tests overwrite. Store target identity and ownership only, never keys, tokens, passwords or full user rows. Cleanup failure retains sufficient evidence to retry. | A build or crash destroys ownership evidence or persists credentials. |
| G7. Service role stays setup/read-back/cleanup only. Product requests keep their actor; payment states still arise through existing actions, not fixture updates. | Tests bypass the security/business guarantee they purport to protect. |
| G8. No automatic database reset, force-unlock, foreign-run sweep or hosted fallback. No broad marker/actor-wide cleanup remains in affected callers. | Recovery becomes a destructive shortcut. |
| G9. Independent Codex gates on plan and implementation because cleanup can delete data. Follow AGENTS permissions and separate-session boundaries. | A risky test-data change ships without the required review. |
| G10. Keep unresolved mutation intents and descendant-writer ownership through cleanup/recovery. Confirm writers stopped or requests settled before declaring absence final or releasing exclusivity; uncertainty blocks new acquisition. | A late notification or other side effect persists after cleanup has reported success and the next run starts. |

### 1.4 Owner decisions that bind this unit

- (2026-10-30) Work on BL-F6 on a new branch, including documentation lag from the already merged AW-F4/AW-P2.
- (2026-10-30) Open evergreen Quality Engineering to own this work and subsequent testing/CI maintenance.
- (2026-10-30) The Owner approved r2, granted a local commit of the plan/program opening/transfers/PR #41 catch-up, authorized a separate GPT-6.1 Sol/medium implementor chat, and subsequently granted local implementation checkpoint commits. No push, PR or merge authority.

## 2. Repository facts

Baseline: `b071d62`, checked 2026-10-30 after fetching origin. Working tree was clean before creating `test/bl-f6-fixture-ownership`.

- PR #41 merged `f250157` and its AW-F4/AW-P2 commits, but AW State still says awaiting delivery — AC9.
- `__tests__/e2e/service-role.ts` deletes payments except ID 1, coupons except LOCAL10, actor-wide enrollment notifications, and shared E2E marker rows/accounts; user enumeration is limited to 200 — AC2/AC7.
- `payment-learner.spec.ts` and `payment-admin.spec.ts` call cleanup from afterEach even if beforeEach readiness fails. `admin.spec.ts` and `student.spec.ts` sweep shared markers both before and after fixture rows — AC1/AC3.
- `learner.spec.ts` L5 removes learner enrollment and actor-wide notifications. Payment actions create payments for learner and admin and can create enrollments/mail; side effects need ownership, not only the returned payment ID — AC2/AC4.
- RLS content/community/learner-data hooks use shared rls-test markers and actor-wide deletes; profiles/community/learner-data rewrite seed values. Sign-up cleanup lists only 1000 users — AC2/AC4/AC7.
- Some RLS writes have no returning clause because the actor lacks SELECT. A denied insertion can unexpectedly persist without exposing an ID — AC4.
- RLS assertions include exact seed row counts and IDs. Data not meeting required prerequisites must fail without destructive cleanup; accepting arbitrary data is not promised — AC1/AC8.
- `fileParallelism: false` and Playwright `workers: 1` serialize only one process. `scripts/dev/local.mjs`, `scripts/e2e/run.mjs` and RLS global setup have no shared exclusive-use mechanism — AC5.
- Local dev, RLS and E2E currently share one stack; BL-F3 explicitly defers separation. E2E also shares `.next`, saved auth sessions and server/mail records — G2/G3/G6.
- Existing Auth result-handling regression cases live in `__tests__/unit/e2e-service-role.test.ts`; SDK-error simulation there proves result handling, not real database preservation — AC7/AC8.
- E2E launches Playwright, which launches a separate Next server (`scripts/e2e/run.mjs`, `serve.mjs`). `enrollCourse` inserts enrollment before awaiting notification insertion; coordinator death does not establish that all side effects stopped — AC5/G10.
- RLS N3 deletes seed progress ID 1 and current restoration upserts only id/user_id/lesson_id. The baseline defaults `user_progress.completed_at` to now(), so that restore changes the original timestamp — AC2/AC8.

## 3. Bounded implementation hypotheses

- A small shared helper under `__tests__/helpers/` can own target identity, scope IDs, exclusive-use acquisition and resource bookkeeping. Prefer an OS/process lifetime mechanism where practical; a filesystem protocol must prove atomic acquisition, cross-checkout identity and safe stale-owner handling. Final mechanism may differ if AC1–AC6 hold.
- Wire E2E before its build/setup and RLS before sign-in/fixtures. Managed dev participates for its server lifetime. Child processes receive only non-secret ownership references, with validation rather than trusting an arbitrary environment value as authority.
- Track writer descendants and pending request intents. On failure or recovery, stop admitting work, settle requests or confirm descendant writers stopped, reconcile intents, then clean and verify resources; release only after that sequence. Do not infer quiescence from coordinator death, an aborted HTTP client or a single empty read. If a writer/request cannot be resolved, retain the blocking journal rather than finalize cleanup.
- Use one run and narrower per-test scopes. Check fixture preconditions without mutation, then reserve intended IDs/keys and track request effects before assertions. Cleanup aggregates failures while attempting independent owned resources; remove journal entries only after verified cleanup.
- Replace fixed E2E values with returned scope-specific labels/codes/emails and update their callers/selectors in the same checkpoint. Preserve user-visible application text and existing behavioral assertions.
- Migrate affected RLS hooks to exact ownership, including denied writes with no returned ID and signup creation. Shared seed mutations require acquired snapshots and read-back, not automatic whole-row overwrites.
- Add explicit local recovery entry point under `scripts/` only if needed to meet AC6; document exact target/run selection, dry inspection, failure behavior and safe replay. Unknown legacy leftovers stay a manual investigation, not an inferred ownership claim.
- Expected code areas: `__tests__/helpers/`, `__tests__/e2e/{service-role,fixtures,payment-helpers,admin,student,learner,payment-learner,payment-admin}.ts` (spec filenames retain `.spec.ts`), `__tests__/rls/`, focused unit tests, `scripts/{dev,e2e}/`, test config and ignored runtime metadata paths. Extend only direct callers required by acceptance.
- No hosted metadata is needed: product schema/policies do not change. The implementation brief uses the repo baseline/migrations as the local schema snapshot; no implementor calls hosted MCP.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Exclusive-use/readiness foundation with focused regression tests; normal launchers cooperate and failures release ownership safely. | Unit/process checks for same-target conflict, different-target independence, cross-checkout contention, failed readiness, signals, surviving writers and explicit stale recovery; typecheck/lint. |
| CP2 | E2E ownership and exact cleanup migrated with all direct callers; Auth checks retained; unrelated data survives failures. | Unit error-path tests plus real local fixture-safety integration rows, full E2E twice without an intervening reset, typecheck/lint. |
| CP3 | RLS ownership/snapshot cleanup migrated; interrupted-run recovery complete; docs and all remaining callers aligned. | RLS twice consecutively, process/recovery probes, final unit/E2E regressions appropriate to changed shared code; docs checks and static checks. |

All checkpoints are assigned to one separate implementor session after approval. Checkpoint commits need an explicit grant. Main checks every real diff; independent Codex reviews the final implementation before Owner acceptance/delivery.

### Verification allocation

| Guarantee / condition | Layer | Assertion and location | Prerequisites |
| --- | --- | --- | --- |
| No ownership after failed preflight | Unit and local integration | New ownership-helper regressions and fixture-safety test: no destructive cleanup occurs; preserved sentinel remains byte/field-equivalent. | Unit needs no Docker; integration needs verified exclusive local target. |
| Two scopes and foreign/manual rows | Local integration | New `__tests__/rls/fixture-ownership.test.ts` or equivalent existing API fixture: create A/B plus unrelated sentinels, cleanup A, verify B/sentinels, then cleanup B and probe-owned sentinels. Include payment/coupon/content/notification and Auth resource paths. | Probe owns all temporary sentinels and removes them in finally; no seed deletion. |
| Setup/test error and repeated cleanup | Unit plus real local integration | Fail after first successful creation and after request-side effects; attributable residue is absent, unrelated rows unchanged, original failure plus cleanup failure remain visible. | Controlled failures at the helper boundary, never mocked DB ownership. |
| Successful write without a returned ID | Real local integration | Use the existing admin notification no-returning insert or an equivalent owned real write; after commit simulate the failed denial/assertion path. Resolve ownership from pre-recorded exact intent, remove only that row and verify unrelated notifications survive. | Existing roles/policies unchanged; the unexpected success is simulated at the assertion boundary, not by weakening RLS. |
| Committed creation with unavailable response/ID | Real local database/Auth integration plus controlled transport boundary | Commit a scope-specific row and Auth user, withhold the response/ID from the bookkeeping caller, then reconcile the recorded intent to exact IDs and verify cleanup. Ambiguous ownership or lookup failure must retain a blocked journal and preserve unrelated users/rows. | Preserve existing Auth lookup error cases; no first-page-only scan and no mocked persistence. |
| Acquired seed fields restored after failure | Real local integration | Snapshot actual values, mutate acquired profile/comment/note fields through the existing actor, inject failure, then verify restored fields equal their snapshot and untouched fields remain equal. Failed preflight with different initial values performs no restore. | Scope acquires only after baseline/exclusive-use checks; the probe restores its own changes. |
| Progress deletion preserves timestamp/identity | Real local integration | Migrate N3 to a temporary owned progress row and retain its allowed-owner-delete assertion, or snapshot/recreate the seed row with original ID and completed_at; verify exact before/after seed equality even after assertion failure. | No product/policy change; owned-row option must retain the original permission guarantee. |
| Cleanup read/delete error | Unit | Extend `e2e-service-role.test.ts` and new helper tests: errors and residual IDs fail loudly; no first-page inference. | Controlled SDK results only for error handling. |
| Cross-process exclusivity | Subprocess unit/integration | Spawn two independent processes with a barrier; second same-target owner is refused, managed dev conflicts, different targets are independent, stale/ambiguous journal is not auto-stolen. | Temporary coordination directory; no DB required for protocol tests. |
| Interrupted-run recovery | Process plus local integration | Kill a controlled fixture-owning child, inspect its target/run metadata, refuse wrong/live target, explicitly recover recorded resources and verify no residue/sentinel loss. | No active dev/QA/other suite; target verified before writes. |
| Coordinator death with an outstanding writer | Controlled subprocess/request probe plus real local persistence | Pause a writer behind a barrier after its first mutation and before a later side effect. Kill the coordinator or discard its response; prove a second run cannot acquire while the descendant/request is unresolved. Then settle or stop the writer, recover all attributed effects and verify no late residue or unrelated-data loss before acquisition succeeds. | Test-only barrier/writer harness, no product changes; exercise the same ownership lifecycle used by normal launchers. |
| Existing product coverage | Existing suites | `npm run test:unit`, `npm test` twice, `npm run test:e2e` twice under Test data prerequisites; compare assertions, not only counts. | Docker/local stack and Chromium. Runs use current normal entry points. |
| Documentation and static correctness | Existing checks | `npm run docs:check`, `npm run docs:check:test` for mapping/parser-consumer coverage; `npx tsc --noEmit`, `npm run lint`, `git diff --check`. | No database. |

Residual manual QA: none for the ownership contract, which needs deterministic process/database evidence. A human establishes disposable-target readiness when unmanaged usage cannot be ruled out; this is a prerequisite, not a substitute for the assertions above. Real Gemini/mail-provider quality is outside scope.

Readiness: no database tests or resets during planning. Before implementation verification, inspect active stack/services/processes and establish exclusive disposable use. Run a reset only after that prerequisite is proven and any required authority exists. If Docker, Chromium or exclusivity is unavailable, record the exact blocked checks; do not use hosted or weaker mocks. Do not hide a first failed run behind a successful retry.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A response is lost after creating a resource. | Record intent first; reserve exact identities where possible; ambiguous effects stay journaled and blocked for investigation. No global sweep. |
| Coordinator exits while a descendant or request still writes. | Retain target ownership until writers stop/requests settle and intents are reconciled; controlled late-write probe verifies recovery cannot release early. |
| Shared-seed restoration overwrites manual changes. | Enforce exclusive use, validate baseline and acquire exact fields before mutation; preserve unrelated rows/fields and block unknown ownership. |
| A cleanup error prevents later owned cleanup. | Attempt independent resources, respect dependency order, retain unresolved journal entries and report all failures. |
| New labels or coupons weaken E2E selectors. | Return actual fixture values to callers; preserve all existing UI/action assertions and run full suites. |
| Locking dev/test launchers is mistaken for full machine isolation. | State cooperative limits, test same-stack contention across checkouts, require readiness evidence for unmanaged commands; keep BL-F3 deferred. |
| Test-only safety work expands into product/CI fixes. | Stop at guardrail boundaries; keep QE-F2/QE-F3 as future entries and existing known bugs unchanged. |

- Rollout: docs/plan checks, self-review, independent plan PASS, Owner approval and grants; then one separate implementor, Main review/corrections, independent diff PASS, and Owner delivery decision. No hosted step or migration. CI workflow optimization is not part of this PR.
- Stop when: target/exclusive use cannot be proven, an ownership ambiguity requires destructive inference, a schema/product/permission change is needed, or the required independent-session method/model is unavailable. Report the missing evidence or decision rather than bypassing it.
- Rollback: revert the helper/caller changes together under a separate grant; inspect/recover outstanding owned journals before reverting. A code revert cannot undo deleted rows. Keep the legacy helpers' unsafe limitations explicit if reverting; never delete ownership evidence as rollback cleanup.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
