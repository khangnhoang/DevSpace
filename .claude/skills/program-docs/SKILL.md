---
name: program-docs
description: "Contract for the shape of program documentation in DevSpace: the two program kinds (delivery and evergreen), master plan, charter, detail plan, progress State, problems, future-features, the docs folders, ADRs, the backlog, and migrating a live program to this shape. Use when creating, updating, reshaping, closing or migrating docs under docs/."
---

# Program docs

## Use when / do not use when

Use when a task creates, updates, reshapes, closes or migrates program documentation (`plan.md`, a charter `README.md`, `implementation-plans/u<n>-<slug>/plan.md`, `progress.md`, `problems.md`, `future-features.md`), an ADR, `docs/backlog/`, or the `docs/` index.

Do not use it for product code, for the planning method (the `planning` skill), or merely to read a plan.

This skill owns document shape only: file roles, where State lives, taxonomy, lifecycle and the migration procedure. A docs edit grants nothing (`docs/agent-loops.md`, Precedence and safety; `.claude/rules.md` section 4). Build new docs from the templates below, never by copying an old program's structure.

## File roles

| File | Holds | Must not hold |
| --- | --- | --- |
| Master `plan.md` | Goal; numbered, dated Owner decisions (one line each); shared invariants; unit table with dependencies and gates; rollout order; risks; out of scope | State, history, review journal |
| Charter `README.md` (evergreen only) | The capability and its boundary; numbered, dated Owner decisions (one line each); invariants; the Initiatives table with outcome, dependencies and gates; how an initiative is opened | State, history, review journal |
| Detail `plan.md` | Binding Spec (outcome, acceptance, scope, guardrails, Owner decisions); repository facts only where they justify a Spec item, with a baseline commit; bounded hypotheses; checkpoint table; risks, rollout, rollback; a link to `progress.md` | State, review journal, detailed code map |
| `progress.md` | Exactly two sections: `## State` (one block, edited in place) and `## Milestones` (one line each) | Any other section, review rounds, command logs, a copy of the Spec |
| `problems.md` | Open entries with ID, status, problem, evidence, direction, exit condition; resolved entries as one line | Planning decisions, State |
| `future-features.md` | Entries `## FEAT-NNN: <title>` with Status, Direction, Target program | Work that is in scope |

There are two program kinds ([ADR 0002](../../../docs/adr/0002-program-kinds.md)). A delivery program has a goal and a completion condition. An evergreen program owns a long-lived capability that must be maintained, and runs initiatives that open and close independently.

A single-unit delivery program uses a detail plan as its root `plan.md` (no `implementation-plans/` folder). A delivery program with `implementation-plans/` has a master plan at the root. An evergreen program has no root `plan.md`: its identity is the charter `README.md`, and each initiative has a detail plan under `implementation-plans/`.

Plan shape, checked by `npm run docs:check` (rule `plan-shape`):

- Delivery: a root `plan.md` titled `# Master plan — <program>` is a master plan, with or without `implementation-plans/`. Once `implementation-plans/` exists, the root plan must be a master plan. Evergreen: the charter is titled `# Charter — <program>` and the program has no root `plan.md` (`file-role`).
- Units (delivery) and initiatives (evergreen) are numbered `U1`, `U2`, ...: each row of the master plan's Units table, or of the charter's Initiatives table, starts with its unique `U<n>`.
- A unit's or initiative's detail plan sits at `implementation-plans/u<n>-<slug>/plan.md`, is titled `# U<n> detail plan — <title>` with the same `n`, and its `U<n>` is a row of that table. A single-unit root detail plan carries no unit ID.
- Each plan and each charter has its template's numbered `##` sections, with the same titles and in the same order; extra sections such as appendices may follow.

## State has one owner

- `progress.md` is the only place State lives. A plan has a one-line pointer to it and no State section. A detail plan links to its `progress.md` with a Markdown link.
- State describes the current unit and current authority only. When a unit finishes, its evidence shrinks to milestone lines citing the PR or commit.
- Update State in the same commit as the change it describes; use a standalone docs commit only for a blocker, a merge or rollout event, or a handoff. A milestone citing `(this commit)` is replaced with the hash in the next commit that edits the file.
- An implementation discovery is an accepted deviation in State. Do not edit the frozen Spec to match it; route material changes through `planning`.

## Problems and future features

- An open problem keeps its ID. When resolved, first move any live follow-up into an open entry, then shrink it to one line (ID, status, outcome, PR or commit).
- Each `FEAT-NNN` ID is unique across every `future-features.md` in the repo (backlog included) and its entry has `Status`, `Direction` and `Target program`. Closed entries go as one line each under a `## Closed` heading, in the backlog forms below.

