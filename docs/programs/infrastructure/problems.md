# Problems, risks and follow-ups — infrastructure

Plan: [plan.md](plan.md). Progress: [progress.md](progress.md).

## Open

None.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-001 — Resolved 2026-10-23: the CI job `docs` runs `npm run docs:check` and `npm run docs:check:test` on every pull request and push to `main` (PR 11, run 39821844267).
- INF-001 — Resolved 2026-10-23: `next` and `eslint-config-next` 16.4.3 plus `npm audit fix` took `npm audit --omit=dev` from 17 findings to 5, none critical or high with an in-range fix; the 5 left are in FEAT-001 (this commit).
