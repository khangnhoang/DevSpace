# Problems, risks and follow-ups — infrastructure

Plan: [plan.md](plan.md). Progress: [progress.md](progress.md).

## Open

### INF-001: Production dependencies with known vulnerabilities

- Status: Open (2026-10-23, Owner decision: a separate security-update PR after U3 merges).
- Problem: `npm audit --omit=dev` reports 17 vulnerabilities (1 critical, 8 high, 8 moderate). `next` 16.0.10 is marked critical; `nodemailer` 7.0.12 (used by `lib/email.server.ts`) is high and its fix needs major 10; the rest are transitive (`ws`, `postcss`, `dompurify`, `sharp`, `minimatch`, `js-yaml` and others). Some `next` advisories apply only to self-hosted apps; each still needs reading against DevSpace on Vercel.
- Evidence: `npm audit --omit=dev` and `npm outdated` on `test/infra-vitest` at `2f4abfb`, 2026-10-23; `next` 16.4.2 is inside the current `^16.0.10` range.
- Direction: after U3 merges, one PR updates `next` to the latest 16.x and runs `npm audit fix` without `--force` (in-range versions only), verified by `npm run build`, `npm test` and a browser pass. Major updates (`nodemailer` 10 and the others in FEAT-001) go through U7's policy.
- Exit condition: `npm audit --omit=dev` reports no critical or high finding that has an in-range fix, and every remaining one is listed in FEAT-001 with its major-update plan.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-001 — Resolved 2026-10-23: the CI job `docs` runs `npm run docs:check` and `npm run docs:check:test` on every pull request and push to `main` (PR 11, run 39821844267).
