# ADR 0002: Program kinds

Date: 2026-10-23. Status: Accepted.

## Context

Every program so far had a goal and an end: `security-hotfix` and `infrastructure` close when their units merge. `agent-workflow` does not fit. Its rules, skills, loops and checks must be maintained for as long as DevSpace is worked on with agents, so a master plan with a closing condition either lies about being finished or is reopened for every change. Work in such an area also arrives one item at a time, which the unit table of a master plan models badly.

## Decision

1. There are two program kinds. A delivery program has a goal and a completion condition. An evergreen program owns a capability that must be maintained, and its initiatives open and close independently.
2. Program folders stay flat (`docs/programs/<name>`). The kind is the Lifecycle value in the Programs table of `docs/README.md`: `active` or `closed` for delivery, `evergreen` for evergreen. There is no separate kind column and no kind folder.
3. An evergreen program's identity document is a charter, `README.md`, not a master plan. It has no root `plan.md`; each initiative `U<n>` has a detail plan at `implementation-plans/u<n>-<slug>/plan.md` and is a row of the charter's Initiatives table. A delivery program keeps its current structure: a single-unit root detail plan, or a master plan with unit plans.
4. An initiative belongs to exactly one program. One PR may carry work of several programs; a small part in another program is one milestone there citing the PR.
5. An evergreen program has at most one open initiative with a plan at a time. Several items may share one initiative, or be one small task with no plan.

## Consequences

- `npm run docs:check` reads the kind from the Lifecycle value and checks the charter, its Initiatives table and the initiative plans for `evergreen` rows; delivery checks are unchanged.
- Only a delivery program closes. An evergreen program never does.
- The folder stays flat because published migrations pin `docs/programs/security-hotfix/` paths and a program's kind can change. Moving a program between kind folders would break citations, while changing a Lifecycle value and its root document does not move a path.
- A delivery program that builds a capability may hand it to an evergreen program when it closes.
- `program-docs` owns the shape, `docs/agent-loops.md` Sizing owns how an evergreen program's medium work is planned, and the `program-docs` migration reference owns the procedure for making a delivery program evergreen.
- This ADR changes no program. A program becomes evergreen in its own change, by the migration reference.
