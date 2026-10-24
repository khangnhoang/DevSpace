# Problems, risks and follow-ups — agent-workflow

Charter: `README.md`. Progress: `progress.md`.

## Open

### AW-002: The detail-plan template's progress link resolves by accident

- Status: Accepted (2026-10-22, moved from `agent-workflow` when it closed).
- Problem: `.claude/skills/program-docs/references/templates/detail-plan.md` links `[progress.md](progress.md)`, which passes the link check only because the sibling template `progress.md` exists in the same folder. Renaming or moving the progress template breaks the link check on the detail template.
- Evidence: `npm run docs:check-links` passes; removing `references/templates/progress.md` makes the detail-plan link broken.
- Direction: keep the link, because a copied template must keep a working `progress.md` link; move the progress template and the detail template together.
- Exit condition: none needed while both templates stay in the same folder; reopen if one of them moves.

### AW-006: Agent instructions lag the infrastructure

- Status: Open (2026-10-25, Codex instruction audit, session `01a16f8a-392f-7713-9cf9-64b9f3651d1b`, read-only, after infrastructure U6).
- Problem: (1) manual QA (`frontend-workflow/references/manual-ui-validation.md`) still starts `npm run dev` on hosted data; (2) the verify steps of `code-review`, `server-actions` and `planning` do not select the automated suites (`npm test`, `test:unit`, `test:e2e`); (3) `supabase-migration` tells implementors to run `npx supabase migration new`, which `.claude/rules.md` section 4 does not allow; (4) the `playwright-cli` references tell agents to edit the spec to match the app, use `test.fixme` for confirmed bugs and import the base Playwright `test`, against the DevSpace test contract, and the DevSpace block does not say it wins over the references; (6) `README.md` names Next.js 15, tells the reader to inspect `.env.local` and lists demo accounts apart from the `.test` seed users. Also stale: `code-review/references/special-cases.md` still calls the dependency policy FEAT-001 a backlog item "until test infrastructure exists" (it is infrastructure U7); `frontend-design` and `server-actions` still point to "the foundation PR" in the backlog (now the app-foundation program, ADR 0003); `__tests__/helpers/server-action-core.ts` says `next` is pinned while `package.json` has `^16.4.3` (only the lockfile fixes it). Duplicated: the CI job list and blocking status sit in `CLAUDE.md`, `git-pr-workflow` and `pr-and-ci.md`; permission rules owned by `.claude/rules.md` section 4 are restated in `git-pr-workflow` and `supabase-migration`, which caused item (3). Handoff: `.claude/rules.md` section 7 has no template, and Main misapplied it after infrastructure U6 merged (2026-10-25): with `progress.md` lagging at the merge it kept the handoff as "partly complete" and added the next task's scope, turning a task handoff into a cross-task note.
- Evidence: the audit report with file:line references, checked by Main against the files on 2026-10-25.
- Direction: Owner decisions of 2026-10-25: manual QA uses the local database by default and hosted only by a separate grant; `test-quality-strategy` owns the change-to-suite mapping and the other skills link to it; implementors may create new migration files locally (rules section 4 gains it, the skill links to it); the vendored skill body and references stay byte for byte and the DevSpace block grows to cover the references, the known-bug pattern and the fixture import; `README.md` is updated; the three stale pointers are corrected (FEAT-001 to infrastructure U7, the foundation PR to ADR 0003, the helper comment to "locked by package-lock.json"); each duplicated fact gets one owner: the CI job list, blocking status and failure reading live only in `git-pr-workflow/references/pr-and-ci.md` (next to `ci.yml`), with one pointer line in `CLAUDE.md` and a link from `git-pr-workflow`, and permissions live only in `.claude/rules.md` section 4, with skills linking to it and keeping only tool-specific procedure. A handoff template (in `program-docs` references) and two clarifications in section 7: a handoff never carries another task's scope, and when the owning docs lag at the merge Main updates them and deletes the handoff in that turn instead of keeping it; this item goes first in the initiative plan. One agent-workflow initiative, planned after the ADR 0003 PR merges. The separate dev and test local stacks are infrastructure FEAT-014, not this entry.
- Exit condition: every item above is fixed and merged, and a fresh read-only audit finds none of them.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-004 — Resolved 2026-10-22: CP5 and the CP6 planner reran on a base branch without plan sections 4.1 and 4.2, with valid results (`1b8d8e5`).
- AW-005 — Resolved 2026-10-22: the CP6 implementor rerun loaded `git-pr-workflow` before committing and `code-review` before its self-review (`b99315e`).
- AW-001 — Moved 2026-10-22 to [infrastructure](../infrastructure/problems.md), unit U1.
- AW-003 — Moved 2026-10-22 to [security-hotfix](../security-hotfix/problems.md); it waits for H2-2.
