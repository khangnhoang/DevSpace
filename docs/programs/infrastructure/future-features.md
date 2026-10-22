# Future features — infrastructure

Direction the Owner has set that this program delivers in a later unit. Each entry ships in the same PR as the tooling it describes (plan decision 9).

## FEAT-001: Dependency update policy

- Status: Planned for I7 (moved from `docs/backlog/` on 2026-10-22); an update is only safe to accept with tests.
- Direction: set one policy by update type. Patch: update regularly and run the tests. Minor: read the changelog first. Major: handle it as its own migration task. Security fix: handle early, ordered by impact.
- Target program: infrastructure (I7).

## FEAT-002: Test skills

- Status: Planned (moved from `agent-workflow` on 2026-10-22).
- Direction: port `test-quality-strategy` (in I3) and `playwright-cli` (in I4) from VocaSpace, rewritten for DevSpace. Expand `CLAUDE.md` rule 9 (tests verify observable behavior) into the test skill. A new skill needs the Owner's decision (`.claude/rules.md` section 8); this plan's approval is that decision for these two.
- Target program: infrastructure (I3, I4).

## FEAT-003: Local database reset and RLS tests in `supabase-migration`

- Status: Planned (moved from `agent-workflow` on 2026-10-22).
- Direction: add `supabase db reset` (I2) and the automated RLS tests (I3) to the `supabase-migration` skill, replacing the "no local database" workaround it carries today. Remove the temporary rule in `.claude/rules.md` section 4 (implementors run no database) in I2, keeping hosted access Main-only.
- Target program: infrastructure (I2, I3).

## FEAT-004: CI step in the workflow and the commands

- Status: Planned for I1 (moved from `agent-workflow` on 2026-10-22).
- Direction: add the CI step to `git-pr-workflow` and its `pr-and-ci.md` reference. The GitHub Actions job must also run `npm run docs:check` and `npm run docs:check:test` (agent-workflow D9). Update the commands section of `CLAUDE.md`: real CI instead of Vercel only, and each later unit adds its test commands.
- Target program: infrastructure (I1, then I2 to I4 for their commands).
