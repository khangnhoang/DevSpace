# Problems, risks and follow-ups — backlog

Problems that no open program owns. This is not a program: it has no plan and no progress.

## Open

### AW-002: The detail-plan template's progress link resolves by accident

- Status: Accepted (2026-10-22, moved from `agent-workflow` when it closed).
- Problem: `.claude/skills/program-docs/references/templates/detail-plan.md` links `[progress.md](progress.md)`, which passes the link check only because the sibling template `progress.md` exists in the same folder. Renaming or moving the progress template breaks the link check on the detail template.
- Evidence: `npm run docs:check-links` passes; removing `references/templates/progress.md` makes the detail-plan link broken.
- Direction: keep the link, because a copied template must keep a working `progress.md` link; move the progress template and the detail template together.
- Exit condition: none needed while both templates stay in the same folder; reopen if one of them moves.

### BL-001: A moved FEAT entry fails the ID uniqueness check

- Status: Fixed locally, awaiting delivery (2026-10-22, on `fix/docs-check-moved-feat`).
- Problem: the `program-docs` skill allows a closed future-features line `FEAT-nnn — Moved to [...]`, but `scripts/docs/check-structure.mjs` counts that line as a use of the ID, so moving an entry to another `future-features.md` always reports "ID is not unique". Closing `agent-workflow` therefore recorded its moves in prose instead of closed lines.
- Evidence: `npm run docs:check-structure` reported 7 `future-features-shape` violations with the `Moved to` lines in place (2026-10-22); the `noteId` check in `check-structure.mjs` runs on closed lines too.
- Direction: the checker treats a `Moved to` line as a pointer: it does not count as a declaration, but its ID must be declared in some `future-features.md` and moved only once. The closed `agent-workflow` and backlog files use the template `Moved to` lines again.
- Exit condition: the skill and the checker agree, and a moved FEAT entry passes `npm run docs:check`.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.
