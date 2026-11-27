---
name: program-docs
description: "Contract for the shape of program documentation in DevSpace: the two program kinds (delivery and evergreen), master plan, charter, detail plan, progress State, problems, future-features, the docs folders, ADRs, the backlog, and migrating a live program to this shape. Use when creating, updating, reshaping, closing or migrating docs under docs/."
---

# Program docs

## Use when / do not use when

Use when a task creates, updates, reshapes, closes or migrates program documentation (`plan.md`, a charter `README.md`, `implementation-plans/<code>-u<n>-<slug>/plan.md` or an entry plan at `implementation-plans/<id>-<slug>/plan.md`, `progress.md`, `problems.md`, `future-features.md`), an ADR, `docs/backlog/`, or the `docs/` index.

Do not use it for product code, for the planning method (the `planning` skill), or merely to read a plan.

This skill owns document shape only: file roles, where State lives, taxonomy, lifecycle and the migration procedure. A docs edit grants nothing (`docs/agent-loops.md`, Precedence and safety; `AGENTS.md` section 4). Build new docs from the templates below, never by copying an old program's structure.

## File roles

| File | Holds | Must not hold |
| --- | --- | --- |
| Master `plan.md` | Goal; numbered, dated Owner decisions (one line each); shared invariants; unit table with dependencies and gates; rollout order; risks; out of scope | State, history, review journal |
| Charter `README.md` (evergreen only) | The capability and its boundary; numbered, dated Owner decisions (one line each); invariants; the Initiatives table with outcome, dependencies and gates; how an initiative is opened | State, history, review journal |
| Detail `plan.md` | Binding Spec (outcome, acceptance, scope, guardrails, Owner decisions); repository facts only where they justify a Spec item, with a baseline commit; bounded hypotheses; checkpoint table; risks, rollout, rollback; a link to `progress.md` | State, review journal, detailed code map |
| `progress.md` | Exactly two sections: `## State` (one block, edited in place) and `## Milestones` (one line each) | Any other section, review rounds, command logs, a copy of the Spec |
| `problems.md` | Open entries with ID, status, problem, evidence, direction, exit condition; resolved entries as one line | Planning decisions, State |
| `future-features.md` | Entries `## <CODE>-F<n>: <title>` with Status, Direction, Target program | Work that is in scope |

There are two program kinds ([ADR 0002](../../../docs/adr/0002-program-kinds.md)). A delivery program has a goal and a completion condition. An evergreen program owns a long-lived capability that must be maintained, and runs initiatives that open and close independently.

A new delivery program starts single-unit, and a single-unit delivery program uses a detail plan as its root `plan.md` (no `implementation-plans/` folder). A delivery program with `implementation-plans/` has a master plan at the root. An evergreen program has no root `plan.md`: its identity is the charter `README.md`, and each initiative has a detail plan under `implementation-plans/`.

Plan shape, checked by `npm run docs:check` (rule `plan-shape`):

- Delivery: a root `plan.md` titled `# Master plan — <program>` is a master plan, with or without `implementation-plans/`. Once `implementation-plans/` exists, the root plan must be a master plan. Evergreen: the charter is titled `# Charter — <program>` and the program has no root `plan.md` (`file-role`).
- Units (delivery) and initiatives (evergreen) use `<CODE>-U<n>`; every Units/Initiatives row starts with the full ID and a nonempty title or title link. The code is the owning program's registry code.
- A nested detail plan sits at `implementation-plans/<code>-u<n>-<slug>/plan.md` and is titled `# <CODE>-U<n> detail plan — <title>`, matching its folder and table row. The slug is nonempty lowercase kebab-case. A new single-unit delivery root stays at `plan.md`, is titled `# <CODE>-U1 detail plan — <title>`, and needs no Units table.
- An entry plan (delivery only) plans an owned F/P entry from the program's own `problems.md` or `future-features.md`, without a Units row or master-plan revision. It uses `implementation-plans/<id>-<slug>/plan.md` with the lowercase ID (`inf-f1-ci-docs-skip`) and `# <ID> detail plan — <title>`. Open, resolved, Done and Dropped entries count; foreign entries, aliases and Moved pointers do not. Evergreen programs have only U initiatives. Any nested plan makes a delivery root a master plan.
- Each plan and each charter has its template's numbered `##` sections, with the same titles and in the same order; extra sections such as appendices may follow.

