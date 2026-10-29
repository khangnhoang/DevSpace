# U9 detail plan — automated-first testing policy

Revision: r1, 2026-10-29. Owner approval: 2026-10-29 (native question response; scope and plan approved). Charter: [agent-workflow](../../README.md). Entry: FEAT-021. Branch: `chore/test-policy`.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: an agent derives verification from the changed contract and chooses existing automated layers before assigning residual manual checks. Current coverage is an inventory, not a ceiling. Test planning, frontend verification and review consume one testing policy without inventing tooling or weakening safety.

Size: Medium, with cross-agent instruction impact. This changes documentation only: no application, permission, database, CI or testing runtime. No automatic Codex gate under `AGENTS.md` sections 2–3; an Owner-requested gate still applies. One coherent PR after plan approval, implementation and review; remote delivery is a separate grant.

| ID | Observable result |
| --- | --- |
| AC1 | For a task that changes behavior, an agent identifies observable behavior, invariants, relevant edges/failures, actors/permissions and competing operations before choosing checks. Each applicable guarantee maps to a layer, assertion, existing/new test location and prerequisite; irrelevant dimensions need no boilerplate cases. |
| AC2 | A pure transformation uses unit tests; a real policy, constraint or persistence guarantee uses local integration; browser wiring/state uses E2E where needed. The existing `rls` Vitest project and Playwright API/action fixtures remain the runners; no imaginary integration command or new framework appears. Distinct endpoint and RLS boundaries may both need tests without duplicating every assertion. |
| AC3 | A non-payment action, new UI flow or missing fixture does not default to manual-only QA. The agent plans a bounded test/helper extension within the feature's approved scope, or records a concrete blocker and resolution; existing coverage is never claimed for an untested action. Tests needed for a feature ship with it, not as an unspecified later follow-up. |
| AC4 | Manual QA is justified per remaining scenario: perceptual/design judgment, exploratory checks or genuinely live external-provider verification. Existing automated assertions are reused instead of mechanically repeating them by hand. Explicit Owner QA requirements and approved program-specific test minima remain binding unless separately changed. |
| AC5 | New/changed tests plan owned fixtures, safe target/exclusive-use checks, cleanup on setup/test failure, error/read-back checks and interrupted-run recovery. Existing broad cleanup is documented honestly as a legacy gap, usable only on a verified exclusive disposable local stack; this PR does not claim to fix it or make a shared reset safe. Without safe prerequisites the run stays blocked. |
| AC6 | The policy distinguishes stable invented seed data from temporary owned fixtures. Setup/read-back/cleanup may use service role; the request under test uses the actor. No hosted/user-data permission, password-entry rule, network guard, known-bug contract or review gate is widened. |
| AC7 | Failure paths and relevant races are planned with their final invariant; sequential retry, stale-tab interaction and actual competing requests are distinguished. A currently unsupported expected-error probe stays a named gap; guards are not weakened to make it pass. |
| AC8 | Planning, frontend workflow, manual QA, server-action verification, review and the Radix dependency row route selection to `test-quality-strategy`. Blanket manual passes and smoke/payment ceilings are removed without erasing visual, security or hosted verification requirements. |
| AC9 | Current facts and pointers agree with U1: E2E includes real fixture deletes and non-payment failure handling; FEAT-013 no longer waits for native-confirm replacement or lists already-covered delete behavior as wholly untested. Earlier closed plans and ADRs remain historical. |
| AC10 | Zod-specific procedures/tests remain with AF U2, which adds the package and schemas. The general policy requires tests alongside validation changes without pretending Zod already exists. FEAT-022/023/024 and FEAT-014 retain their independent scopes. |
| AC11 | Baseline-to-candidate review accounts for every changed instruction as an intended change, retained safeguard or corrected fact. All changed skill resources are identical and reachable through canonical and symlink paths; docs checks and the written decision scenarios below pass. This is static evidence, not proof of future runtime agent compliance. |

### 1.2 Scope and non-goals

