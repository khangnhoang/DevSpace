# AW-U15 detail plan — Motion guidance and instruction audit corrections

Revision r3, 2026-11-24. Approved by the Owner on 2026-11-24. [Charter](../../README.md).

## 1. Binding Spec

Ship the root frontend runtime dependency `motion`, its design and implementation guidance, the corrections below from the November 24 instruction audit, and the previous task's documentation catch-up in one PR. No application UI, migration, hosted read/write, deployment command or repository setting changes.

| Audit item | Acceptance |
| --- | --- |
| M1, E4–E5 | Explore Motion during design after stating the purpose. Prefer CSS for simple effects and existing Motion primitives before custom logic. Check interrupted interactions against their actual contract, including refused duplicate submissions and reduced motion. Route package installation through the actual implementation grant and owning manifest. Route public playground composition and practice feedback to their respective references. |
| E1–E2, E6 | An explicit review request covers cosmetic fixes. Inspect/watch alone never writes the PR body. A grant for a PR write covers its CI result and a separately authorized next action may proceed after its gates. Distinguish schema-check failures from test failures and valid docs-only skips from missing checks. Apply the Preview decision below. Align independent and stacked branch bases and explicit-path staging. |
| E3, E9–E10 | Keep the reviewer read-only and the existing Main metadata permission. Define the named-backup grant, exact project check before the Owner's linked commands, evidence limits of restore and cleanup, and rollout decision below. |
| E7–E8 | Differentiate page access and action authorization. Ground shared schema import guidance in the actual browser and backend build boundary. Require atomicity for inseparable writes and error handling. Align runner summaries with fresh starts, retained clean data, changed inputs, drift, unclean or missing state and forced reset, including precedence. |
| E11–E13 | Correct nested/root progress pointers, next-ID placeholders, Spec vs implementation deviations, and the stop on an incompatible reshape of a migration-cited path. Align the handoff template with the one-task lifecycle and each trigger. Reserve known-bug wrappers for recorded defects left open. Preserve vendored upstream content. |
| Catch-up | Record PR 91 merge and live dev-provider evidence. Close TM-P11 using the Owner's confirmed successful C++ output and compile-error display on production. |

Owner decisions of 2026-11-24:

1. Under authorization to verify one named hosted backup Main may also read its hosted service versions. Counts and migration history retain their existing scope. The Owner performs dumps and downloads. This initiative itself performs no hosted verification.
2. Prefer a phased, compatible rollout when a guard would block an active writer. Stopping writes is an alternative only with separate Owner approval for that rollout. A general migration grant does not authorize an interruption.
3. Classify a failed Vercel Preview. Code, build or deployment configuration failures attributable to the PR and unknown causes block merge. Only a verified cause independent of the PR, such as provider billing or infrastructure, is eligible for an exception. All required checks must satisfy their gates, branch protection must allow merge and the Owner must approve the exception for that PR. Preserve the failure and evidence in the PR result. A general merge grant cannot waive a failed Preview.

## 2. Repository facts

The following checks close the individual audit findings. Instruction paths below use the project skill names for brevity.

