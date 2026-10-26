# U7 detail plan — Entry plans for follow-up work of a delivery program

Revision: r1, 2026-10-26. Owner approval: r1 2026-10-26. Master plan or charter: [charter](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: a delivery program with a master plan can plan follow-up work recorded in its own `problems.md` or `future-features.md` as an entry plan at `implementation-plans/<id>-<slug>/plan.md`, without a Units row and without revising the master plan (AW-010). `program-docs` and its templates state the rule, and `npm run docs:check` enforces it with tests. The PR 23 docs catch-up and the AW-009, AW-010 and FEAT-017 records ship in the same PR.

| ID | Observable result |
| --- | --- |
| AC1 | In a delivery program whose root `plan.md` is a master plan, `implementation-plans/feat-017-ci-docs-skip/plan.md` titled `# FEAT-017 detail plan — <title>`, with the detail-plan sections, while `## FEAT-017: <title>` is an open entry of that program's `future-features.md`, gives no violation, and the master plan's Units table has no FEAT-017 row. |
| AC2 | The same holds for an ID that is an open entry `### <ID>: <title>` of that program's `problems.md`, a resolved line `- <ID> — <outcome>` there, or a closed line `- FEAT-NNN — Done: ...` or `Dropped: ...` in its `future-features.md`. |
| AC3 | `plan-shape` reports an entry plan when: its ID is in neither of that program's two files; its ID is only in another program's files; the program's only line for the ID is `<ID> — Moved to [...]`; the folder ID and the title ID differ; the folder ID is not lowercase; or the folder has no slug. |
| AC4 | In an evergreen program, an entry-plan folder is a `plan-shape` violation; an initiative still needs `u<n>-<slug>` and a charter row (D2). |
| AC5 | A delivery program whose root `plan.md` is a detail plan and that gains any `implementation-plans/` folder, unit or entry, is still told its root plan must be a master plan (D3). |
| AC6 | Every existing `plan-shape`, `file-role` and other rule keeps its behavior for `u<n>-<slug>` plans: the existing tests pass, edited only where an asserted message names the allowed folder forms; `npm run docs:check` on the repo reports 0 structure violations. |
| AC7 | `program-docs` Plan shape states the entry-plan rule (folder, title, the ID's two possible homes, delivery only, no Units row); the detail-plan template's comment names the entry-plan path and title; the master-plan template's opening line names entry plans next to units. The charter template and ADR 0002 do not change. |
| AC8 | Records: the charter has the U7 row; `progress.md` State names U7 and its revision; AW-009, AW-010 and infrastructure FEAT-017 are recorded; the PR 23 catch-up is in (U6 merged, AW-007 resolved). AW-010 is resolved in the docs catch-up after this PR merges. |
| AC9 | `npm run docs:check` and `npm run docs:check:test` pass. |

### 1.2 Scope and non-goals

- In scope: `scripts/docs/check-structure.mjs` and its tests; `program-docs/SKILL.md` (Plan shape and the file-role wording it states); the detail-plan and master-plan templates; the records in AC8.
- Non-goals: entry plans in evergreen programs or the backlog; moving any existing plan; FEAT-017 itself (the CI change, planned after this merges); AW-008 and AW-009; the `security-hotfix` allowlist entry.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Unit plans keep their rules: no existing test assertion is weakened or deleted; only message text that names the allowed folder forms may change. | A refactor silently stops checking `u<n>` folders, titles or Units rows, and the repo still passes. |
| G2. An entry plan's ID is looked up only in its own program's `problems.md` and `future-features.md`, and a `Moved to` line does not count. | A plan cites an entry of another program or one that moved away, and its work is recorded in the wrong place. |
| G3. Every rule the check enforces is stated in `program-docs` or its templates in the same PR (charter invariant). | The check and the skill disagree, and an agent cannot tell from the skill why a plan fails. |
| G4. Main makes no edit in the checkout while the implementor is active (`.claude/rules.md` section 2). | An implementor commits Main's uncommitted diff with its own. |

### 1.4 Owner decisions that bind this unit

- D1 (2026-10-26) A delivery program may hold an entry plan at `implementation-plans/<id>-<slug>/plan.md` (ID in lowercase, then a slug), titled `# <ID> detail plan — <title>`, for an ID of its own `problems.md` or `future-features.md`; it needs no Units row.
- D2 (2026-10-26) Delivery programs only: an evergreen program has no master plan to protect, and its initiatives stay charter rows.
- D3 (2026-10-26) The root-plan rule of a delivery program is unchanged: any folder in `implementation-plans/` makes its root `plan.md` a master plan. An evergreen program has no root `plan.md` (its charter is `README.md`), so D3 does not touch it. The Owner expects multi-step work to be a program with a master plan, so a single-unit program with follow-up work is not a case to design for now.
- D4 (2026-10-26) No Codex gate: a docs checker and skill change is not high-risk under `.claude/rules.md` section 2.
- D5 (2026-10-26) Order: this PR (with the PR 23 catch-up) first; infrastructure FEAT-017 (CI) after it merges, as an entry plan; AW-009 (the `planning` PR rule) in its own PR later.

## 2. Repository facts

Baseline: `bd19c18`, checked 2026-10-26.

- `check-structure.mjs` has `UNIT_FOLDER = /^implementation-plans\/u(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*\/plan\.md$/` and `UNIT_TITLE = /^U(\d+) detail plan — \S/`; `checkPlanShape` reports any non-root detail plan whose folder or title does not match them — justifies AC1, AC3.
- `roleOf` already gives every `implementation-plans/<any>/plan.md` the `detail` role, and `hasUnits` is true for any file under `implementation-plans/` — justifies AC5 (D3 needs no change there).
- Unit plans are collected in `claimedUnits` and checked against the Units or Initiatives table after the per-file loop — justifies the hypothesis for the entry-ID lookup.
- `checkProblems` reads open IDs from `###` headings (`ID_PATTERN`) and resolved IDs with `RESOLVED_PATTERN`; `checkFutureFeatures` reads `FEATURE_HEADING` and the closed forms of `closedPattern`; FEAT IDs are unique across every `future-features.md` — justifies AC2, G2.
- Resolved problem lines include moves, such as `AW-001 — Moved 2026-10-22 to [infrastructure](...)` — justifies the `Moved` exclusion in AC3 and G2.
- `program-docs/SKILL.md` Plan shape, the detail-plan template comment and `master-plan.md` line 5 name only `u<n>-<slug>`; ADR 0002 decision 3 and the charter template are about evergreen programs — justifies AC7.
- Infrastructure FEAT-014 says "Needs a master-plan revision before it starts" — the case AW-010 describes.

## 3. Bounded implementation hypotheses

- An `ENTRY_FOLDER` pattern such as `^implementation-plans\/([a-z]+-\d+)-[a-z0-9]+(?:-[a-z0-9]+)*\/plan\.md$` and an `ENTRY_TITLE` such as `^([A-Z]+-\d+) detail plan — \S`; `u<n>` folders cannot match because they have no hyphen between letters and digits — may change if AC1, AC3 and G1 hold.
- `checkProblems` and `checkFutureFeatures` return the IDs they own (open, resolved, closed, never `Moved`), and entry plans are checked after the loop the way `claimedUnits` is — may change if G2 holds.
- The test fixtures add one delivery program with an entry plan and its `future-features.md` or `problems.md` entry, next to the existing alpha and gamma fixtures — may change if AC1 to AC6 are each asserted.

## 4. Checkpoints

The check is the easiest part to verify, so it comes first.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Check and tests: AC1 to AC6, with a failing test written for each AC3 case before the code passes it. | `npm run docs:check:test`; `npm run docs:check` on the repo. |
| CP2 | Skill, templates and records: AC7, AC8. | `npm run docs:check`; `npm run docs:check:test`; `rg "u<n>-<slug>"` lists only places that are about units or evergreen initiatives. |
| CP3 | Main review of the whole diff against this plan. | Main reads every changed line; corrections go to the implementor. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A broad entry pattern accepts a misnamed unit folder, so a typo in `u<n>` is no longer reported. | AC3 and G1: the existing unit-folder tests stay, and a test asserts that `u1/plan.md` (no slug) and `U1-x/plan.md` still fail. |
| An entry moves to another program and leaves its plan behind. | AC3 reports it; the plan moves with the entry. |
| The skill text drifts from the check. | G3, and CP2 is reviewed against the CP1 tests. |

- Rollout runbook: none (no hosted step).
- Stop when: a case needs a rule the Owner has not decided (for example an entry plan in the backlog), or an existing test would have to be weakened.
- Rollback: revert the PR; no plan uses the entry form until FEAT-017 is planned.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
