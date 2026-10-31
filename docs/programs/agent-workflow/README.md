# Charter — agent-workflow

Progress: [progress.md](progress.md). Problems: [problems.md](problems.md). Future features: [future-features.md](future-features.md). Each initiative has a detail plan at `implementation-plans/aw-u<n>-<slug>/plan.md`. Roadmap: [ADR 0001](../../adr/0001-modernization-roadmap.md), step 1. Program kinds: [ADR 0002](../../adr/0002-program-kinds.md).

## 1. Capability and boundary

- Capability: the working rules for agents on DevSpace (`AGENTS.md`, with `CLAUDE.md` and `.claude/rules.md` as Claude entrypoint/bindings), the lifecycle loops (`docs/agent-loops.md`), the project skills in `.claude/skills/`, the docs structure and its checks (`docs/README.md`, `docs/adr/`, `docs/backlog/`, `scripts/docs/`), the PR and CI conventions (`.github/pull_request_template.md`, `git-pr-workflow`), and the Codex review process.
- Boundary: product code, the CI workflow jobs (`.github/workflows/`), and the tooling-specific content of a skill that another program's unit adds together with its tooling (infrastructure master plan D9) stay with that program. Program state belongs to each program's own records.

## 2. Owner decisions

One line each: number, date, decision. The decisions of each initiative stay in its plan.

1. (2026-10-23) `agent-workflow` is an evergreen program: its first plan is U1, PR 13's chat plan r3 is U2, and the program-kinds plan is U3 (U3 D6, ADR 0002).
2. (2026-10-23) The evergreen candidates are recorded in AW-F2 with their opening conditions and are not opened; performance skills are a deferred future feature of this program, AW-F3 (U3 D9).
3. (2026-10-25) A `skill-authoring` skill owns how skills and references are written and maintained, the procedural rules of `.claude/rules.md` section 8 move into it, and `npm run docs:check` checks skill shape; this replaces the D4 reason for dropping FEAT-009 (U5 D1 to D3).

## 3. Invariants

Each initiative keeps these; the rule itself lives with its owner.

- One owner per rule, with links elsewhere (`skill-authoring`, Choosing where an instruction goes) — prevents copies that drift apart.
- A skill states only what DevSpace has today (`skill-authoring`, What a skill holds), and no skill widens a permission (`AGENTS.md` section 8) — prevents agents running tools that do not exist or reading a skill as a grant.
- Every Codex brief starts with a "Read first" list (`code-review`, Codex) — prevents Codex reviewing against its own defaults.
- `npm run docs:check` enforces only what `program-docs` and its templates state (`program-docs`, Verify) and what `skill-authoring` states as required (`skill-authoring`, Shape and Choosing where an instruction goes, including the bounded import contract) — prevents the check and the skill disagreeing.

## 4. Initiatives

At most one initiative has an open plan at a time. A closed initiative keeps its row.

