# Problems, risks and follow-ups — agent-workflow

Charter: `README.md`. Progress: `progress.md`.

## Open

### AW-002: The detail-plan template's progress link resolves by accident

- Status: Accepted (2026-10-22, moved from `agent-workflow` when it closed).
- Problem: `.claude/skills/program-docs/references/templates/detail-plan.md` links `[progress.md](progress.md)`, which passes the link check only because the sibling template `progress.md` exists in the same folder. Renaming or moving the progress template breaks the link check on the detail template.
- Evidence: `npm run docs:check-links` passes; removing `references/templates/progress.md` makes the detail-plan link broken.
- Direction: keep the link, because a copied template must keep a working `progress.md` link; move the progress template and the detail template together.
- Exit condition: none needed while both templates stay in the same folder; reopen if one of them moves.

### AW-008: The docs link parsers count some links inside code and accept a bare `](`

- Status: Open (2026-10-26, Codex U5 diff review round 1).
- Problem: `scripts/docs/check-links.mjs` (`stripCode`, `extractTargets`), which `check-skills.mjs` reuses after U5, strips inline code one line at a time (a code span across lines still yields its links), accepts a closing fence with trailing text, and reads `](target)` without an opening `[label]` as a link. A link shown only as an example can count, and a stray `](` can satisfy `skill-reference-link`.
- Evidence: Codex U5 diff review round 1 (session `01a17436-2457-7e23-bf3c-25bf1f91ccea`), findings 1 and 2, checked by Main against the source on 2026-10-26; no real doc in the repo hits these cases today (`npm run docs:check` passes).
- Direction: one parser change in `check-links.mjs` with fixtures (CommonMark closing fence, code spans across lines, an opening label required), so both checks keep one link reader.
- Exit condition: the three cases have failing fixtures that pass after the fix, and `npm run docs:check` still passes.

### AW-009: The planning PR rule forbids batching small independent fixes

- Status: Open (2026-10-26, Owner).
- Problem: `planning` Workflow step 7 says "do not mix independent product changes or cleanup", so small fixes of different programs or the backlog (for example AW-008 and BL-004) each need their own PR, although they touch different files, are verified separately and do not affect each other. The checkpoint order for independent items is not stated either.
- Evidence: the Owner's discussion on 2026-10-26 after PR 23. ADR 0002 decision 4 and `program-docs` (Lifecycle, index and ADRs) already allow one PR to carry work of several programs, each part recorded in its own program.
- Direction: (Owner, 2026-10-26) small independent items may share one PR, each with its own commits and its own verification in the PR body; an item that needs the Codex gate or a hosted step does not join a batch; independent checkpoints run the easiest to verify first; a plan may hold a checkpoint for another program's or the backlog's item, which still closes in its own records. One agent-workflow PR of its own, after the CI change.
- Exit condition: `planning` states these rules, and `npm run docs:check` passes.

### AW-010: Follow-up work of a delivery program must edit its master plan

- Status: Open (2026-10-26, Owner).
- Problem: a delivery program with `implementation-plans/` accepts a detail plan only as a unit row `U<n>` of its master plan (`program-docs` Plan shape, `plan-shape` check), so every follow-up (a fix or a feature recorded in `problems.md` or `future-features.md`) must first revise the master plan. That mixes the program's goal with work found later, and adds a master-plan review. Examples: infrastructure FEAT-014 ("Needs a master-plan revision before it starts") and FEAT-017.
- Evidence: `program-docs` Plan shape and `scripts/docs` on `bd19c18`; the Owner's discussion on 2026-10-26.
- Direction: (Owner, 2026-10-26) besides `u<n>-<slug>/plan.md`, `implementation-plans/` accepts an entry plan `<id>-<slug>/plan.md` for an ID that exists, open or resolved, in the same program's `problems.md` or `future-features.md`; it needs no Units row. `program-docs`, its template and the `plan-shape` check change together, with tests. The risk gates are unchanged. This ships before FEAT-017.
- Exit condition: an entry plan passes `npm run docs:check`, a plan whose ID is in neither file fails it, the tests cover both, and `program-docs` states the rule.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-004 — Resolved 2026-10-22: CP5 and the CP6 planner reran on a base branch without plan sections 4.1 and 4.2, with valid results (`1b8d8e5`).
- AW-005 — Resolved 2026-10-22: the CP6 implementor rerun loaded `git-pr-workflow` before committing and `code-review` before its self-review (`b99315e`).
- AW-001 — Moved 2026-10-22 to [infrastructure](../infrastructure/problems.md), unit U1.
- AW-003 — Moved 2026-10-22 to [security-hotfix](../security-hotfix/problems.md); it waits for H2-2.
- AW-006 — Resolved 2026-10-25: U4 fixed every item and the fresh read-only audit passed (PR 21, `4fa5731`).
- AW-007 — Resolved 2026-10-26: U6 audited every instruction, the Owner decided each item, and section 2 states when Main edits state records (PR 23, `bd19c18`).
