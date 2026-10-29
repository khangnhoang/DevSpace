---
name: planning
description: "Planning workflow for DevSpace work past the small-task conditions: repository discovery, Owner decisions, master vs detail plan, PR breakdown and batching small independent items into one PR, acceptance, verification and manual QA matrix, and the implementor brief. Use before coding anything that is not a small task, when splitting work into PRs or batching small items into one, or when writing or revising a plan."
---

# Planning

## Use when / do not use when

Use when the work is not a small task (`docs/agent-loops.md` Sizing owns the four conditions and the medium and large flows): unclear scope, several files or domains, a schema, RLS, auth, payment or permission change, PR splitting, batching small independent items into one PR, a plan to write or revise, or an implementation brief to hand to the implementor.

Do not use for a single small task the Owner named (Main implements directly), a pure text fix, or implementing an already approved plan with no new conflict. Planning-only and read-only requests stay non-implementation: "analyze", "inspect" or "plan" is not permission to code.

Doc shape (master plan, detail plan, progress, problems) belongs to `program-docs`; read it before writing or reshaping plan files. Domain rules belong to `supabase-migration`, `server-actions`, `frontend-design` and `frontend-workflow`; read those that match and reconcile them before ordering work.

## Workflow

1. **Scan before writing.** Read `docs/backlog/` for entries in scope, and the owning program's plan (`plan.md`, or the charter `README.md` of an evergreen program), `progress.md` and `problems.md`. Pull a matching backlog entry into the plan, or move related entries into a program, instead of duplicating them.
2. **Understand the request.** Actor and goal, current and expected behavior, business rules, state transitions, permission-sensitive behavior, data needed, scope and exclusions, failure paths. Do not reduce a business task to its nearest UI.
3. **Inspect the real repository** before asking anything: entry point, validation and permission, business rule, mutation, persisted state, response, UI feedback. Confirm paths, payload shapes, nullable fields, statuses, RLS behavior and the verification commands that exist. Do not invent files, APIs, scripts or test tooling.
4. **Classify evidence.** Confirmed facts (code, docs, migrations, hosted metadata snapshot), assumptions, conflicts, open questions. Never present an assumption as a fact or hide a conflict inside the solution.
5. **Ask the Owner before the plan is written** (`AGENTS.md` section 6 owns the rule and the format): decisions the repo cannot answer and that change the Spec (product behavior, scope, permission, risk). Do not ask the Owner about repo facts or reversible implementation details.
6. **Write the plan** at the size the Sizing rules give. Keep three things apart:
   - **Spec** (binding): outcome, observable acceptance, scope and non-goals, Owner decisions, and only guardrails whose omission causes a concrete failure;
   - **facts** (frozen evidence with a baseline commit): only those that justify a Spec item;
   - **hypotheses**: likely files and wiring, which implementation may replace if the Spec holds.
7. **Dependencies and PR split.** Order by the real dependency graph (migration, then types and contract, then action, then UI, then QA), not by numbering; the parts of one item always follow that order. One coherent, reviewable, verifiable outcome per PR, with one exception, a batch: small independent items (different files, verified separately, neither affects the other) may share one PR, each with its own commits and its own verification in the PR body. An item that needs the Codex gate or a hosted step does not join a batch. Inside a batch, the items run the easiest to verify first. A batch may hold an item of another program or of the backlog; how each part is recorded and closed in its own records follows `program-docs` (Lifecycle, index and ADRs; Problems and future features; Backlog). Read [pr-breakdown-and-brief.md](references/pr-breakdown-and-brief.md) when the work needs a split, parallel streams or an implementor brief.
8. **Acceptance** as actor + action + condition + expected result ("A learner cannot read paid lesson content without enrolling"), never "the feature works".
9. **Verification and manual QA.** Allocate observable guarantees to assertions, layers, existing/new test locations and prerequisites under [test-quality-strategy](../test-quality-strategy/SKILL.md#select-checks-from-the-contract); use only current commands from its [command table](../test-quality-strategy/SKILL.md#which-command-for-which-change). Name bounded fixture/helper extensions or concrete blockers with their resolution. Plan residual manual scenarios with individual reasons (`frontend-workflow`), retaining explicit Owner QA and approved feature minima. When the plan has a hosted rollout, keep Main's simulated-role SQL postflight (`supabase-migration`); a policy/grant change plans RLS tests. Name what cannot be checked. For data/role-dependent verification, read [qa-matrix.md](references/qa-matrix.md) and write the allocation and residual QA matrix.
10. **Risks** with impact, mitigation and the earliest checkpoint that exposes them. Expose high-risk assumptions early within a valid order.
11. **Self-review** the plan (method in `code-review`), then report with a `Tự review` block. A large or high-risk plan goes to the Codex gate; the migration in it is Codex-gated before it is applied.

## Git and approval

- No git action on a plan unless the Owner asked for it. By default a plan is not committed at all.
- If the Owner granted a commit, commit the plan only after its review passes (self-review, plus Codex PASS when the work is gated or requested). Review rounds run on the uncommitted file; give Codex the working-tree file and a `git diff` against the last committed revision. Keep fixes uncommitted until the pass.
- Plan approval and implementation permission are separate Owner grants, and so are the git, remote and hosted grants owned by `AGENTS.md` section 4. A review verdict grants none of them (`docs/agent-loops.md`, Precedence). A clear current instruction may state the behavior and grant implementation in one turn.
- After the plan passes its review (self-review, or Codex PASS when the work is gated), Main summarizes in chat what the Owner must read in the plan (the Owner decisions, the binding Spec items, the risks), then asks the grants in this order: approve the plan, commit the plan (only when the plan is a file), implement, following `AGENTS.md` section 6 (Asking decisions).
- A PR split is an approval boundary, not a git operation.

## Planning a program

The shape of a new program, delivery or evergreen, and the reshape of a single-unit program that gains a second unit belong to `program-docs` (File roles and the migration procedure). For a multi-unit program, read [master-plan-workflow.md](references/master-plan-workflow.md).

## Resources

| Resource | Read when | Skip when |
| --- | --- | --- |
| [master-plan-workflow.md](references/master-plan-workflow.md) | writing or materially revising a master plan | one detail plan or a chat plan |
| [pr-breakdown-and-brief.md](references/pr-breakdown-and-brief.md) | splitting into PRs or checkpoints, deciding parallel work, or writing the implementor brief | one coherent delivery boundary and no handoff |
| [qa-matrix.md](references/qa-matrix.md) | verification depends on data, roles or hosted state | no data/role-dependent verification |

## Red flags

Implementation starting during discovery; paths or contracts proposed before inspection; assumptions stated as facts; hidden conflicts; PR order by number; missing scope, exclusions or verification; invented tooling; file count used as a size rule; dependent items, or an item with the Codex gate or a hosted step, batched into one PR; a batched item without its own commits or verification; a bug fix with neither a planned regression test nor a concrete blocker/resolution; missing verification allocation or reasons for residual manual QA; approved acceptance checks omitted; progress marked done before verification; a plan committed before it passed review.

## Final check

- [ ] backlog and the program's docs were read; instructions and skills that match were read
- [ ] facts, assumptions, conflicts and questions are separate; Spec, facts and hypotheses are separate
- [ ] only Owner-controlled decisions were put to the Owner, before writing
- [ ] scope, exclusions, dependency order, acceptance, verification, manual QA and risks are explicit
- [ ] migrations and permission changes are marked Codex-gated
- [ ] self-review done; no git action beyond what the Owner granted
