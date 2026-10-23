# Future features — infrastructure

Direction the Owner has set that this program delivers in a later unit. Each entry ships in the same PR as the tooling it describes (plan decision 9).

## FEAT-001: Dependency update policy

- Status: Planned for U7 (moved from `docs/backlog/` on 2026-10-22); an update is only safe to accept with tests.
- Direction: set one policy by update type. Patch: update regularly and run the tests. Minor: read the changelog first. Major: handle it as its own migration task. Security fix: handle early, ordered by impact. The policy also covers the Supabase CLI (an exact devDependency since U2, the only CLI on the Owner's machine and in CI, D3): an update also changes the local Docker images, so it is accepted only when `db reset`, the catalog diff against hosted and the tests stay green (Owner request, 2026-10-23).
- Found on 2026-10-23 (`npm outdated`): major updates waiting are TypeScript 5 to 7, ESLint 9 to 10, `lucide-react` 0.x to 1, `@google/genai` 1 to 2 and `nodemailer` 7 to 10 (also a security fix, INF-001); `@supabase/ssr` 0.7 to 0.12 is an auth helper and waits for the techstack migration (ADR 0001). Node versions differ: Vercel production runs `22.x`, CI and the Owner's machine run 24, and `package.json` has no `engines` field; the policy pins one Node major for production, CI and `@types/node`. Owner decision (2026-10-23): once Node 26 enters LTS (scheduled after 2026-10-28), production, CI and `@types/node` move straight to 26, skipping 24; until then they stay as they are, with `@types/node` on `^22` to match production.
- Target program: infrastructure (U7).

## FEAT-002: Test skills

- Status: `test-quality-strategy` part done on `test/infra-vitest` (U3), awaiting delivery; `playwright-cli` planned for U4. Moved from `agent-workflow` on 2026-10-22.
- Direction: port `test-quality-strategy` (in U3) and `playwright-cli` (in U4) from VocaSpace, rewritten for DevSpace. Expand `CLAUDE.md` rule 9 (tests verify observable behavior) into the test skill. A new skill needs the Owner's decision (`.claude/rules.md` section 8); this plan's approval is that decision for these two.
- Target program: infrastructure (U3, U4).

## FEAT-003: Local database reset and RLS tests in `supabase-migration`

- Status: reset part done in PR 12 (U2); RLS-test part done on `test/infra-vitest` (U3), awaiting delivery. Moved from `agent-workflow` on 2026-10-22.
- Direction: add `supabase db reset` (U2) and the automated RLS tests (U3) to the `supabase-migration` skill, replacing the "no local database" workaround it carries today. Remove the temporary rule in `.claude/rules.md` section 4 (implementors run no database) in U2, keeping hosted access Main-only.
- Target program: infrastructure (U2, U3).

## FEAT-004: CI step in the workflow and the commands

- Status: U1 part done in PR 11 (CI job, `git-pr-workflow` and `CLAUDE.md` Commands); U2 part (the `db` job) in PR 12; U3 part (`npm test` in `db`, the test commands) on `test/infra-vitest`, awaiting delivery; U4 adds its commands.
- Direction: add the CI step to `git-pr-workflow` and its `pr-and-ci.md` reference. The GitHub Actions job must also run `npm run docs:check` and `npm run docs:check:test` (agent-workflow D9). Update the commands section of `CLAUDE.md`: real CI instead of Vercel only, and each later unit adds its test commands.
- Target program: infrastructure (U1, then U2 to U4 for their commands).
