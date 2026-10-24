# Future features — infrastructure

Direction the Owner has set that this program delivers in a later unit. Each entry ships in the same PR as the tooling it describes (plan decision 9).

## FEAT-001: Dependency update policy

- Status: Planned for U7 (moved from `docs/backlog/` on 2026-10-22); an update is only safe to accept with tests.
- Direction: set one policy by update type. Patch: update regularly and run the tests. Minor: read the changelog first. Major: handle it as its own migration task. Security fix: handle early, ordered by impact. The policy also covers the Supabase CLI (an exact devDependency since U2, the only CLI on the Owner's machine and in CI, D3): an update also changes the local Docker images, so it is accepted only when `db reset`, the catalog diff against hosted and the tests stay green (Owner request, 2026-10-23).
- Found on 2026-10-23 (`npm outdated`): major updates waiting are TypeScript 5 to 7, ESLint 9 to 10, `lucide-react` 0.x to 1, `@google/genai` 1 to 2 and `nodemailer` 7 to 10 (also a security fix, INF-001); `@supabase/ssr` 0.7 to 0.12 is an auth helper and waits for the techstack migration (ADR 0001). Node versions differ: Vercel production runs `22.x`, CI and the Owner's machine run 24, and `package.json` has no `engines` field; the policy pins one Node major for production, CI and `@types/node`. Owner decision (2026-10-23): once Node 26 enters LTS (scheduled after 2026-10-28), production, CI and `@types/node` move straight to 26, skipping 24; until then they stay as they are, with `@types/node` on `^22` to match production.
- Left after INF-001 (2026-10-23, `npm audit --omit=dev` with `next` 16.4.3): `nodemailer` 7.0.13 high, fixed only in major 10; `dompurify` 3.4.15 critical and high (GHSA-cg2g-xh64-v4q7 and others), pinned exactly by `monaco-editor` 0.57.0, its latest release, so no in-range fix, and `monaco-editor` low through it; `@tailwindcss/typography` 0.5.20 and its `postcss-selector-parser` moderate, where npm offers only a downgrade to 0.5.4. The app never loads that npm `monaco-editor`: `@monaco-editor/loader` loads `monaco-editor` 0.55.1 from jsDelivr at runtime, which `npm audit` cannot see, so the policy also pins and reviews that CDN version. Dev-only: `eslint-config-next` 16.4.3 still pulls a high `fast-glob`, `micromatch` and `braces` chain that npm fixes only by a downgrade.
- Target program: infrastructure (U7).

## FEAT-014: Separate dev and test local stacks

- Status: Planned after U7 (Owner decision, 2026-10-25); not yet a unit of the master plan.
- Direction: run two local Supabase stacks instead of one: `dev` (seed data, manual QA) and `test` (the `rls` and `e2e` suites, each on a fresh `db reset`, still cleaning up after themselves), with distinct `project_id`s and port ranges, shared migrations and seed, and test helpers that read the `test` stack. A stack is started only when needed and stopped after use; every start and stop is confirmed (`supabase status` and `docker ps` for that `project_id`), not assumed from the command's exit; a reset needs to know who owns the stack. A third stack (separate `rls` and `e2e`) was considered and not chosen: double the containers for little gain. CI is unaffected (one stack per job). Needs a master-plan revision before it starts.
- Target program: infrastructure.

## Closed

- FEAT-002 — Done: `test-quality-strategy` ported in U3 (PR 15) and `playwright-cli` vendored in U4 (PR #17)
- FEAT-003 — Done: `db reset` and the local-stack rule in U2 (PR 12), the RLS tests in `supabase-migration` in U3 (PR #15)
- FEAT-004 — Done: the CI jobs and their commands in `git-pr-workflow` and `CLAUDE.md`, added by U1 to U3 in PR 11, PR 12 and PR 15, and by U4 (PR #17)
