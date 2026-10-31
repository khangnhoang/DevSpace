# SH-P3 detail plan — Community write integrity

Revision: r2, 2026-10-31. Owner approval: 2026-10-31, including separate entry-plan placement. Historical design: [H2 plan](../../plan-h2.md), B10/B11 and the P3/P4 portion of section 4.3. Parent problem: [SH-P3](../../problems.md#sh-p3-review-insert-allows-impersonation); SH-P4 is delivered by the same outcome.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: review authorship is enforced and comment ownership/lesson identity cannot change, while legitimate writes continue.

| ID | Observable acceptance |
| --- | --- |
| HA1 | An enrolled actor can insert/upsert a review only as themself; anon and an unenrolled learner cannot insert it, and impersonation writes leave no forged review. Existing own-review UPDATE and both upsert branches remain functional; reassignment is denied. |
| HA2 | A comment owner can edit content, another user cannot edit the row, and an admin can soft-delete it. |
| HA3 | Changing either comment `user_id` or `lesson_id` fails with `42501` for the owner, admin JWT and a separate local SQL request executing as `service_role`; persisted identities remain unchanged. |
| HA4 | The immutability trigger is attached, its helper is SECURITY INVOKER with an empty search_path, and effective EXECUTE access for PUBLIC/anon/authenticated is revoked. |
| HA5 | Local rollback restores the exact original affected catalog, including an absent comment WITH CHECK; reapply restores HA1-HA4. No published migration changes. |
| HA6 | Every legacy problem has exactly one traceable canonical destination with unchanged meaning/status; the obsolete problems-shape exception is removed without weakening other validation. P3/P4 remain fixed locally awaiting delivery until the delivering PR merges. |

### 1.2 Scope and non-goals

Deliver one PR for P3/P4 (B10/B11) and the AW-003 documentation conversion. Implement only the review policy and comment policy/trigger portions of section 4.3, in a new migration and matching rollback. H2-2b/payment/coupon, P10/P27/P28, AF, dependency updates, application actions and UI changes are excluded.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| New migration plus exact rollback; historical H1/H2 plans and published SQL remain unchanged. | Historical citations or rollback behavior break. |
| Verify local target, exclusive use and disposable data before mutation/reset; use owned fixtures. | Unrelated local data can be changed or destroyed. |
| Actor requests exercise the subject; fixture service client is setup/readback/cleanup only. | A bypassed RLS boundary falsely passes. |
| Keep State only in progress.md; close product problems only after delivery. | Documents claim a production fix before rollout. |

### 1.4 Owner decisions that bind this entry

- D3 (2026-10-31): use independent Codex chats for implementation and review in the existing checkout and task branch; role selection follows `docs/agent-models.md`.
- D4 (2026-10-31): convert all 32 existing security problem declarations, including closed entries, to canonical SH problem IDs. Preserve scope, status and historical outcomes, retain old IDs as provenance, and add file-qualified mappings. This narrowly permits conversion of closed declaration forms; it does not authorize rewriting historical plans, milestones or published SQL.
- D5 (2026-10-31): commit the approved plan before implementation; local checkpoint and correction commits are permitted. Push, PR creation/update, merge, hosted prepare/apply and hosted writes remain separate, ungranted actions.
- D6 (2026-10-31): use a separate entry plan owned by a canonical SH problem; retain the existing root legacy plans and their existing exceptions. Canonical problem/mapping preparation and the corrected plan commit precede database implementation. Remove the superseded Appendix B through a new correction commit, without amending history.

## 2. Repository facts

Baseline: `ddcefd0cf94067ec680546613124b06ecaafe22e`, checked 2026-10-31. Branch: `fix/h2-community-write-integrity`, created from the matching `origin/main` after PR #42.

Main refreshed only hosted catalog metadata through `supabase db query --linked`, after verifying project ref `lkvxxrxojjlkchzzqidu`. No hosted user rows were read and no application data/schema was changed.

- Both affected tables have RLS enabled. Review INSERT checks the actor's enrollment but does not bind review user_id to the actor. Review UPDATE already checks user_id = auth.uid() in both predicates.
- Comment UPDATE allows owner/admin and has no explicit WITH CHECK; its only existing non-internal trigger advances updated_at. The proposed immutability helper does not exist.
- Table grants for anon/authenticated/service_role include SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER. `is_admin()` is SECURITY DEFINER with empty search_path; the timestamp helper is invoker with empty search_path. Relevant constraints match the replayed repository baseline.
- Hosted history contains only baseline `20261021000000`, H1 `20261021131351`, H2-1a `20261021181051` and H2-1b `20261021185249`.
- QE-U1 ownership helpers and community known-bug cases P3/K1 and P4/K2 exist. Baseline docs checks passed; unit tests passed 171/171 outside the sandbox. The sandbox run failed 26/171 with file/process restrictions and is not passing evidence.
- Plan-only commit 284da8a placed the approved scope in Appendix B. The Owner subsequently selected entry-plan placement; its approved behavioral scope and verification remain unchanged. No database/product implementation had begun at that decision.
- No canonical SH problem IDs were issued before this conversion. Allocate P1-P31 in ascending legacy numeric order, followed by AW-003, producing SH-P1-SH-P32 without collision; mappings retain the historical IDs.

## 3. Bounded implementation hypotheses

Likely changes are the new SQL pair, `__tests__/rls/community.test.ts`, bounded local SQL probes using existing `withPg`, security program records/index, and documentation identifier inventories/checker tests. These are hypotheses; acceptance and exclusions are binding.

| Guarantee | Layer and assertion | Location / prerequisites |
| --- | --- | --- |
| HA1 | Real actor API inserts, direct UPDATE and both upsert branches; assert allowed results, denial codes and persisted readback. Convert P3/K1 to a normal regression. | community tests; owned fixtures and existing actor sessions. |
| HA2-HA3 | Owner/other-user/admin requests, plus separately awaited local SQL SET LOCAL ROLE service_role probes for both immutable columns. Convert P4/K2 to a normal regression. Never use the fixture service client as the request under test. | community tests; owned comments, unchanged seed snapshot, guaranteed SQL rollback/connection release. |
| HA4 | Read trigger/function catalog and effective function privileges, including PUBLIC ACL and inherited actor privileges. | Local SQL catalog checks. |
| HA5 | Capture affected catalog, apply/rollback/reapply the exact files, compare original policy predicates/roles/helper/trigger absence and restored final definitions. | Verified exclusive, disposable local stack; no unmanaged writer. |
| HA6 | Compare all 32 source entries to canonical entries/mappings; test mapping chains, inventory and remaining frozen-plan boundaries. Preserve the existing agent-workflow AW-003 pointer and append the canonical mapping chain where possible. | Docs checks and checker regression suite; no broad legacy exemptions. |

Before any reset/write, establish target identity, exclusive use and disposable data under test-quality-strategy. Docker running alone is insufficient. Track exact owned resources; no broad cleanup or unrelated seed changes. Mutable comments use owned fixtures because UPDATE advances their timestamp. On uncertain readiness or interrupted ownership, stop instead of resetting.

Run safe local migration replay and rollback/reapply checks, then two consecutive full `npm test` runs without an intervening reset. Run `npx tsc --noEmit`, zero-warning `npm run lint`, `npm run docs:check`, `npm run docs:check:test` and `npm run build` with explicit safe local/CI placeholder environment configuration, without reading/copying env files or printing keys. No new browser-only behavior is introduced; real integration assertions cover this database contract, so duplicate browser scenarios are not required. This does not waive hosted postflight.

Residual manual QA: no additional local browser pass is planned because this change introduces no browser behavior and real API/SQL tests exercise the changed boundaries. Hosted catalog and simulated-role postflight remain Main-only and pending their applicable grants.

## 4. Checkpoints

Documentation preparation precedes CP1: create the canonical problem records/mappings, checker regressions and this entry plan; restore the historical H2 plan; review and commit the documentation correction before database implementation. This is the Owner-approved relocation and earlier execution of the documentation work, not an additional product outcome.

| Checkpoint | Outcome | Verification |
| --- | --- | --- |
| CP1 | New migration/rollback and direct regression coverage together; author self-review before any local commit. | HA1-HA5, exact rollback/reapply and repeated full local tests, typecheck/lint/build. |
| CP2 | Canonical problem records/mappings and checker coverage, accurate State, complete final diff. | HA6, docs checks/tests, final scope/meaning comparison and author self-review. |

The implementor makes local checkpoint commits after verification and self-review; Main reviews the actual diff and commits. A fresh independent read-only implementation review covers SQL, rollback, tests, docs and executed evidence. Correct findings through the same implementor; no delivery claim before verification and review pass.

The CP2 documentation acceptance is largely established in preparation; CP2 rechecks its meaning/status and final State after CP1 rather than repeating the conversion.

## 5. Risks, rollout and rollback

| Risk | Mitigation / earliest check |
| --- | --- |
| A privileged writer bypasses immutability. | Unconditional invoker trigger; mandatory admin/service_role denial probes in CP1. |
| Rollback leaves an explicit predicate instead of the original absent WITH CHECK. | Restore exact old policy definition and compare the catalog during CP1. |
| Reset or fixture cleanup affects unrelated local data. | Verify exclusive/disposable target before mutation; use QE-U1 ownership and explicit interrupted-run recovery. |
| Canonical conversion loses historical meaning or breaks citations. | Full 32-entry inventory, mapping chains and checker regressions; preserve the historical plan prefix and all published SQL. |
| Hosted definitions drift before rollout. | Main rechecks affected metadata/history before hosted prepare; stop on differences. |

Rollout requires local verification, independent implementation PASS and green PR CI first. Because this restricts writes without adding a required application caller, Main must confirm existing deployed callers remain compatible before the separately granted hosted prepare/apply procedure. Do not use H2-2b's payment guard/deploy or rollback sequence. Main's hosted postflight verifies the new catalog and allowed/denied actor behavior; any temporary hosted fixtures or application writes require their own Owner grant. Until then hosted prepare, apply and postflight remain pending, and production is not claimed fixed.

Rollback uses the reviewed new down migration to restore pre-H2-2a policy behavior and remove only its trigger/helper. It reopens P3/P4 and therefore requires an explicit Owner decision if needed on hosted. Stop on a new business/permission decision, unexpected catalog drift, missing readiness or failed verification; do not weaken checks or broaden scope.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
