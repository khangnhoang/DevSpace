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

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-004 — Resolved 2026-10-22: CP5 and the CP6 planner reran on a base branch without plan sections 4.1 and 4.2, with valid results (`1b8d8e5`).
- AW-005 — Resolved 2026-10-22: the CP6 implementor rerun loaded `git-pr-workflow` before committing and `code-review` before its self-review (`b99315e`).
- AW-001 — Moved 2026-10-22 to [infrastructure](../infrastructure/problems.md), unit U1.
- AW-003 — Moved 2026-10-22 to [security-hotfix](../security-hotfix/problems.md); it waits for H2-2.
- AW-006 — Resolved 2026-10-25: U4 fixed every item and the fresh read-only audit passed (PR 21, `4fa5731`).
- AW-007 — Resolved 2026-10-26: U6 audited every instruction, the Owner decided each item, and section 2 states when Main edits state records (PR 23, `bd19c18`).
- AW-010 — Resolved 2026-10-26: U7 added entry plans, so a delivery program plans a `problems.md` or `future-features.md` entry without revising its master plan (PR 24, `85248b2`).
- AW-009 — Resolved 2026-10-27: `planning` allows a batch of small independent items in one PR and states the plan approval questions, and `.claude/rules.md` section 2 defines an active implementor (PR 26, `723b985`).
- AW-011 — Resolved 2026-10-27: `docs/agent-loops.md` Sizing matches skills to the work after discovery, and the Codex and Sonnet briefs take their skill list from it (PR 28, `7ad7a92`).