- In scope: the testing selection/data-safety contract; its direct consumers; bounded stale coverage/readiness facts; instruction verification; program records and U8 merge catch-up from PR #37.
- Non-goals: implementing safe-cleanup helpers or separate stacks (FEAT-022/014), adding product/failure/race coverage (FEAT-023/013 or the feature that needs it), CI changes (FEAT-024), new packages/runners, Zod adoption (AF U2), application fixes, database mutations, live provider calls or browser QA in this documentation task.
- Preserve approved app-foundation minima (shared-schema unit tests and per-form successful/rejected E2E or a justified plan exception). Do not rewrite the approved master/detail plans to fit this policy.
- Do not rewrite the vendored Playwright body/references, generic report formats or unrelated rules merely because they contain the words "manual" or "test".

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. `test-quality-strategy` owns selection and test-data requirements; consumers link to it and own only their procedure. | Conflicting manual/automated selection rules recur. |
| G2. Derive policy from available code; distinguish existing helper capability from current coverage and missing behavior. | An agent invents coverage, a command or a safe-fixture helper. |
| G3. Preserve permissions, actor requests, local/hosted boundaries, known-bug handling and fail-loud evidence; do not reduce required checks as an incidental optimization. | Automated-first language becomes permission to mutate shared data or hide a failing test. |
| G4. A missing fixture/tool is a planning dependency, not automatic manual fallback or authorization to expand scope. | Work either avoids regression coverage or silently grows. |
| G5. Preserve Owner-requested manual checks and approved program minima. Mechanical checks may be automated; genuinely human/provider checks remain explicit. | An agent treats this general policy as an override of acceptance or live verification. |
| G6. For skill content, edit only the canonical `.claude/skills/` path; keep directory symlinks intact. Preserve vendored provenance and change only directly related facts outside skills. | Copies diverge or a broad cleanup damages unrelated instructions. |

### 1.4 Owner decisions that bind this unit

- 2026-10-29: record testing improvements as four PRs; FEAT-021 is instruction policy, with helper lifecycle, coverage and CI separate.
- 2026-10-29: do FEAT-021 before AF U2; Zod-specific testing guidance arrives with U2, and its schema tests ship with its schemas.
- 2026-10-29: create a fresh branch and investigate similar manual-first/stale instructions before finalizing scope; the discovery below supplies the approved scope's evidence.
- 2026-10-29: the Owner approved r1 through the native question interface, then explicitly granted committing this plan before implementation and local commits throughout checkpoints/corrections. Push, PR and merge remain separate grants.
- Shared policy, lifecycle, environment bindings, single-writer ownership and per-task grants remain with their existing owners. No new permission or execution mechanism is introduced.

## 2. Repository facts

