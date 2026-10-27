# Future features — infrastructure

Direction the Owner has set that this program delivers in a later unit. Each entry ships in the same PR as the tooling it describes (plan decision 9).

## FEAT-001: Dependency update policy

- Status: delivered in U7, awaiting merge (moved from `docs/backlog/` on 2026-10-22); the policy is the `dependency-updates` skill.
- Direction: set one policy by update type. Patch: update regularly and run the tests. Minor: read the changelog first. Major: handle it as its own migration task. Security fix: handle early, ordered by impact. The policy also covers the Supabase CLI (an exact devDependency since U2, the only CLI on the Owner's machine and in CI, D3): an update also changes the local Docker images, so it is accepted only when `db reset`, the catalog diff against hosted and the tests stay green (Owner request, 2026-10-23).
- Follow-ups carried to the backlog, one entry per package: Node 26 and `@types/node` in FEAT-019, the waiting majors in FEAT-020, the findings with no in-range fix (`nodemailer`, `dompurify` through Monaco, `@tailwindcss/typography`, the dev-only `eslint-config-next` chain) in BL-009 ([backlog](../../backlog/future-features.md)).
- Target program: infrastructure (U7).

## Closed

- FEAT-002 — Done: `test-quality-strategy` ported in U3 (PR 15) and `playwright-cli` vendored in U4 (PR #17)
- FEAT-003 — Done: `db reset` and the local-stack rule in U2 (PR 12), the RLS tests in `supabase-migration` in U3 (PR #15)
- FEAT-004 — Done: the CI jobs and their commands in `git-pr-workflow` and `CLAUDE.md`, added by U1 to U3 in PR 11, PR 12 and PR 15, and by U4 (PR #17)
- FEAT-017 — Done: `db` and `e2e` are skipped on docs-only pull requests, delivered in PR 25 and AC1 observed on the first docs-only PR (PR #26)
- FEAT-018 — Done: the `e2e` job installs only the headless shell without apt; the push run on `main` after PR 28 (run 40383406684) passed all six jobs and 46 tests with the install step at 5 seconds and no `Installing dependencies` (PR #27)
- FEAT-014 — Moved to [backlog](../../backlog/future-features.md)
