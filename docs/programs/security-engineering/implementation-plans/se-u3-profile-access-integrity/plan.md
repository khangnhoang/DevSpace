# SE-U3 detail plan — Profile write integrity and unused GraphQL access

Revision: r2, 2026-11-06. Owner approval and current authority: [progress.md](../../progress.md). Charter: [security-engineering](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: client requests cannot independently replace the profile email used for system mail, every stored profile role is `user` or `admin`, and the unused GraphQL API is disabled after its dependencies have been checked.

| ID | Observable result |
| --- | --- |
| AC1 | An authenticated user, including an admin, cannot change `profiles.email` through a direct client UPDATE or the update branch of an UPSERT. Rejected mixed-field requests persist none of their changes. A same-value email does not block an otherwise permitted update. |
| AC2 | A client cannot bypass AC1 by inserting/recreating a profile with a chosen email or reassigning a profile's identity. Auth provisioning and the existing server-side admin-account creation continue to create the correct email and initial role. Trusted server/database maintenance remains possible; no new maintenance endpoint is introduced. |
| AC3 | A learner can still update their permitted profile fields. An admin can still edit another user's name/avatar and change their role between `user` and `admin`. Ordinary users still cannot escalate roles, change another user's profile or read private profile data belonging to another user. Public profile cards remain read-only and exclude private columns. |
| AC4 | The database rejects INSERT and UPDATE values for `profiles.role` outside exactly `user` and `admin`, including `NULL`, empty strings, whitespace, placeholders and different casing. This applies to privileged writes too. Omitting the role on a new profile retains the `user` default. Existing rows satisfy the validated constraints before delivery. |
| AC5 | Before implementing the GraphQL drop, Main records the extension version/schema/owner, extension-owned objects, external database dependents and known consumers. The implementor proves local removal and rollback. Main repeats the dependency check immediately before each hosted prepare/apply. An unexpected dependency or consumer blocks removal until the Owner approves its disposition. |
| AC6 | After the GraphQL migration, `pg_graphql` is absent and neither anon nor authenticated requests, including an admin JWT, can execute GraphQL reads or mutations. A platform-provided disabled-extension wrapper is acceptable only when it cannot resolve application data. Hiding introspection alone is insufficient. Advisor 0026/0027 findings are absent after hosted postflight. |
| AC7 | Existing REST access, learner/profile flows, admin-account creation and role editing continue to satisfy their current contracts after each checkpoint and in the combined forward state. Three separate migrations each have a tested rollback restoring their own previous objects, grants, nullability and defaults without reverting earlier security fixes; the full reverse-order rollback/reapply is proven too. |
| AC8 | One PR delivers SE-P3/P7/P6 together with the PR #68 catch-up, retaining the existing attribution of Owner-reported production acceptance. All three problems remain open until this PR is delivered and their hosted acceptance passes. A blocker in any item blocks the whole PR; SE-U3 completes only after all three pass. |

### 1.2 Scope and non-goals

- In scope: new profile email/identity write guard and necessary client INSERT privilege restriction (SE-P3); role CHECK and NOT NULL enforcement (SE-P7); removal of unused `pg_graphql` after dependency inspection (SE-P6); their local API/catalog regressions, rollback proofs and hosted preflight/postflight runbooks; PR #68 docs catch-up.
- Deliver as one PR on `fix/se-u3-profile-access-integrity`, with three sequential checkpoints and three separate migration/rollback pairs. Owner decision D6 is a task-specific exception to the planning skill's exclusion of Codex-gated/hosted items from a batch. It changes no shared skill or permission rule; review and hosted safety gates remain mandatory.
- Non-goals: a new email-change flow, continuous synchronization with Auth email, changing the payment-mail source, bulk correction of existing profile emails, auth-helper modernization, new UI, self-demotion/last-admin protection (SE-P21), avatar ownership (SE-P5), comments (SE-P4), H2-2b, general grant/advisor cleanup, test-stack redesign or a dependency update.
- Published migrations, Auth provisioning (`handle_new_user`), managed Supabase event triggers and unrelated RLS policies stay unchanged. Discoveries requiring changes there return to Main for a scope decision.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Enforce email restrictions at the database boundary for every untrusted client, with no `is_admin()` exemption. Preserve the H1 role guard. | A forged REST/GraphQL request bypasses the forms, or the admin branch bypasses the email restriction. |
| G2. Cover UPDATE, UPSERT, INSERT/recreation and identity reassignment; retain permitted same-value updates and trusted provisioning. | Blocking only the visible email edit leaves another write path open or breaks account creation. |
| G3. Add both role membership and NOT NULL enforcement; never silently coerce existing values or grant admin by a data repair. | A CHECK alone accepts NULL, or remediation changes permissions without an Owner decision. |
| G4. Inspect external dependents of the extension AND its member objects, preserving expected platform hooks. Use a plain DROP EXTENSION without CASCADE; never remove schemas, hooks or unrelated objects to make it succeed. | A dependency is missed or unrelated database objects disappear with the extension. |
| G5. Prove rollback against the observed extension version and platform wrapper/ACL behavior, not only successful reinstallation of the latest version. | Rollback changes the API contract, loses custom ACLs or fails because the old version is unavailable. |
| G6. Use the managed test stack for all tests and rollback probes; verify its real Docker/database identity and hold its lock. Fixtures record intent before writes and verify exact cleanup/restoration. | A probe writes to hosted/dev or corrupts shared seed/fixture state. |
| G7. Main supplies hosted metadata to the implementor. Hosted user-data reads, repairs, migration prepare/apply and temporary write probes retain their separate grants. | Planning or a review verdict is mistaken for production authorization. |
| G8. Gate the whole PR on all three items. Apply migrations in checkpoint order, each in its own transaction, and track the actual committed prefix on any failure. Stop without merging or blindly retrying/rolling back. | A later migration fails after earlier ones committed, but delivery is incorrectly reported as atomic or complete. |

### 1.4 Owner decisions that bind this unit

- D1 (2026-11-06): initial assignment: plan SE-P3, SE-P6 and SE-P7 on a new branch, include lagging docs from the just-merged PR, and stop before independent review. The subsequent explicit review and revision instructions authorize plan review only, not implementation.
- D2 (2026-11-06): SE-P3 applies to both admin and ordinary user clients.
- D3 (2026-11-06): before the SE-P6 migration, check extension dependencies; the Owner recalls none, but that recollection is not evidence. Never use CASCADE to delete dependents blindly. Removal of unused GraphQL is the selected direction, subject to this precondition.
- D4 (2026-11-06): SE-P7 permits only `user` or `admin`, never NULL.
- D5: charter decisions 1–2 and ADR 0007 own the pre-migration security boundary. This plan does not authorize implementation, commits, delivery or hosted writes. Independent plan and implementation reviews remain future gates.
- D6 (2026-11-06): the Owner explicitly selects one PR for this cluster and requests the revised plan be independently reviewed again. Keep three separate migrations/rollbacks and sequential checkpoints; accept that a blocker in any item holds the whole PR. This task-specific direction takes precedence over the planning skill's generic batch exclusion without changing the skill.

## 2. Repository facts

Baseline: `749927bbc36734d37eb755ec8458ec2a6e5ae0b0`, checked 2026-11-06. Facts below justify the Spec; implementation mechanisms remain hypotheses until verified.

### 2.1 Source and delivery evidence

- [Baseline SQL](../../../../../supabase/migrations/20261021000000_baseline.sql) defines `profiles.email` and `profiles.role` as nullable text; role defaults to `user`. The later migrations add no role membership constraint — AC1/AC4.
- [H1](../../../../../supabase/migrations/20261021131351_h1_block_role_escalation.sql) makes provisioning use literal role `user`. Its SECURITY INVOKER role trigger restricts anon/authenticated except admins, while trusted roles bypass it. It checks no email field — AC1–AC4/G1.
- [H2-1a](../../../../../supabase/migrations/20261021181051_h2_1a_public_profile_view.sql) exposes only id/name/avatar/role through `profile_cards` and revokes client writes. [H2-1b](../../../../../supabase/migrations/20261021185249_h2_1b_restrict_reads.sql) limits profile SELECT to self/admin — AC3.
- `lib/supabase.ts` has `editUser` (client profile UPDATE) and `updateProfile` (learner field allowlist). `app/admin/users/_components/UserFormDialog.tsx` intentionally omits email from edits. `app/action/user.ts` creates Auth users with the server service role and then promotes an admin. These paths need database compatibility, not a frontend rewrite — AC2/AC3/AC7.
- `app/action/payment.ts` reads `profiles.email` as the activation-mail recipient — AC1. This plan does not change its business logic.
- `__tests__/rls/profiles.test.ts` contains the legacy `P28 [K3]` known-bug reproduction, H1 escalation and signup coverage, and self/admin/public-card permission tests. `__tests__/e2e/admin-user-forms.spec.ts` covers successful admin edits/creation; `learner-forms.spec.ts` covers profile persistence — AC1–AC4/AC7.
- A search of application sources (`app/`, `lib/`) found no GraphQL caller. `supabase/config.toml` exposes `public` and `graphql_public`; the baseline enables `pg_graphql`. This is source evidence, not proof that no external consumer exists — AC5.
- GitHub CLI confirmed [PR #68](https://github.com/khangnhoang/DevSpace/pull/68) MERGED at this baseline. The two pre-existing uncommitted state edits record Owner-reported production acceptance and deployment evidence from the preceding task; they were preserved through the authorized stash/apply. They do not establish new production runtime verification — AC8.

### 2.2 Hosted metadata snapshot

Main queried catalog metadata only on project `lkvxxrxojjlkchzzqidu` on 2026-11-06 using the installed Supabase CLI 2.121.0 `db query --linked --project-ref ... --file ...`. No application/user rows were read and no application migration or settings change was applied.

| Subject | Observed metadata | Consequence |
| --- | --- | --- |
| profiles constraints | Only `profiles_pkey` and `profiles_id_fkey`; email/role nullable; role default `'user'::text`. | Role membership and nullability need enforcement; existing role values remain unknown. |
| profiles triggers/helpers | Only `prevent_role_escalation` BEFORE INSERT OR UPDATE. Its definition, `is_admin()` and `handle_new_user()` match the H1 sources above; fixed empty search paths retained. | Preserve existing role/provisioning behavior; email needs a separate boundary. |
| profiles policies | Self/admin SELECT; two own-profile INSERT policies; admin INSERT/UPDATE/DELETE; self-or-admin UPDATE. UPDATE WITH CHECK is implicit, reusing USING. | Existing INSERT access must not bypass email protection; a policy edit is not assumed necessary. |
| relation grants | anon/authenticated have table privileges including INSERT/UPDATE on profiles. On profile_cards they have SELECT only; service_role has broader table grants. | UPDATE-column revocation alone is ineffective under a table UPDATE grant. Capture explicit column ACLs again before constructing exact rollback. |
| pg_graphql | Version `1.5.11`, schema `graphql`, owner `supabase_admin`. Wrapper `graphql_public.graphql(text,text,jsonb,jsonb)` and resolver are SECURITY INVOKER, executable by PUBLIC/anon/authenticated/service_role. | Do not infer RLS bypass from schema visibility; verify removal using the actual platform behavior. |
| extension members | The observed membership includes the resolver/internal resolver, wrapper, schema-version sequence/helpers and graphql DDL/drop watchers. | This is only a member inventory; external dependency absence has NOT been established. |
| platform hooks | Enabled `issue_pg_graphql_access` and `issue_graphql_placeholder` use `extensions.grant_pg_graphql_access()` and `extensions.set_graphql_placeholder()`. The latter installs a disabled-extension stub when the wrapper is dropped. | Do not modify managed hooks; HTTP 200 or an existing wrapper alone cannot prove GraphQL still works. |
| Security Advisor | 15 `pg_graphql_anon_table_exposed` and 15 `pg_graphql_authenticated_table_exposed` WARN findings, describing SELECT-driven schema visibility. | Preserve the distinction between discoverability and unauthorized row access; check these exact findings after delivery. |

Before any implementor dispatch, Main refreshes and supplies this snapshot with full applicable definitions, table/column/function ACLs, extension member/dependent inventory and migration history. Any mismatch returns to planning. Hosted role values, email/Auth mismatches, runtime GraphQL reachability and external consumers have not been verified.

### 2.3 Technical references and evidence limits

- [Supabase GraphQL security](https://supabase.com/docs/guides/graphql/security) documents grants and RLS as its visibility/access controls. Its current introspection-default description must not be assumed to apply to hosted pg_graphql 1.5.11.
- [Supabase extension documentation](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/extensions/pg_graphql.mdx) documents disabling via DROP EXTENSION; hosted ownership, dependencies and wrapper behavior still require environment-specific proof.
- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) explains that a CHECK evaluating to NULL passes — hence AC4 requires explicit NOT NULL enforcement too.

## 3. Bounded implementation hypotheses

- SE-P3: a new SECURITY INVOKER BEFORE UPDATE trigger, with empty search_path, rejects changed email or identity for anon/authenticated without an admin exemption. It uses null-safe comparison, permits unchanged email, and bypasses only trusted database roles. Revoke direct client INSERT on profiles to close recreation/UPSERT insertion; Auth provisioning and server admin creation retain their trusted path. Revoke default execute access on the new trigger function. This may be replaced only if AC1–AC3 and exact rollback still hold; do not change the existing role helper or provisioning trigger.
- SE-P7: add a named `CHECK (role IN ('user', 'admin'))`, validate it and set role NOT NULL while preserving the `user` default. Use short transaction/lock bounds and no automatic backfill. A preflight guard fails clearly on invalid existing data; the Owner chooses remediation under a separate grant. Rollback removes only the new CHECK/NOT NULL enforcement.
- SE-P6: use a separate migration with plain `DROP EXTENSION pg_graphql` after dependency assertions. No CASCADE or DROP SCHEMA, and no removal/replacement of platform hooks. The disabled placeholder may remain. The rollback restores the recorded version/schema and effective privileges; unavailable version, unsupported ownership or a custom dependent blocks the whole PR rather than triggering a workaround.
- Extend `profiles.test.ts` and add a bounded `graphql.test.ts` in the existing rls project. Use actor API requests and catalog queries through `withPg`; add a local-only GraphQL request helper using the verified injected stack URL/actor sessions. Never log credentials, bearer tokens or response data from hosted.
- If rollback/reapply needs a harness extension, add a bounded rls verification test using a single verified test connection under the existing runner lock, with unconditional restoration and catalog comparison. It must restore the forward state before other tests run and leave the run visibly unclean if settlement fails. Do not operate the managed test stack manually or weaken its audit.

## 4. Checkpoints

### 4.1 One PR and checkpoint order

One PR contains SE-P3, SE-P7 and SE-P6, this plan and the PR #68 catch-up on the current branch. One implementor works sequentially; no parallel checkout writer. Each checkpoint has its own implementation, tests, rollback proof, author self-review and Main review. The independent implementation gate reviews the entire combined diff and all three migration/rollback pairs. Run final full regression once after CP3 and all whole-diff review corrections; run focused checks at intermediate checkpoints. Plan approval and implementation, commit, remote and hosted grants remain separate.

| Item | Outcome / acceptance | Order inside the same PR | Expected files and boundaries |
| --- | --- | --- | --- |
| CP1 — protect profile email | SE-P3, AC1–AC3/AC7. | First implementation/checkpoint commit when separately granted; migration M1. | New email-guard migration/rollback, profiles rls tests and bounded helper support, SE docs. No product UI/action rewrite. |
| CP2 — constrain profile roles | SE-P7, AC3/AC4/AC7. | After CP1 in the same branch; migration M2. | New role migration/rollback, profiles rls tests, SE State/problem record. No email/Auth rewrite or automatic data repair. |
| CP3 — disable unused GraphQL | SE-P6, AC5–AC7. | After CP2 and dependency/rollback readiness in the same branch; migration M3. | New GraphQL migration/rollback, GraphQL rls tests and bounded helper support, SE docs. No unrelated grants, schema deletion or extension upgrade. |

M1/M2/M3 are order labels, not invented filenames or migration versions; assign real timestamped files during implementation. This order keeps profile protections in place while GraphQL remains enabled and exposes constraint/readiness problems before API removal. There is no intermediate branch, PR or merge. Shared delivery does not make the three database transactions atomic; all readiness checks must pass before hosted prepare, and any incomplete item holds the entire PR.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP0 — readiness, refreshed when relevant | Main supplies hosted metadata; implementor confirms the clean assigned baseline, real local target, rollback prerequisites and no missing business decision. Before M3, identify reverse dependencies of the extension and its member objects plus known SQL/function/runtime consumers. | Read-only catalog/source comparison. External dependency/consumer absence remains pending until this check is complete. Hosted role-data inspection remains separately granted and blocks hosted prepare if missing. |
| CP1 — M1 | Email/identity boundary and compatible provisioning, with regression tests and exact rollback. Convert P28 [K3] to a normal denied-write regression without changing the shared known-bug helper. | Focused `npm test -- __tests__/rls/profiles.test.ts`; genuine signup/admin-create compatibility; M1 rollback/reapply and catalog/ACL comparison. This is checkpoint evidence, not the final full regression. |
| CP2 — M2 | Validated role CHECK + NOT NULL, allowed role transitions, invalid existing-data refusal and rollback restoring previous nullability/default. | Focused profiles rls tests; privileged SQL constraint probes in rollback-only transactions; local invalid-data migration preflight probe on owned fixtures, then restore/reapply M2. |
| CP3 — M3 and combined candidate | Dependency-safe GraphQL removal, disabled API through all public entry points, REST compatibility and version/ACL-exact rollback; all three items ready together. | Focused `npm test -- __tests__/rls/graphql.test.ts __tests__/rls/profiles.test.ts __tests__/rls/content.test.ts __tests__/rls/coupons.test.ts`; M3 dependency-failure/rollback probes; full M3/M2/M1 reverse rollback then M1/M2/M3 reapply; combined-diff review and final checks below. |

All npm/npx/node commands run from the repo root through `fnm exec --`; on Windows use `npm.cmd`/`npx.cmd`. Stop if fnm fails. The planning session verified Node `v26.13.0`.

### 4.2 Verification allocation

| Guarantee / actor / condition | Layer and assertion | Location / prerequisites |
| --- | --- | --- |
| Learner/admin edit email, including null transitions and mixed-field payloads | Real REST requests: refused change and full relevant-row read-back unchanged; same-email permitted update succeeds. A repeated refused request changes nothing. | Extend profiles rls tests. Acquire only touched seed fields or use an owned temporary Auth/profile fixture; reserve changed selectors first. |
| INSERT/UPSERT recreation or identity reassignment | Actor requests cannot create a chosen-email profile or move a profile to another identity; prove target Auth rows exist and own every temporary profile/account. Existing profile remains intact after failure. | profiles rls tests; temporary exact-email Auth fixtures. Cover UPSERT insert and conflict-update separately; no seed profile deletion. |
| Normal profile edit, admin role edit, signup, server admin creation | Existing API/browser paths persist intended fields and unchanged email; H1 signup metadata cannot elevate role. | Existing profiles tests, learner-forms and admin-user-forms E2E rows (including U1/U6). Extend read-back if email invariance is not asserted today. |
| Role values from admin and privileged database writes | An admin's valid role UPDATE succeeds; invalid text/NULL UPDATE fails with the actual constraint/not-null error. Privileged SQL separately tests valid/invalid INSERT and UPDATE, plus the omitted-role default. Client INSERT stays forbidden by M1 and is not evidence of a role-constraint rejection. All constraints are validated. | profiles rls API tests plus catalog and native SQL transaction probes. Privileged SQL is used to test the database invariant, not a service-role API request masquerading as a client denial. |
| GraphQL dependencies | Inventory extension members AND reverse dependencies referencing any member; inspect custom function bodies/dynamic SQL and source consumers that catalogs cannot capture. A temporary owned dependency makes plain DROP refuse, preserving the object/extension. | Local catalog/DDL probe inside the managed rls run; Main repeats the read-only dependency inventory on hosted. No dependency fixture on hosted. |
| GraphQL disabled for anon, learner, admin | Extension absent; POST /graphql/v1, REST wrapper RPC and any callable resolver path return only disabled/missing/denied outcomes with no application resolution. Check errors inside JSON even on HTTP 200; no introspection-only assertion. | New graphql rls test, verified local origin and existing actor sessions. During rollback, a known allowed seeded public query must work, preventing a broken helper from proving a false denial. |
| REST preserved; no broad access widening | Existing profile/card, public outline, private lesson-column, exercise-enrollment and coupon tests retain allowed/denied results. | Existing profiles/content/coupons suites, final full suites. Prove hidden fixtures exist before asserting no rows. |
| Rollback/reapply restores each migration and the full set exactly | Compare touched definitions, grants, trigger config, constraints and extension state against the before snapshot at each boundary. Prove individual rollbacks and full M3/M2/M1 rollback followed by M1/M2/M3 reapply, then rerun focused regressions. | Bounded managed test-stack probe. Do not invoke H1's historical rollback; it restores a vulnerable provisioning definition. |
| Partial application does not masquerade as atomic delivery | On the verified local test stack, induce a later migration failure in a controlled probe; verify the earlier committed prefix and unchanged failing-migration state. Reconcile history/catalog, restore owned probe changes and reapply the remaining approved state. | Bounded managed rollback harness under the same lock. No production failure injection, blind retry, history repair or auto-rollback. An uncertain restoration makes the run unclean. |
| Existing invalid roles | Pending hosted data read: request only distinct role values/counts and null count first; do not inspect emails or individual accounts. Bad roles block hosted prepare for the whole set. Email/Auth reconciliation is outside this initiative; incidental evidence of drift is reported without an extra data read or repair. | Main/Owner, separate data-read and repair grants. A catalog-only pass is not evidence that stored values are valid. |

Fixtures journal exact intent before requests, settle writers, reconcile ambiguous outcomes and clean in dependency order with read-back; preserve unrelated rows. Where a changed helper or rollback harness changes cleanup, run focused affected tests after reset and again on retained state with clean audits; otherwise do not demand two full runs.

At the single PR's final boundary, after CP3 and all whole-diff review corrections: run unfiltered `npm test` and unfiltered `npm run test:e2e` once each, plus `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`, and `npm run docs:check`. Intermediate checkpoints use focused affected-area checks. Repeats follow the named fixture/rollback risks above or corrections that invalidate evidence, not an automatic full-suite run per item. Format/check only changed files using the repo commands; Markdown/SQL follow the current ignore rules. No application tests are claimed as run during planning.

### 4.3 Residual manual and hosted QA

| Scenario | Who / expected result | Readiness / why manual or hosted |
| --- | --- | --- |
| Hosted dependency and catalog preflight | Main identifies the exact project, versions, dependents, ACLs and current functions; mismatch blocks prepare. | Catalog reads are allowed; rerun near apply because local tests cannot prove hosted state. |
| Existing role-data readiness | Main reads only the approved aggregate; Owner decides each invalid-value repair before the migration set can prepare. | User-data read and any repair are not granted by this plan. This blocks delivery of the whole PR, not a reason to auto-backfill. |
| Hosted postflight | Main checks catalog/constraints, simulated roles and the GraphQL disabled response without application-row reads; checks Advisor 0026/0027. Invalid-write or designated-account probes run only with separate authorization. | Local behavior does not prove hosted rollout. A rolled-back write probe still requires a hosted-write grant. Never query GraphQL collections of real users to test denial without a data-read grant. |
| Production profile/admin compatibility | Owner confirms normal profile save, admin role edit and intended account creation on designated accounts after the guard/constraint is active. | Live deployment/account QA; agent does not sign in with Owner credentials or create hosted fixtures without authorization. Blocks the PR's acceptance and problem closure. |

No new visual/perceptual manual pass is required because no UI is changed; existing automated form persistence rows cover wiring. Any required scenario not executed remains pending and blocks the relevant delivery claim.

## 5. Risks, rollout and rollback

| Risk | Mitigation / earliest exposure |
| --- | --- |
| A guarded email update misses client insertion or admin identity reassignment | AC2 tests at CP1; use a new guard plus necessary INSERT restriction, not frontend-only validation. |
| Trusted provisioning loses INSERT access or the email guard inherits the admin exemption | CP1 real signup/admin-create tests; inspect current_user/security mode and new function ACLs independently of H1. |
| Existing invalid or NULL roles make validation fail | Owner-approved aggregate before hosted prepare; migration precondition fails without modifying rows. No coercion to user/admin or disabling constraints; the whole PR waits. |
| Extension dependencies, ownership or managed hooks differ between local and hosted | CP0 snapshot and local plain-drop/restore proof; repeat on hosted before prepare/apply. Unexpected objects block the whole PR. |
| Rollback installs a different version or fails to restore API/ACL behavior | Confirm recorded version is available before forward migration, compare wrapper/ACL state and prove an allowed public query during local rollback. Stop if exact restoration is unsupported. |
| Constraint validation or DDL waits too long | Inspect table size/catalog estimates and use bounded lock/statement timeouts; schedule the apply appropriately. A timeout rolls back and is reported, never retried blindly. |
| M2 or M3 fails after an earlier migration commits | Prove the partial-state case locally at CP3, complete all preflights before apply, then reconcile actual migration history/catalog on an error. No merge or automatic rollback/retry; the Owner decides recovery under fresh grants. |

Rollout for the one PR, with three ordered migration transactions:

1. The revised plan passes independent review and Owner approval before implementation starts. Under a separate implementation grant, complete CP1–CP3 and their local rollback proofs, Main review, one independent implementation gate over the complete diff, final full regression and green PR CI. This assignment authorizes plan revision/re-review only.
2. Before any hosted prepare, Main refreshes metadata for all three migrations, obtains the distinct-role/null-count read grant and completes any separately approved repair. Verify GraphQL dependents/consumers and exact rollback-version availability before the set is prepared, not only after M1/M2 have applied. A blocker in any item holds the whole PR.
3. These restrictions are compatible with the existing forms (email is not sent; roles are already constrained in forms) and the app has no GraphQL source caller. Apply M1, M2, M3 in timestamp/checkpoint order before merge, with separate prepare and apply grants naming project `lkvxxrxojjlkchzzqidu`, the clean reviewed commit and the complete ordered migration-version list. Follow `supabase-migration` Hosted apply: target ref check; dry run lists exactly those three migrations; repeat the metadata/dependency/data readiness and dry run at the same commit immediately before apply. Any changed readiness, unexpected migration or password prompt stops the operation. Each migration has its own transaction; the set is not atomic.
4. If apply fails, stop delivery. Main reads migration history and touched catalog metadata to identify the committed prefix and the failed/pending versions; do not assume all three rolled back. Record the partial hosted state and preserve evidence. Do not retry, repair history, merge or automatically run rollbacks. The Owner decides whether to correct and prepare/apply the exact remaining versions at a newly reviewed clean commit or explicitly authorize rollback of the applied prefix in reverse order. After any recovery, restart prepare with fresh readiness checks and a dry run listing exactly the now-expected versions.
5. After all three migrations are confirmed in history, Main completes hosted postflight for all three, obtaining separate approval for any user-row read or temporary write. Merge only under its own grant after all acceptance prerequisites pass; confirm the automatic compatible production deployment and complete Owner QA. No extra deployment command is included.
6. Resolve SE-P3/P7/P6 only after the combined PR is delivered and all hosted acceptance passes; record the one PR and actual hosted result in progress.md. SE-U3 then completes. Carry any merge-time lagging State into the next authorized task as the normal docs catch-up lifecycle requires.

Stop when scope expands, source/hosted definitions drift, existing data is invalid without an approved repair, dependencies/consumers are unexplained, the drop needs CASCADE, exact rollback is unavailable, local target/lock/cleanup is uncertain, a test fails without a named cause, or a required grant is missing. Do not use MCP or credentials as a workaround for a failing CLI.

Rollback: each `.down.sql` restores only its migration's exact previous state in one transaction. M1 removes only its new guards and restores the captured client INSERT privileges; it never rolls back H1. M2 drops only its new role CHECK/NOT NULL enforcement, preserving the original user default. M3 restores the recorded pg_graphql version/schema and effective wrapper/resolver grants without deleting schemas or platform hooks. Full rollback runs M3 then M2 then M1; after partial apply, roll back only the confirmed applied prefix in reverse order when explicitly authorized. Local individual and combined proofs precede delivery; hosted rollback requires a new explicit grant and reopens the affected exposures. No rollback can undo production email already sent or substitute for a separately approved data repair.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