Baseline: `572da83636ff84bfbecb9523c0ddbed9a440ced1` (main after PR #38), checked 2026-10-29. Discovery is read-only; the locations below describe the baseline, not implementation results.

| Evidence at baseline | Classification | Proposed owner/disposition and reason |
| --- | --- | --- |
| `.claude/skills/test-quality-strategy/SKILL.md:12,29,86,95,98` | in place | Correct owner, incorrect selection: non-payment actions default to manual, and new tests depend on the current smoke/payment catalog. Replace the ceiling with contract-based layer selection; retain truthful coverage reporting. |
| `frontend-workflow/SKILL.md:3,14,31` and `references/manual-ui-validation.md:3` | duplicate or restatement | Selection belongs to test-quality-strategy. A missing automated row currently implies manual validation; the description also encourages that route before the body is read. Keep frontend execution/manual mechanics, replace blanket routing. |
| `planning/SKILL.md:29,55` and `references/qa-matrix.md:5,22` | duplicate or restatement | Planning owns the evidence table, not a second testing policy. Replace unconditional manual-pass wording and seed-only preparation with policy-based allocation and explicit residual QA/readiness. |
| `server-actions/SKILL.md:54` | in place | Hostile-call reasoning is useful but not execution evidence. Link to planned actor/validation/persistence tests and report any unrun probes; do not change action/auth contracts or add Zod early. |
| `code-review/references/domain-dimensions.md:19` | in place | Review should verify planned/new coverage, data safety and justified residual manual checks, rather than merely consult an old inventory. Other review language about a *required* manual check is valid and stays. |
| `dependency-updates/SKILL.md:94` | duplicate or restatement | The Radix row mandates a manual Escape/focus/pending pass even though U1 has A10/T5/AP5. Keep dependency commands and portal/focus risks; delegate automated/manual allocation to the policy. |
| `test-quality-strategy/SKILL.md:35,43,74-78` and `references/rls-test-design.md` (Data and cleanup) | in place | Markers and afterEach are not sufficient ownership/recovery guarantees; reset after a killed run needs exclusive target/use checks. Seed is appropriate for stable baseline data, not the automatic home of every temporary scenario. FEAT-022 implements helper enforcement later. |
| `supabase-migration/references/rpc-trigger-concurrency.md:28,34` | in place | Keep atomicity/permission rules and Main-only SQL authority. Clarify that missing API reachability/minimal seed calls for a planned local integration mechanism or an explicit blocker, not an unstructured manual fallback; distinguish real races from sequential requests. |
| `AGENTS.md:17`, `planning/references/qa-matrix.md:5`, `manual-ui-validation.md` (What the local stack cannot show) | in place | Correct fact owners, stale/narrow descriptions: E2E now includes U1 deletes/errors; a local dev AI key is already supported. Separate current dev limitations, guarded E2E capabilities and live provider quality. |
| `docs/backlog/future-features.md:14` (FEAT-013) | in place | Its native-confirm dependency is completed; some delete/comment behavior now has U1 tests. Narrow the outstanding inventory with actual A4-A10/T4/T5 evidence; do not close the whole feature or add its remaining tests here. |
| `AGENTS.md` permissions, `docs/agent-loops.md` required-manual wording, `.claude/rules.md` browser binding, frontend-design perceptual/accessibility goals | in place | These are safeguards, lifecycle, tool bindings or design goals, not manual-first selection defects. Preserve; only AGENTS' E2E command description needs a factual correction. |
| Playwright DevSpace override block; generic brief/report/template fields for automated/manual evidence | in place | Tool selection and evidence fields are valid. No vendored rewrite or removal of manual-report fields is needed. |

Additional code evidence:

- `__tests__/e2e/server-action.ts` exposes `ActionCaller(caller, filename, exportedName, args)`, but `__tests__/helpers/server-action-core.ts:10` hard-codes only the course and transactions page workers in `WORKER_URLS`. Signature/manifest matching is generic; routing is not yet general. New non-payment endpoints can require a bounded worker/fixture extension in their feature (for example AF U2); U9 neither changes this helper nor claims those endpoints are executable unchanged.
- `__tests__/e2e/admin.spec.ts` A3-A10, `student.spec.ts` T4/T5 and `payment-admin.spec.ts` AP4-AP6 show non-payment failures, real fixture deletes, keyboard/mobile/stacking and pending-state assertions.
- Vitest currently has `unit` and `rls` projects; Playwright also sends actor requests through `callAction`. There is no `test:integration` script.
- `fixtures.ts` fails unexpected page errors/5xx; `server-action.ts` rejects HTTP errors. New expected-failure infrastructure remains FEAT-023, not a capability this policy may promise.
- `service-role.ts` still has broad legacy cleanup. PR #38 fixed Auth lookup/delete error handling, not ownership or cross-process isolation; FEAT-022 records this.
- `__tests__/helpers/dev-env.ts` permits the Owner's AI key in local development; E2E uses a placeholder key and external-network guards. Real-provider access is not a prerequisite for every application behavior test.
- Provenance search finds the non-payment manual fallback in `2df8637`, frontend blanket wording in `a3a2ce8`, and the Radix manual requirement in U1 `3e5fdf2`; U1's later tests supersede the earlier coverage inventory.
- U8 is merged in PR #37; its State still describes local/pre-PR work. Reconcile that lag before recording U9 as the only proposed initiative.

## 3. Bounded implementation hypotheses

- Extend existing `test-quality-strategy/SKILL.md` rather than add a framework or another testing skill. A reference is justified only if it isolates situational detail; do not create an audit database or keyword-enforcement checker.
- Align `frontend-workflow/SKILL.md`, its manual validation reference, `planning/SKILL.md` and its QA-matrix reference. Keep the QA-matrix path stable; it may carry verification allocation plus a clearly identified residual manual table rather than a second policy.
- Update the focused verification paragraphs in `server-actions/SKILL.md`, `code-review/references/domain-dimensions.md`, the Radix dependency row, RLS fixture guidance and the RPC/concurrency reference. Do not touch unrelated domain contracts.
- Correct the AGENTS E2E command description and FEAT-013 inventory. Keep FEAT-021 open as planned/fixed locally until its delivery PR exists; FEAT-022 to FEAT-024 stay separate.
- Program files: this draft, charter U9 row, FEAT-021 status and progress (including PR #37 catch-up). No approved behavior changes before plan approval.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Canonical automated-first selection, coverage model, safety prerequisites and truthful current capability/legacy-gap description. | Review AC1-AC7/AC10 against baseline and current runners/helpers; `npm run docs:check`; skill/symlink resource comparison. |
| CP2 | All direct consumers route to the policy; stale U1/FEAT-013 facts corrected; permissions and existing acceptance minima retained. | Re-run targeted manual/smoke/payment/seed searches; disposition every occurrence in the scope table; `npm run docs:check`; inspect diff for accidental policy loss or future tooling. |
| CP3 | Final baseline/candidate instruction review, decision scenarios, program State and author self-review pass. | `npm run docs:check`, `npm run docs:check:test`, `git diff --check`, full changed-resource/symlink/link checks and the written cases below; report limitations explicitly. No product suite/browser/database run solely for prose changes. |

Written decision cases (static applications of the candidate rules, not live model evaluations):

| Case | Expected routing |
| --- | --- |
| Non-payment action adds an input/permission check | Unit where pure plus actor endpoint integration where needed; plan missing fixtures/export support; do not claim payment coverage or default to manual. |
| A future shared validation schema is added in AF U2 | Unit tests ship in that feature PR; endpoint tests cover actual enforcement separately. No Zod-specific procedure is activated by U9. |
| Form wiring changes under an approved app-foundation plan | Preserve its successful/rejected E2E minimum or approved exception; avoid duplicating all pure cases in the browser. |
| UI pending/cancel/focus behavior already has a relevant E2E row | Reuse/extend it; justify any additional visual/exploratory pass separately. |
| Missing scenario data | Choose stable seed or temporary owned fixture deliberately; a bounded extension needs feature scope, safe cleanup and readiness. |
| Two tabs/repeated requests affect a shared counter | Separate retry/stale-state behavior from genuine concurrency; identify contenders and assert the final persisted invariant. |
| An expected 500 is rejected by the current guard | Report the harness gap and plan scoped support; do not disable guards or call a weaker check equivalent. |
| Gemini key is absent or expired | Automate applicable application behavior with available boundary controls; real provider quality remains unverified and any acceptance exception requires the Owner. |
| Cleanup/reset target or exclusive use is uncertain | Block mutation; local loopback or one worker is insufficient. No hosted fallback. |
| Endpoint authorization and RLS protect different entry points | Test both applicable boundaries; avoid duplicating the full matrix when assertions cover the same guarantee. |
| A docs-only task changes no runtime contract | Docs/static instruction checks; no invented requirement to launch a browser/database suite. |
| A live external-provider/hosted check is explicitly required | Preserve the check and its permission gate, report pending evidence honestly; automated-first does not waive it. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| "Automated first" is interpreted as E2E for everything or a coverage quota. | CP1 requires the smallest sufficient existing layer and risk-relevant dimensions; retain approved feature-specific minima. |
| Manual-first wording survives in another loaded skill/reference. | CP2 scans the entire current instruction surface, including descriptions; record preserved occurrences and their purpose rather than replacing every "manual" word. |
| General data requirements imply unavailable helper guarantees or force FEAT-022 into this PR. | CP1 distinguishes new/changed test obligations, legacy behavior, exclusive disposable-stack prerequisites and the separately tracked implementation. |
| A rewrite drops a safety rule or invents a permission. | CP3 compares both directions to `572da83`, with each deletion/addition justified by an AC, correction of fact or preserved owner pointer. |
| Existing frozen plans contradict a new blanket instruction. | AC4/G5 retain explicit approved acceptance/Owner QA and leave closed plans historical; unresolved material conflicts return to the Owner before implementation continues. |
| Static written cases are mistaken for runtime agent evaluations. | AC11 reports their precise evidence limit. No model dispatch or behavioral benchmark is included. |

- Rollout: approve this draft, then implement the approved instruction change with one assigned writer under the available authorized execution method; review until no Critical/Required finding. Commit/push/PR/merge require their separate grants. No hosted step.
- Stop when: a new permission, runtime helper/framework, CI change, approved Spec change or different program is needed; another initiative is genuinely still active; or a reference cannot be reconciled without widening scope.
- Rollback: an authorized correction/revert of the instruction PR; retain any independent tests/fixtures introduced by later features and reassess their instructions rather than silently reverting those features.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
