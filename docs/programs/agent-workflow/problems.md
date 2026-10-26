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
- Problem: `planning` Workflow step 7 says "do not mix independent product changes or cleanup", so small fixes of different programs or the backlog (for example AW-008 and BL-004) each need their own PR, although they touch different files, are verified separately and do not affect each other. The checkpoint order for independent items is not stated either. Two more gaps: section 2 of `.claude/rules.md` does not say when an implementor counts as active, so Main may wait on an open, idle session before editing state records; and no rule says how Main asks for the grants after a plan passes review.
- Evidence: the Owner's discussion on 2026-10-26 after PR 23. ADR 0002 decision 4 and `program-docs` (Lifecycle, index and ADRs) already allow one PR to carry work of several programs, each part recorded in its own program.
- Direction: (Owner, 2026-10-26) small independent items may share one PR, each with its own commits and its own verification in the PR body; an item that needs the Codex gate or a hosted step does not join a batch; independent checkpoints run the easiest to verify first; a plan may hold a checkpoint for another program's or the backlog's item, which still closes in its own records. One agent-workflow PR of its own, after the CI change. (Owner, 2026-10-26) An implementor is active only while its session is running a turn; an open, idle session is not, so Main edits state records itself, and commit stays its own grant (home: `.claude/rules.md` section 2). (Owner, 2026-10-26) After a plan passes its review, Main summarizes in chat what the Owner must read in the plan, then asks each grant as its own `AskUserQuestion` question: approve the plan, commit the plan, implement (home: `planning`, Git and approval; Loop 0 Report points to it). (Owner, 2026-10-27) Before Main sends another message to an idle implementor, Main's state edits are committed; without that grant Main asks the Owner instead, so the implementor never commits Main's diff.
- Exit condition: `planning` states the batch rules and the approval questions, `.claude/rules.md` section 2 defines an active implementor with the commit-before-message guard, and `npm run docs:check` passes.

### AW-011: No step re-matches skills to the files a task will change

- Status: Open (2026-10-27, Owner).
- Problem: Main picks skills from the kind of request, not from the files the work changes. The AW-009 request was "write a plan", so Main loaded `planning` only; the plan then edited `planning/SKILL.md` and its reference, which `skill-authoring` covers, and `skill-authoring` was never read. `CLAUDE.md` rule 6 says to read each matching skill but not when; the small-task steps in `docs/agent-loops.md` (Sizing) have no step that re-matches skills after discovery; the Codex brief template (`code-review`, `codex-brief.md`) takes its skill list from Main, so Codex misses the same skill.
- Evidence: AW-009 on 2026-10-27: the chat plan's `Tự review` sources, the `planning` Final check and the Codex round 1 brief all omit `skill-authoring`; the Owner caught it, and Codex round 3 with `skill-authoring` found 2 Required (session `01a17940-6d1c-7b52-8c83-2816e6b0f2cc`). The `skill-authoring` description names editing a skill, so the description was not the cause.
- Direction: after discovery and before editing, list the files the work will change and load every skill whose Use when covers them; the Codex brief's skill list comes from that same file list. Main proposes the owner of each step (`docs/agent-loops.md` Sizing or Loop 0, `codex-brief.md`) in its own plan.
- Exit condition: the re-match step and the Codex brief source are stated by their owners, and `npm run docs:check` passes.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-004 — Resolved 2026-10-22: CP5 and the CP6 planner reran on a base branch without plan sections 4.1 and 4.2, with valid results (`1b8d8e5`).
- AW-005 — Resolved 2026-10-22: the CP6 implementor rerun loaded `git-pr-workflow` before committing and `code-review` before its self-review (`b99315e`).
- AW-001 — Moved 2026-10-22 to [infrastructure](../infrastructure/problems.md), unit U1.
- AW-003 — Moved 2026-10-22 to [security-hotfix](../security-hotfix/problems.md); it waits for H2-2.
- AW-006 — Resolved 2026-10-25: U4 fixed every item and the fresh read-only audit passed (PR 21, `4fa5731`).
- AW-007 — Resolved 2026-10-26: U6 audited every instruction, the Owner decided each item, and section 2 states when Main edits state records (PR 23, `bd19c18`).
- AW-010 — Resolved 2026-10-26: U7 added entry plans, so a delivery program plans a `problems.md` or `future-features.md` entry without revising its master plan (PR 24, `85248b2`).
