# Problems, risks and follow-ups — agent-workflow

Charter: `README.md`. Progress: `progress.md`.

## Open

### AW-002: The detail-plan template's progress link resolves by accident

- Status: Accepted (2026-10-22, moved from `agent-workflow` when it closed).
- Problem: `.claude/skills/program-docs/references/templates/detail-plan.md` links `[progress.md](progress.md)`, which passes the link check only because the sibling template `progress.md` exists in the same folder. Renaming or moving the progress template breaks the link check on the detail template.
- Evidence: `npm run docs:check-links` passes; removing `references/templates/progress.md` makes the detail-plan link broken.
- Direction: keep the link, because a copied template must keep a working `progress.md` link; move the progress template and the detail template together.
- Exit condition: none needed while both templates stay in the same folder; reopen if one of them moves.

### AW-007: Rules the Owner did not approve, or worded against the Owner's intent

- Status: Open (2026-10-25, Owner during U4 planning).
- Problem: some rules exist that the Owner did not request or approve, or that do not say what the Owner meant. Known case: `.claude/rules.md:15` ("Main edits state records directly … No implementor") was meant as a shortcut for Main (State after a Codex PASS, an entry the Owner asks to record) but reads as "only Main edits State"; Codex U4 plan round 1 and Main read it that way and nearly added a stop before every implementor commit.
- Evidence: U4 plan r2 AC11 and its r6 correction (U4 D8); the Owner's statement of intent on 2026-10-25.
- Direction: reword section 2 so the shortcut cannot read as a ban; the Owner names other rules as found; a read-only audit traces each rule in `CLAUDE.md`, `.claude/rules.md`, `docs/agent-loops.md` and the skills to the Owner decision or commit that introduced it and to the place it belongs, using the `skill-authoring` audit reference that U5 writes; the audit and the moves it proposes are one agent-workflow initiative after U5 (U5 D8).
- Exit condition: every rule the Owner flags is reworded, removed or confirmed, and section 2 states the shortcut unambiguously.

### AW-008: The docs link parsers count some links inside code and accept a bare `](`

- Status: Open (2026-10-26, Codex U5 diff review round 1).
- Problem: `scripts/docs/check-links.mjs` (`stripCode`, `extractTargets`), which `check-skills.mjs` reuses after U5, strips inline code one line at a time (a code span across lines still yields its links), accepts a closing fence with trailing text, and reads `](target)` without an opening `[label]` as a link. A link shown only as an example can count, and a stray `](` can satisfy `skill-reference-link`.
- Evidence: Codex U5 diff review round 1 (session `01a17436-2457-7e23-bf3c-25bf1f91ccea`), findings 1 and 2, checked by Main against the source on 2026-10-26; no real doc in the repo hits these cases today (`npm run docs:check` passes).
- Direction: one parser change in `check-links.mjs` with fixtures (CommonMark closing fence, code spans across lines, an opening label required), so both checks keep one link reader.
- Exit condition: the three cases have failing fixtures that pass after the fix, and `npm run docs:check` still passes.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-004 — Resolved 2026-10-22: CP5 and the CP6 planner reran on a base branch without plan sections 4.1 and 4.2, with valid results (`1b8d8e5`).
- AW-005 — Resolved 2026-10-22: the CP6 implementor rerun loaded `git-pr-workflow` before committing and `code-review` before its self-review (`b99315e`).
- AW-001 — Moved 2026-10-22 to [infrastructure](../infrastructure/problems.md), unit U1.
- AW-003 — Moved 2026-10-22 to [security-hotfix](../security-hotfix/problems.md); it waits for H2-2.
- AW-006 — Resolved 2026-10-25: U4 fixed every item and the fresh read-only audit passed (PR 21, `4fa5731`).
