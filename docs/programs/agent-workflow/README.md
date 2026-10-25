# Charter — agent-workflow

Progress: [progress.md](progress.md). Problems: [problems.md](problems.md). Future features: [future-features.md](future-features.md). Each initiative has a detail plan at `implementation-plans/u<n>-<slug>/plan.md`. Roadmap: [ADR 0001](../../adr/0001-modernization-roadmap.md), step 1. Program kinds: [ADR 0002](../../adr/0002-program-kinds.md).

## 1. Capability and boundary

- Capability: the working rules for agents on DevSpace (`CLAUDE.md`, `.claude/rules.md`), the lifecycle loops (`docs/agent-loops.md`), the project skills in `.claude/skills/`, the docs structure and its checks (`docs/README.md`, `docs/adr/`, `docs/backlog/`, `scripts/docs/`), the PR and CI conventions (`.github/pull_request_template.md`, `git-pr-workflow`), and the Codex review process.
- Boundary: product code, the CI workflow jobs (`.github/workflows/`), and the tooling-specific content of a skill that another program's unit adds together with its tooling (infrastructure master plan D9) stay with that program. Program state belongs to each program's own records.

## 2. Owner decisions

One line each: number, date, decision. The decisions of each initiative stay in its plan.

1. (2026-10-23) `agent-workflow` is an evergreen program: its first plan is U1, PR 13's chat plan r3 is U2, and the program-kinds plan is U3 (U3 D6, ADR 0002).
2. (2026-10-23) The evergreen candidates are recorded in FEAT-010 with their opening conditions and are not opened; performance skills are a deferred future feature of this program, FEAT-011 (U3 D9).
3. (2026-10-25) A `skill-authoring` skill owns how skills and references are written and maintained, the procedural rules of `.claude/rules.md` section 8 move into it, and `npm run docs:check` checks skill shape; this replaces the D4 reason for dropping FEAT-009 (U5 D1 to D3).

## 3. Invariants

Each initiative keeps these; the rule itself lives with its owner.

- One owner per rule, with links elsewhere (`.claude/rules.md` section 8) — prevents copies that drift apart.
- A skill states only what DevSpace has today, and no skill widens a permission (`.claude/rules.md` section 8) — prevents agents running tools that do not exist or reading a skill as a grant.
- Every Codex brief starts with a "Read first" list (`code-review`, Codex) — prevents Codex reviewing against its own defaults.
- `npm run docs:check` enforces only what `program-docs` and its templates state (`program-docs`, Verify) — prevents the check and the skill disagreeing.

## 4. Initiatives

At most one initiative has an open plan at a time. A closed initiative keeps its row.

| Initiative | Branch | Outcome | Dependencies | Gate to open |
| --- | --- | --- | --- | --- |
| U1 [Working rules, skills and docs system](implementation-plans/u1-working-rules/plan.md) | `chore/agent-workflow` | A fresh session finds and follows the working rules, loops and skills; program docs have a machine-checked shape. | none | Owner approval of the plan (2026-10-22) |
| U2 [CI result in the PR body and hosted apply with db push](implementation-plans/u2-ci-result-db-push/plan.md) | `docs/ci-result-and-db-push` | The CI result goes into the PR body; hosted migrations are applied with `db push` behind two grants; migration and handoff rules. | soft on infrastructure U2 (merged) | Owner approval of chat plan r3 after the Codex plan gate |
| U3 [Program kinds: delivery and evergreen](implementation-plans/u3-program-kinds/plan.md) | `docs/program-kinds` | Delivery and evergreen programs; `agent-workflow` becomes evergreen; migration citation, CI wait and checkpoint commit rules. | hard on U2 (merged) | Owner approval of the plan after the Codex plan gate |
| U4 [Agent instructions match the infrastructure](implementation-plans/u4-instructions-sync/plan.md) | `chore/agent-instructions-sync` | AW-006 fixed: handoff template, `npm run dev` and manual QA on the local stack, a seed rule for QA, one suite mapping, one owner for CI facts and permissions, current `README.md` and pointers. | none (U3 merged) | Owner approval of the plan after the Codex plan gate |
| U5 [Skill authoring skill and the skill-shape check](implementation-plans/u5-skill-authoring/plan.md) | `chore/skill-authoring` | `skill-authoring` owns the skill procedure, section 8 keeps only the permission rules, `docs:check` checks skill shape; the PR 21 docs catch-up. | none (U4 merged) | Owner approval of the plan after the Codex plan gate |

## 5. Opening an initiative

1. The Owner names the work. Main confirms it is inside the boundary above (an initiative belongs to exactly one program) and that no initiative of this program has an open plan (ADR 0002).
2. A small task that meets the small-task conditions (`docs/agent-loops.md`, Sizing) needs no plan and no row; it is recorded as one milestone in `progress.md`.
3. Otherwise Main writes the detail plan at `implementation-plans/u<n>-<slug>/plan.md` from the detail-plan template, with the next free `U<n>`, adds its row above, and self-reviews it. The plan gets the Codex gate whenever `.claude/rules.md` sections 2 and 3 require it for its size and risk.
4. The Owner approves the plan; State in `progress.md` then names the initiative and its revision.