| Finding | Owning instruction and closure evidence |
| --- | --- |
| M1 | Frontend design and workflow: resolve `motion/react` from the installed root runtime package and check `motion` and `AnimatePresence`. Read the revised rule against an interruptible filter (last accepted selection wins), a guarded submit (one side effect) and reduced motion (same functional outcome). |
| E1 | AGENTS §3: a cosmetic Owner QA fix gets a Codex review when the Owner explicitly requests it. Otherwise that fix has no automatic round. |
| E2 | Git PR/CI reference and Loop 3: walk watch-only, authorized PR update and separately authorized merge. Verify the schema step in ci.yml. Accept skipped db/e2e only when the docs-only classifier explicitly matches. Missing, unexpectedly skipped or pending required checks block. Walk each Preview case against decision 3. |
| E3 | Amend AGENTS §4's named-backup grant with decision 1. Reconcile the backup runbook, lifecycle summary and reviewer rule. Compare permitted Main reads, Owner-only dump/download and read-only review with no grant to edit. |
| E4 | Frontend design/workflow and dependency-updates: compare plan approval alone with an implementation grant covering the package. Trace root, workspace-only and lockfile-only diffs to their actual files. |
| E5 | Frontend design routing table and references: a public playground layout reads public guidance, editing feedback reads learning guidance, and mixed work reads both. |
| E6 | Git workflow and its branch reference: trace independent work to latest main and stacked work to the verified dependency head. Stage explicit paths in either case. |
| E7 | Server-actions and async form reference: compare page helper return shape with action failure results, trace shared schema import closure to the backend build and require one atomic operation for inseparable writes plus error handling. |
| E8 | Test-quality-strategy and AGENTS command summaries: compare with decideReset in order. Force resets first. Otherwise a fresh volume starts seeded without an extra reset. For retained data, dirty run, missing hash, changed hash or drift resets; clean matching state is reused. |
| E9 | Supabase migration rollout and hosted apply: trace an additive change, compatible guard, guard blocking a current writer and a post-deploy restriction. Only separately approved downtime permits the write-stop alternative to a phased rollout. |
| E10 | Backup runbook: missing, unreadable or mismatched project ref stops before any linked call. Verify import, counts, migration versions, Storage size and available MD5 checks against the runner. Equal counts do not prove equal row contents. Only verified teardown establishes removal. |
| E11 | Program docs and templates: test copied root/nested links, next IDs and placeholders. Keep implementation deviations distinct from approved Spec changes. If the reshape would move, rename or renumber a path cited by a published migration, stop before any such change regardless of checker results. |
| E12 | Handoff template and Loop Handoff: create a one-task record on Owner request or when a long session must stop with work still in flight. A merge with lag trims or creates a catch-up. A requested next handoff transfers the catch-up once. Delete on completed records or cancellation, trim partially completed work. Compare each trigger to its owner. |
| E13 | Playwright DevSpace block and known-bug reference: an unfixed recorded defect uses the wrapper, a fix in scope uses an ordinary regression. Diff vendored files to verify only the DevSpace block changed. |

Baseline `281c3a8`. PR 91 merged on this revision. The three Motion-related skills, root manifest and lockfile already have local changes. The independent audit compared the instruction corpus with those skill changes. Its findings are advisory until verified against the owners. The test runner makes its fresh/retained decision in `scripts/test-stack/ensure.mjs`. The backup runner reports table counts, migration history and the number of Storage MD5 comparisons. CI runs its schema comparison in its own step.

## 3. Bounded implementation hypotheses

Edit each rule in its existing owner and repair inconsistent consumers. Use examples or links in templates that remain valid under the documentation checker when copied to the intended location. Verify the existing accepted template-link issue against its original condition before changing its disposition. Use static fixtures or a local copy for checking runbook examples.

## 4. Checkpoints

| Group | Verification |
| --- | --- |
| Motion installation and UI/dependency guidance | Review manifest and lockfile diff, verify import and symlink parity, check the two different interruption contracts. |
| Instruction audit corrections | Trace all thirteen groups to owning instructions and source. Compare grants and all branches of backup, rollout and Preview decisions. Run docs checks, verify links from both skill paths and preserve vendoring boundaries. |
| State catch-up | Verify PR 91's merge at `281c3a8` with Git. Use its body for Main's desktop dev-stack checks against live Wandbox. Attribute the two production outcomes to the Owner's separate confirmation. |

Main self-reviews the plan and diff. Use an independent plan review and a final instruction audit with `gpt-6.2-sol` at high effort. Obtain Owner plan approval before handing the expanded corrections to the assigned implementor. Preserve the Owner's ordering: audit and correct to PASS, then run final regression, then create local commits by related group. Before delivery run formatting checks, docs checks, typecheck, lint, build, full Vitest and E2E through the repository entrypoints. Push, open the PR, record CI at the current head and merge under the Owner's delivery grants only when its gates pass.

## 5. Risks, rollout and rollback

Unverified evidence is the main risk: a green preview of another commit, an inaccessible provider log, a successful import with unequal data, or a failed teardown cannot support a stronger claim. Keep pending checks visible. Validate hosted procedures statically. No browser QA is needed for a visible change because the task adds no UI. Rollback is a reviewed revert of the relevant commit group under a separate grant.

## 6. Progress

[Progress and milestones](../../progress.md).
