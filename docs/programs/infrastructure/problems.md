# Problems, risks and follow-ups — infrastructure

Plan: [plan.md](plan.md). Progress: [progress.md](progress.md).

## Open

### AW-001: Docs checks are not run by CI

- Status: Deferred (2026-10-22, moved from `agent-workflow`; owned by U1).
- Problem: `npm run docs:check` and `npm run docs:check:test` run only when a session runs them. The only check on a pull request is the Vercel deploy, so a docs change that breaks a link or a structure rule can merge.
- Evidence: the repo has no GitHub Actions workflow; the checks exist as npm scripts only.
- Direction: U1 adds a CI job that runs both scripts (FEAT-004 in [future-features.md](future-features.md)).
- Exit condition: a CI job runs `npm run docs:check` and `npm run docs:check:test` on pull requests.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.
