# ADR 0001: Modernization roadmap

Date: 2026-10-22. Status: Accepted; the program order is amended by [ADR 0003](0003-frontend-foundation-program.md).

## Context

DevSpace was built by the Owner alone as a graduation project, before agents were used. Its stack has gaps: no tests, no CI beyond the Vercel deploy, no database baseline in the repo, and no Zod, shadcn or React Hook Form. The Owner plans to move to Next.js + NestJS + PostgreSQL, a risky change that should start from stable operations. Manual testing on production is currently too heavy to do that safely.

## Decision

Work runs as three programs in this order, each split into small pull requests:

1. `agent-workflow`: the agent rules, skills, lifecycle loops and docs checks.
2. `infrastructure`: test infrastructure (Vitest/Playwright), an isolated local environment with seed data, and real CI (GitHub Actions: lint, typecheck, build, later tests).
3. `techstack-migration`: the move to Next.js + NestJS + PostgreSQL.

Do not modernize a part that the migration will replace anyway (for example the Supabase auth helpers). shadcn, Zod and React Hook Form are adopted incrementally in a separate foundation PR, not inside `agent-workflow`.

## Consequences

- New work stays inside this sequence; a task that does not fit it needs the Owner's decision.
- Security work that depends on automated tests (H2-2b, the coupon and payment RPCs) waits for `infrastructure`.
- Deferred rules and skills (test skills, RLS tests, CI step, Zod/shadcn guidance) are listed in `docs/programs/agent-workflow/future-features.md` with their target program.
- The program names above are the roadmap's names; a program folder is created under `docs/programs/` when its first unit is planned.