| Initiative | Branch | Outcome | Dependencies | Gate to open |
| --- | --- | --- | --- | --- |
| U1 [Working rules, skills and docs system](implementation-plans/u1-working-rules/plan.md) | `chore/agent-workflow` | A fresh session finds and follows the working rules, loops and skills; program docs have a machine-checked shape. | none | Owner approval of the plan (2026-10-22) |
| U2 [CI result in the PR body and hosted apply with db push](implementation-plans/u2-ci-result-db-push/plan.md) | `docs/ci-result-and-db-push` | The CI result goes into the PR body; hosted migrations are applied with `db push` behind two grants; migration and handoff rules. | soft on infrastructure U2 (merged) | Owner approval of chat plan r3 after the Codex plan gate |
| U3 [Program kinds: delivery and evergreen](implementation-plans/u3-program-kinds/plan.md) | `docs/program-kinds` | Delivery and evergreen programs; `agent-workflow` becomes evergreen; migration citation, CI wait and checkpoint commit rules. | hard on U2 (merged) | Owner approval of the plan after the Codex plan gate |
| U4 [Agent instructions match the infrastructure](implementation-plans/u4-instructions-sync/plan.md) | `chore/agent-instructions-sync` | AW-006 fixed: handoff template, `npm run dev` and manual QA on the local stack, a seed rule for QA, one suite mapping, one owner for CI facts and permissions, current `README.md` and pointers. | none (U3 merged) | Owner approval of the plan after the Codex plan gate |
| U5 [Skill authoring skill and the skill-shape check](implementation-plans/u5-skill-authoring/plan.md) | `chore/skill-authoring` | `skill-authoring` owns the skill procedure, section 8 keeps only the permission rules, `docs:check` checks skill shape; the PR 21 docs catch-up. | none (U4 merged) | Owner approval of the plan after the Codex plan gate |
| U6 [Instruction audit and the AW-007 rewording](implementation-plans/u6-instruction-audit/plan.md) | `chore/instruction-audit` | Every audit item is moved, linked, reworded, removed or confirmed as the Owner decided; section 2 states when Main edits state records; the PR 22 docs catch-up. | none (U5 merged) | Owner approval of the plan after the Codex plan gate |
| U7 [Entry plans for follow-up work of a delivery program](implementation-plans/u7-entry-plans/plan.md) | `chore/entry-detail-plans` | AW-010 fixed: a delivery program plans a `problems.md` or `future-features.md` entry without revising its master plan, checked by `docs:check`; the PR 23 docs catch-up. | none (U6 merged) | Owner approval of the plan (no Codex gate, U7 D4) |
| U8 [Shared agent rules with Claude-specific bindings](implementation-plans/u8-shared-agent-rules/plan.md) | `chore/share-claude-skills` | Shared rules and Claude bindings preserve behavior, verified by bidirectional baseline traceability, bounded checks and a full instruction audit. | existing local shared-skill commits `2765f37`, `94f5f26` | Owner approval 2026-10-29; r4 records local implementation-commit grant; Medium, no automatic Codex gate |
| U9 [Automated-first testing policy](implementation-plans/u9-test-policy/plan.md) | `chore/test-policy` | FEAT-021: contract-based automated test selection, safe data prerequisites, justified residual manual QA and consistent current instructions. | U8 merged (PR #37); U1 coverage baseline (PR #38) | Owner approved r1 on 2026-10-29 after rediscovery/self-review; plan-first and local checkpoint commits granted; Medium, no automatic Codex gate |
| AW-U10 [Program-scoped work identifiers](implementation-plans/aw-u10-task-naming/plan.md) | `chore/task-naming` | Program/kind/number identifiers, migrated open records and strict validation with bounded historical exceptions. | U9 merged (PR #39) | Owner approved r2 on 2026-10-29 after self-review PASS; plan commit and separate-session implementation with local checkpoint/correction commits granted; Medium, no automatic Codex gate |
| AW-U11 [Codex app callback and receipt handoffs](implementation-plans/aw-u11-codex-callbacks/plan.md) | `chore/aw-p4-callback-receipts` | AW-P4: app-chat result/receipt handoffs with verified feasibility; preserve Claude Code, OpenCode and Codex CLI execution paths. | AW-F4 delivered (PR #41) | Owner approved r2, plan commit and implementation 2026-11-01; CP0 feasibility and independent review precede operational rollout |
| AW-U12 [CLI-first tooling and repository-controlled delivery](implementation-plans/aw-u12-cli-first/plan.md) | `chore/aw-p3-cli-first` | AW-P3: current machine CLI tooling, supported CLI-first selection and existing repository delivery authority; PR #44 docs catch-up. | AW-U11 delivered (PR #44) | Owner approved r2, plan commit and implementation 2026-11-01, with local checkpoint/correction commits; Medium, no automatic Codex gate |

## 5. Opening an initiative

1. The Owner names the work. Main confirms it is inside the boundary above (an initiative belongs to exactly one program) and that no initiative of this program has an open plan (ADR 0002).
2. A small task that meets the small-task conditions (`docs/agent-loops.md`, Sizing) needs no plan and no row; it is recorded as one milestone in `progress.md`.
3. Otherwise Main writes the detail plan at `implementation-plans/aw-u<n>-<slug>/plan.md` from the detail-plan template, with the next `AW-U<n>` under the allocation rule in `program-docs`, adds its row above, and self-reviews it. The plan gets the Codex gate whenever `AGENTS.md` sections 2 and 3 require it for its size and risk.
4. The Owner approves the plan; State in `progress.md` then names the initiative and its revision.