## State has one owner

- `progress.md` is the only place State lives. A plan has a one-line pointer to it and no State section. A detail plan links to its `progress.md` with a Markdown link.
- State describes the current unit and current authority only. When a unit finishes, its evidence shrinks to milestone lines citing the PR or commit.
- Update State in the same commit as the change it describes; use a standalone docs commit only for a blocker, a merge or rollout event, or a handoff. A milestone citing `(this commit)` is replaced with the hash in the next commit that edits the file.
- An implementation discovery that keeps the Spec (a changed hypothesis, mechanism or fact) is an accepted deviation in State. A change to the Spec itself (outcome, acceptance, scope, guardrail or Owner decision) is not a deviation: it is a new plan revision approved through `planning`. Do not edit the frozen Spec to match an implementation.

## Problems and future features

- Open problem headings are `### <CODE>-P<n>: <title>`; feature headings are `## <CODE>-F<n>: <title>`. Keep the existing fields. A title is nonempty and short, in English; no machine word limit applies.
- An entry keeps its ID within its owner. Before resolving it, move any live follow-up into an open entry, then shrink it to one line with outcome and PR/commit. Closed canonical entries still reserve their numbers.
- Canonical ownership is unique by the full (code, kind, number) across open and closed records. Different kinds and owners have independent namespaces; pointers and plan identity claims do not create another owned entry. Kind must match the file (F features, P problems, U units/initiatives).

## Identifier allocation and transfers

- The Programs table in `docs/README.md` is the code registry: unique 2–4 uppercase ASCII letters. `BL` is reserved for backlog and cannot be a program code. IDs use `<CODE>-<KIND><n>`, with F/P/U and a positive decimal number without leading zeroes.
- Allocate one greater than the highest number already issued in the same owner/kind, including closed canonical declarations, Moved pointers and mapping sources. Never reuse a number or fill a gap. F/P/U sequences and owners are independent. There is no sequence-gap checker, warning or allocation ledger.
- On transfer, always allocate the destination's next local number for the same kind: `<FROM>-F20` becomes `<TO>-F3` after `<TO>-F1` and `<TO>-F2` even if `<TO>-F20` is free. Keep a Moved pointer in the old home and add a file/ID-qualified from/to entry to `scripts/docs/work-id-mappings.json`. Chained mappings must resolve to one owned destination; missing targets, duplicate/ambiguous sources, cycles and kind changes fail. A mapping does not authorize declaring an old identifier again. Pointer links name the immediate destination file.
- Legacy F/P numbers reserve no new values: the open records of the older scheme were reallocated once, from 1 by ascending old numeric value within each owner/kind (AW-U10 plan r2 section 1.6). U numbering includes completed and already-planned units: a unit number issued in a charter or master-plan row, a plan or a retained legacy row is never reused.
- Completed plans, closed records, milestones, existing ADRs and published SQL retain historical identifiers and paths. Exact naming-only exceptions are in `scripts/docs/legacy-work-identifiers.json` (file, ID, role, retained form, reason). They do not waive fields, shape, ownership or links. New legacy declarations, copies to other roles/files, reopened legacy work and additional legacy security-table rows fail. Security-hotfix's original shape allowlist remains separate. Current instructions/State use canonical IDs; historical citations can be traced through the mappings. See [ADR 0005](../../../docs/adr/0005-program-scoped-work-identifiers.md).

## Backlog

`docs/backlog/` holds `future-features.md` and `problems.md` (same templates) for work no open program owns. It is not a program: no plan, no progress, no Programs row. Use an entry when the work is too small for a program; related entries that add up to a program move into one.

Every entry is open with its fields, or closed as exactly one line that keeps its ID (under `## Resolved` in `problems.md`, under `## Closed` in `future-features.md`):

