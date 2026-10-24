# DevSpace

DevSpace is an online programming LMS that the Owner built alone as a graduation project: Next.js 16 (App Router), React 19, Tailwind 4, Supabase (Auth, Postgres, Storage). Production: https://devspace-lms.vercel.app. Hosted Supabase project: `lkvxxrxojjlkchzzqidu`. GitHub: `khangnhoang/DevSpace`.

Roadmap, in this order: (1) agent-workflow (rules, skills, docs system), (2) infrastructure (tests, CI, an isolated local environment), (3) frontend foundation (shadcn, React Hook Form, Zod on client and server), (4) techstack migration (Next.js + NestJS + PostgreSQL). Do not modernize parts that the migration will replace (for example the Supabase auth helpers). See [ADR 0001](docs/adr/0001-modernization-roadmap.md) and [ADR 0003](docs/adr/0003-frontend-foundation-program.md).

## Commands

- `npm run dev`, `npm run build`, `npm start`.
- `npm run lint`: it must report 0 problems, warnings included (`--max-warnings 0`).
- `npx tsc --noEmit`: type check.
- `npm run docs:check`: structure and link checks for `docs/`, `.claude/`, `CLAUDE.md`, `README.md`. `npm run docs:check:test` runs its tests.
- CI (`.github/workflows/ci.yml`) runs `typecheck`, `build`, `docs`, `lint`, `db` and `e2e` on every pull request to `main` and every push to `main`, with no hosted secret; `db` starts the local Supabase stack, runs `db reset`, then `npm test`; `e2e` starts its own local stack, installs Chromium and runs `npm run test:e2e`. All six jobs block, `lint` included: it fails on any lint problem, and the step's log lists them (`gh run view <id> --log-failed`). Whether `main` requires them is an Owner setting in GitHub; check it with `gh api repos/khangnhoang/DevSpace/branches/main/protection` (read-only). The Vercel deploy still runs as before.
- Local database (Docker Desktop running): `npx supabase start`, `npx supabase db reset` (baseline, migrations, then the invented seed in `supabase/seed.sql`, which holds the users `learner@devspace.test`, `student@devspace.test` and `admin@devspace.test`), `npx supabase stop`. The checkout stays linked to hosted, so only these local commands are routine; hosted applies follow `supabase-migration` ("Hosted apply").
- `npm test` runs the Vitest `unit` and `rls` projects; `rls` needs the local stack started and `db reset` done. `npm run test:unit` runs the unit tests alone and needs no Docker. Under an agent environment Vitest prints a minimal report that hides the `known bug <id>` lines; run `npm test -- --reporter=default` to see them.
- `npm run test:e2e` runs the Playwright smoke in Chromium (`__tests__/e2e`): it needs the local stack started and `db reset` done, builds the app with the local stack's URL and keys, serves it on port 3100 and never reuses a server. It overwrites `.next`, so run `npm run build` before `npm start` afterwards. The first run on a machine needs `npx playwright install chromium` (about 180 MB). The server runs behind a network guard and a mail record, and the payment rows call the payment server actions directly (`__tests__/e2e/payment-*.spec.ts`). The other server actions have no tests: verify them by commands and a manual browser pass, and report what was not verified.

## Code map

- `app/(main)`: learner and public pages (`course`, `learn`, `profile`, `try_it`, `login`). `app/admin`: admin pages.
- `app/action/*.ts`: server actions. Each one is a public POST endpoint.
- `lib/auth.server.ts`: `requireUser`, `requireAdmin` and course-access checks. `lib/supabase.server.ts` (caller session), `lib/supabase.admin.ts` (service role, server-only).
- `supabase/migrations` and `supabase/rollbacks`: one `.down.sql` per migration. Published migrations are never edited.
- `docs/programs/<program>/`: program plans (or the charter `README.md` of an evergreen program) and state. `docs/adr/`: cross-program decisions. `docs/backlog/`: work no open program owns.

## Core engineering rules

1. **Think before coding.** Separate confirmed facts, Owner decisions, assumptions and open questions. Read the current contract first. Stop when an unresolved ownership, permission or acceptance question could change the solution.
2. **Simplicity first.** Use the smallest mechanism that solves the problem. Add a control, layer or workflow stage only if omitting it has a realistic failure mode. Never use this to skip security, data-integrity, permission or truthful-verification requirements.
3. **Surgical changes.** Touch only what the outcome or a correctness constraint needs. Do not refactor, rename or fix unrelated code; report adjacent defects separately. Clean up only what your change made obsolete.
4. **Goal-driven execution.** State what must change, what must stay true and what is excluded before implementing. Finished steps are not completion while the outcome is unverified.
5. **Models for judgment only.** Use search, git, `tsc`, lint, validators and exact comparisons for factual and structural questions. Reviewer output is advisory until checked against the repo.
6. **Read deliberately.** Read the owning source and its direct dependencies before changing them, and each matching skill completely. Do not reload unchanged or irrelevant files. Budget pressure never justifies skipping required evidence.
7. **Surface conflicts, do not average them.** Name the conflicting sources and apply documented precedence. If permission is still unclear, take the narrower action and report it.
8. **Read before writing.** Inspect the target, nearby contracts and conventions (and the program's plan, progress and problems when they affect scope) before proposing a change.
9. **Tests verify observable behavior.** Assert the promised contract (inputs, outputs, permissions, persistence), not the implementation; the `test-quality-strategy` skill owns how. Say plainly which checks ran, failed, were skipped or were not possible.
10. **A finished implementation is a review checkpoint.** Report changed files, checks actually run, remaining risks and a proposed English Conventional Commit message. Commit, push, PR, CI fixing, merge, applying a migration and database writes are separate grants.
11. **Match conventions.** Follow the nearby naming, placement, error handling and doc structure, even if you would choose differently. Keep one owner and one source of truth per fact.
12. **Fail loud.** A blocked, failed, partial or unverified result stays visibly so. Report the exact failure and the smallest thing needed to resume. Do not hide it behind a mock, fallback or weaker check.

## Imports

@.claude/rules.md
@docs/agent-loops.md
