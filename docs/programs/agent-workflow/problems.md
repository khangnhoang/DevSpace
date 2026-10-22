# Problems, risks and follow-ups — agent-workflow

Plan: `plan.md`. Progress: `progress.md`.

## Open

### AW-001: Docs checks are not run by CI

- Status: Deferred (2026-10-22, until the test-infra program).
- Problem: `npm run docs:check` and `npm run docs:check:test` run only when a session runs them. The only check on a pull request is the Vercel deploy, so a docs change that breaks a link or a structure rule can merge.
- Evidence: the repo has no GitHub Actions workflow; the checks exist as npm scripts only.
- Direction: the test-infra program adds a CI job that runs both scripts (FEAT-004 in `future-features.md`).
- Exit condition: a CI job runs `npm run docs:check` and `npm run docs:check:test` on pull requests.

### AW-002: The detail-plan template's progress link resolves by accident

- Status: Accepted (2026-10-22).
- Problem: `.claude/skills/program-docs/references/templates/detail-plan.md` links `[progress.md](progress.md)`, which passes the link check only because the sibling template `progress.md` exists in the same folder. Renaming or moving the progress template breaks the link check on the detail template.
- Evidence: `npm run docs:check-links` passes; removing `references/templates/progress.md` makes the detail-plan link broken.
- Direction: keep the link, because a copied template must keep a working `progress.md` link; move the progress template and the detail template together.
- Exit condition: none needed while both templates stay in the same folder; reopen if one of them moves.

### AW-003: `security-hotfix/problems.md` is exempt from the problems shape

- Status: Deferred (2026-10-22, until a unit reopens the security work).
- Problem: `security-hotfix/problems.md` keeps its P1-P29 table, so `check-structure.mjs` allowlists it for `problems-shape`. It is the only program problems file that is not in the open-entry shape.
- Evidence: the `ALLOWLIST` entries in `scripts/docs/check-structure.mjs`, with their reasons.
- Direction: when a unit reopens security work (H2-2a or H2-2b), reshape the table into open entries and one-line resolved entries, keeping every ID, and remove the allowlist entry. `plan-h2.md` stays on the allowlist because published migrations cite its path.
- Exit condition: the `problems-shape` allowlist entry is removed and `npm run docs:check` passes.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.