- `<ID> — Done: <how it was resolved> (PR #n)`. Until the PR exists the entry stays open with Status `Fixed locally, awaiting delivery`.
- `<ID> — Moved to [<program>](<link>)`.
- `<ID> — Dropped: <reason>`.

Closing an entry grants nothing (`AGENTS.md` section 4). Closing a program includes a backlog review with the Owner.

## Lifecycle, index and ADRs

- A program is a folder under `docs/programs/` with a `progress.md`. Each has one row in the Programs table of `docs/README.md` (`Path`, `Code`, `Lifecycle`). The kind is the Lifecycle value: `active` or `closed` for a delivery program, `evergreen` for an evergreen one. Status is read from `progress.md`, never copied into the table.
- Opening and closing a delivery program each include the dependency check ([dependency-updates](../dependency-updates/SKILL.md), Dependency check).
- Only a delivery program closes: say in State that it is completed, resolve or move its open problems, review the backlog, and set the row to `closed`. An evergreen program never closes. A delivery program that builds a capability may hand it to an evergreen program when it closes.
- An initiative belongs to exactly one program. One PR may carry work of several programs; a small part in another program is one milestone there citing the PR. An evergreen program has at most one open initiative with a plan at a time; several items may share one initiative, or be one small task with no plan.
- An ADR in `docs/adr/` records a decision that outlives one program or spans programs. A decision that matters to one program stays in its master plan or charter. Every `docs/adr/*.md` except `README.md` is listed in `docs/adr/README.md` with date, status and a one-line summary.
- Folder purposes are indexed in `docs/README.md`; update it when a folder's purpose changes.

Docs language: `AGENTS.md` section 1. Size targets, soft: master plan 150-250 lines, detail plan 150-300, problems entry about 8 lines open and 1 resolved. Exceeding one means removing duplication, not dropping a decision or gate.

## Verify

After editing program docs, `docs/README.md`, `docs/adr/` or `docs/backlog/`, run `npm run docs:check` and report its result; do not claim the shape is correct without it. It enforces only mechanical rules stated here and in the templates. Whether State is true and whether meaning survived a rewrite stay your judgment. The one exception is `security-hotfix`, which is an allowlisted entry in the script with a stated reason because published migrations cite its paths.

## Resources

| Resource | Read when | Skip when |
| --- | --- | --- |
| [master-plan.md](references/templates/master-plan.md) | creating or reshaping a master `plan.md` | not touching a master plan |
| [charter.md](references/templates/charter.md) | creating or reshaping the charter `README.md` of an evergreen program | not touching a charter |
| [detail-plan.md](references/templates/detail-plan.md) | creating or reshaping a detail plan, an initiative plan or an entry plan | not touching a detail plan |
| [progress.md](references/templates/progress.md) | creating or reshaping a `progress.md`, or you need the State fields or milestone grammar | not touching progress |
| [problems.md](references/templates/problems.md) | creating or reshaping a `problems.md`, or shrinking a resolved entry | not touching problems |
| [future-features.md](references/templates/future-features.md) | creating a `future-features.md` or adding an entry | not touching future features |
| [adr.md](references/templates/adr.md) | creating an ADR | not creating an ADR |
| [handoff.md](references/templates/handoff.md) | writing or editing a handoff (`docs/agent-loops.md`, Handoff) | not writing a handoff |
| [migration.md](references/migration.md) | migrating a live program to this shape, reshaping a single-unit program into a multi-unit one, making a delivery program evergreen, or replacing its State, plan, progress or problems files | not migrating or reshaping |

## Stop when

- a migrated Owner decision, invariant, gate, rollout step or open problem cannot keep its meaning in the new shape;
- a published migration (`supabase/migrations/*.sql`) cites a path you would move, rename or renumber: stop before the change, even when `docs:check` would pass (never edit a published migration);
- another session or branch is editing the same files;
- the work would change planning, permission or skill rules owned elsewhere, or a required Owner decision on taxonomy or scope is missing.

## Report

Say which documents changed and their role, that State has one owner, the `npm run docs:check` result, any meaning check actually run, and what was skipped. A migration report names the Git revision of the old files it compared with.
