---
name: program-docs
description: Contract for the shape of program documentation in DevSpace: master plan, detail plan, progress State, problems, future-features, the docs folders, ADRs, the backlog, and migrating a live program to this shape. Use when creating, updating, reshaping, closing or migrating docs under docs/.
---

# Program docs

## Use when / do not use when

Use when a task creates, updates, reshapes, closes or migrates program documentation (`plan.md`, `implementation-plans/<unit>/plan.md`, `progress.md`, `problems.md`, `future-features.md`), an ADR, `docs/backlog/`, or the `docs/` index.

Do not use it for product code, for the planning method (the `planning` skill), or merely to read a plan.

This skill owns document shape only: file roles, where State lives, taxonomy, lifecycle and the migration procedure. A docs edit never grants commit, push, PR, merge or database permission (`.claude/rules.md` section 4). Build new docs from the templates below, never by copying an old program's structure.

## File roles

| File | Holds | Must not hold |
| --- | --- | --- |
| Master `plan.md` | Goal; numbered, dated Owner decisions (one line each); shared invariants; unit table with dependencies and gates; rollout order; risks; out of scope | State, history, review journal |
| Detail `plan.md` | Binding Spec (outcome, acceptance, scope, guardrails, Owner decisions); repository facts only where they justify a Spec item, with a baseline commit; bounded hypotheses; checkpoint table; risks, rollout, rollback; a link to `progress.md` | State, review journal, detailed code map |
| `progress.md` | Exactly two sections: `## State` (one block, edited in place) and `## Milestones` (one line each) | Any other section, review rounds, command logs, a copy of the Spec |
| `problems.md` | Open entries with ID, status, problem, evidence, direction, exit condition; resolved entries as one line | Planning decisions, State |
| `future-features.md` | Entries `## FEAT-NNN: <title>` with Status, Direction, Target program | Work that is in scope |

A single-unit program uses a detail plan as its root `plan.md` (no `implementation-plans/` folder). A program with `implementation-plans/` has a master plan at the root.

## State has one owner

- `progress.md` is the only place State lives. A plan has a one-line pointer to it and no State section. A detail plan links to its `progress.md` with a Markdown link.
- State describes the current unit and current authority only. When a unit finishes, its evidence shrinks to milestone lines citing the PR or commit.
- Update State in the same commit as the change it describes; use a standalone docs commit only for a blocker, a merge or rollout event, or a handoff. A milestone citing `(this commit)` is replaced with the hash in the next commit that edits the file.
- An implementation discovery is an accepted deviation in State. Do not edit the frozen Spec to match it; route material changes through `planning`.

## Problems and future features

- An open problem keeps its ID. When resolved, first move any live follow-up into an open entry, then shrink it to one line (ID, status, outcome, PR or commit).
- Each `FEAT-NNN` ID is unique within its file and has `Status`, `Direction` and `Target program`.

## Backlog

`docs/backlog/` holds `future-features.md` and `problems.md` (same templates) for work no open program owns. It is not a program: no plan, no progress, no Programs row. Use an entry when the work is too small for a program; related entries that add up to a program move into one.

Every entry is open with its fields, or closed as exactly one line that keeps its ID:

- `<ID> — Done: <how it was resolved> (PR #n)`. Until the PR exists the entry stays open with Status `Fixed locally, awaiting delivery`.
- `<ID> — Moved to [<program>](<link>)`.
- `<ID> — Dropped: <reason>`.

Closing an entry never implies commit, push or PR permission. Closing a program includes a backlog review with the Owner.

## Lifecycle, index and ADRs

- A program is a folder under `docs/programs/` with a `progress.md`. Each has one row in the Programs table of `docs/README.md` (`Path`, `Lifecycle`: `active` or `closed`). Status is read from `progress.md`, never copied into the table. To close a program, say in State that it is completed, resolve or move its open problems, review the backlog, and set the row to `closed`.
- An ADR in `docs/adr/` records a decision that outlives one program or spans programs. A decision that matters to one program stays in its master plan. Every `docs/adr/*.md` except `README.md` is listed in `docs/adr/README.md` with date, status and a one-line summary.
- Folder purposes are indexed in `docs/README.md`; update it when a folder's purpose changes.

Docs are in English. Size targets, soft: master plan 150-250 lines, detail plan 150-300, problems entry about 8 lines open and 1 resolved. Exceeding one means removing duplication, not dropping a decision or gate.

## Verify

After editing program docs, `docs/README.md`, `docs/adr/` or `docs/backlog/`, run `npm run docs:check` and report its result; do not claim the shape is correct without it. It enforces only mechanical rules stated here and in the templates. Whether State is true and whether meaning survived a rewrite stay your judgment. The one exception is `security-hotfix`, which is an allowlisted entry in the script with a stated reason because published migrations cite its paths.

## Resources

| Resource | Read when | Skip when |
| --- | --- | --- |
| [master-plan.md](references/templates/master-plan.md) | creating or reshaping a master `plan.md` | not touching a master plan |
| [detail-plan.md](references/templates/detail-plan.md) | creating or reshaping a detail plan | not touching a detail plan |
| [progress.md](references/templates/progress.md) | creating or reshaping a `progress.md`, or you need the State fields or milestone grammar | not touching progress |
| [problems.md](references/templates/problems.md) | creating or reshaping a `problems.md`, or shrinking a resolved entry | not touching problems |
| [future-features.md](references/templates/future-features.md) | creating a `future-features.md` or adding an entry | not touching future features |
| [adr.md](references/templates/adr.md) | creating an ADR | not creating an ADR |
| [migration.md](references/migration.md) | migrating a live program to this shape, reshaping a single-unit program into a multi-unit one, or replacing its State, plan, progress or problems files | not migrating or reshaping |

## Stop when

- a migrated Owner decision, invariant, gate, rollout step or open problem cannot keep its meaning in the new shape;
- a published migration (`supabase/migrations/*.sql`) cites a path you would move, rename or renumber (never edit a published migration);
- another session or branch is editing the same files;
- the work would change planning, permission or skill rules owned elsewhere, or a required Owner decision on taxonomy or scope is missing.

## Report

Say which documents changed and their role, that State has one owner, the `npm run docs:check` result, any meaning check actually run, and what was skipped. A migration report names the Git revision of the old files it compared with.