## Backlog

`docs/backlog/` holds `future-features.md` and `problems.md` (same templates) for work no open program owns. It is not a program: no plan, no progress, no Programs row. Use an entry when the work is too small for a program; related entries that add up to a program move into one.

Every entry is open with its fields, or closed as exactly one line that keeps its ID (under `## Resolved` in `problems.md`, under `## Closed` in `future-features.md`):

- `<ID> — Done: <how it was resolved> (PR #n)`. Until the PR exists the entry stays open with Status `Fixed locally, awaiting delivery`.
- `<ID> — Moved to [<program>](<link>)`.
- `<ID> — Dropped: <reason>`.

Closing an entry grants nothing (`.claude/rules.md` section 4). Closing a program includes a backlog review with the Owner.

## Lifecycle, index and ADRs

- A program is a folder under `docs/programs/` with a `progress.md`. Each has one row in the Programs table of `docs/README.md` (`Path`, `Lifecycle`). The kind is the Lifecycle value: `active` or `closed` for a delivery program, `evergreen` for an evergreen one. Status is read from `progress.md`, never copied into the table.
- Only a delivery program closes: say in State that it is completed, resolve or move its open problems, review the backlog, and set the row to `closed`. An evergreen program never closes. A delivery program that builds a capability may hand it to an evergreen program when it closes.
- An initiative belongs to exactly one program. One PR may carry work of several programs; a small part in another program is one milestone there citing the PR. An evergreen program has at most one open initiative with a plan at a time; several items may share one initiative, or be one small task with no plan.
- An ADR in `docs/adr/` records a decision that outlives one program or spans programs. A decision that matters to one program stays in its master plan or charter. Every `docs/adr/*.md` except `README.md` is listed in `docs/adr/README.md` with date, status and a one-line summary.
- Folder purposes are indexed in `docs/README.md`; update it when a folder's purpose changes.

Docs language: `.claude/rules.md` section 1. Size targets, soft: master plan 150-250 lines, detail plan 150-300, problems entry about 8 lines open and 1 resolved. Exceeding one means removing duplication, not dropping a decision or gate.

## Verify

After editing program docs, `docs/README.md`, `docs/adr/` or `docs/backlog/`, run `npm run docs:check` and report its result; do not claim the shape is correct without it. It enforces only mechanical rules stated here and in the templates. Whether State is true and whether meaning survived a rewrite stay your judgment. The one exception is `security-hotfix`, which is an allowlisted entry in the script with a stated reason because published migrations cite its paths.

## Resources

| Resource | Read when | Skip when |
| --- | --- | --- |
| [master-plan.md](references/templates/master-plan.md) | creating or reshaping a master `plan.md` | not touching a master plan |
| [charter.md](references/templates/charter.md) | creating or reshaping the charter `README.md` of an evergreen program | not touching a charter |
| [detail-plan.md](references/templates/detail-plan.md) | creating or reshaping a detail plan or an initiative plan | not touching a detail plan |
| [progress.md](references/templates/progress.md) | creating or reshaping a `progress.md`, or you need the State fields or milestone grammar | not touching progress |
| [problems.md](references/templates/problems.md) | creating or reshaping a `problems.md`, or shrinking a resolved entry | not touching problems |
| [future-features.md](references/templates/future-features.md) | creating a `future-features.md` or adding an entry | not touching future features |
| [adr.md](references/templates/adr.md) | creating an ADR | not creating an ADR |
| [handoff.md](references/templates/handoff.md) | writing or editing a handoff (`.claude/rules.md` section 7) | not writing a handoff |
| [migration.md](references/migration.md) | migrating a live program to this shape, reshaping a single-unit program into a multi-unit one, making a delivery program evergreen, or replacing its State, plan, progress or problems files | not migrating or reshaping |

## Stop when

- a migrated Owner decision, invariant, gate, rollout step or open problem cannot keep its meaning in the new shape;
- a published migration (`supabase/migrations/*.sql`) cites a path you would move, rename or renumber (never edit a published migration);
- another session or branch is editing the same files;
- the work would change planning, permission or skill rules owned elsewhere, or a required Owner decision on taxonomy or scope is missing.

## Report

Say which documents changed and their role, that State has one owner, the `npm run docs:check` result, any meaning check actually run, and what was skipped. A migration report names the Git revision of the old files it compared with.
