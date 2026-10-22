# Master plan — infrastructure

Revision: r2, 2026-10-22 (r2 renames the units to U1-U7, no other change). Owner approval: 2026-10-22. Roadmap: [ADR 0001](../../adr/0001-modernization-roadmap.md), step 2.

Progress: [progress.md](progress.md). Problems: [problems.md](problems.md). Future features: [future-features.md](future-features.md). Each unit gets a detail plan at `implementation-plans/<unit>/plan.md` before it starts.

## 1. Goal and outcome

- Goal: DevSpace can be changed and verified without testing on production: every pull request runs real checks on GitHub Actions, and every check that needs data runs against an isolated local Supabase with seed data, never the hosted project.
- Outcome 1: every pull request to `main` runs typecheck, build and both docs checks on GitHub Actions; lint runs and becomes blocking once the existing problems are fixed (Outcome 6).
- Outcome 2: the repo holds a full schema baseline, and `supabase db reset` rebuilds the hosted schema plus fake seed data on the Owner's machine and in CI, with no hosted credentials.
- Outcome 3: Vitest runs unit tests and RLS tests against the local database, locally and in CI.
- Outcome 4: Playwright runs smoke tests of the main learner and admin paths against a local build and the local database, locally and in CI.
- Outcome 5: automated tests describe the current payment and coupon flow, with the known bugs P5, P6 and P25 recorded as expected failures, so H2-2b can start.
- Outcome 6: `npm run lint` reports 0 problems and blocks CI.
- Outcome 7: the dependency update policy (FEAT-001) is written and tied to the test suite.
- Outcome 8: the skills, rules and `CLAUDE.md` describe the tooling that exists after each unit, in the same PR that brings it.
- Size and risk: large and high-risk. It adds CI and a hosted migration-history step, touches every server action through lint fixes, and changes agent permissions (the temporary no-database rule).

## 2. Owner decisions

1. (2026-10-22) The program is named `infrastructure`, folder `docs/programs/infrastructure`; references to "test-infra" in state records are renamed, and skills are renamed in the unit that rewrites them.
2. (2026-10-22) The schema baseline comes from a schema-only `supabase db dump` that the Owner runs (it needs the database password, which agents never handle). Main reviews it, and it is stored as a baseline migration ordered before `20261021131351`. Recording it as applied on hosted (`supabase migration repair`) is a separate hosted-write grant.
3. (2026-10-22) The local environment is Supabase local on Docker Desktop on the Owner's machine; the Supabase CLI is a pinned devDependency, not a global install. CI runs the same local stack.
4. (2026-10-22) All 81 existing lint problems are fixed (no ratchet, no permanently non-blocking job). Until then the lint job runs without blocking.
5. (2026-10-22) Unit order: CI skeleton, then local database and seed, then Vitest, then Playwright, then payment-flow tests, then the lint cleanup under test protection, then the dependency policy.
6. (2026-10-22) Seed data is written by hand and minimal, and grows with the tests. It never copies hosted rows.
7. (2026-10-22) CI needs no hosted secret: it uses the CLI's local keys, and placeholder values (public and server-side) for the build; Gemini and email are not called by tests.
8. (2026-10-22) The program writes characterization tests of the current payment and coupon flow; known bugs are expected failures tagged with their IDs and are not fixed here. H2-2b fixes them and turns the tests on.
9. (2026-10-22) Skills, rules and `CLAUDE.md` change in the same PR as the tooling they describe (FEAT-002, FEAT-003, FEAT-004 are split across U1 to U4), not in a final skills unit.
10. (2026-10-22) Closing `agent-workflow` ships with this plan's PR. Its open entries move: AW-001, FEAT-002, FEAT-003 and FEAT-004 to this program; FEAT-001 from the backlog to this program; AW-003 to `security-hotfix`; AW-002 and FEAT-005 to FEAT-007 to `docs/backlog/`.
11. (2026-10-22) Unit IDs follow the master-plan template: U1 to U7 (renamed from I1 to I7, which read like "l1").

## 3. Shared invariants

- No test, script, seed or CI job connects to the hosted project `lkvxxrxojjlkchzzqidu`; every Supabase URL in test and CI config is local — prevents tests writing to or reading from production.
- Seed and fixtures contain only invented people and content; no hosted row is copied — prevents leaking real user data into the repo.
- No secret value is committed, printed or put in a CI file; the only keys in the repo are the Supabase CLI's published local demo keys, and nobody reads `.env*` — prevents secret exposure.
- A unit does not change product behavior, except the lint fixes in U6, which must keep behavior identical and are covered by the U3 to U5 tests — prevents a hidden regression inside an infrastructure PR.
- Published migrations are never edited; the baseline is a new file ordered before them that holds the pre-H1 schema, and `supabase db reset` must replay baseline plus all published migrations unchanged and end with a catalog that matches hosted — prevents a local schema that differs from hosted, or a replay that fails because the baseline already contains H1 and H2-1.
- A known bug is never fixed inside a test unit; it is an expected failure with its problem ID that runs, fails on the assertion about that bug, and reports when it unexpectedly passes; a setup, sign-in or connection failure never counts as reproducing it — prevents untracked behavior changes, false confidence, and keeps H2-2 scope with security-hotfix.
- A skill, rule or `CLAUDE.md` line states only tooling that exists on `main` after that unit merges (`.claude/rules.md` section 8) — prevents agents following instructions for tools that do not exist.
- No unit modernizes code the techstack migration will replace (the Supabase auth helpers, P7) — prevents work that is thrown away (ADR 0001).

## 4. Units

| Unit | Branch | Outcome | Dependencies | Gate to start or enable |
| --- | --- | --- | --- | --- |
| U1 CI skeleton | `chore/infra-ci` | 1, 8 (FEAT-004, AW-001) | none | Owner approves this plan and the U1 detail plan. Enabling required checks in GitHub branch protection is an Owner step after merge. |
| U2 Local database and seed | `chore/infra-local-db` | 2, 8 (FEAT-003 reset part) | hard on U1 (the CI job extends its workflow) | The Owner provides the schema dump; Codex also reviews the baseline file. `migration repair` on hosted is a separate grant after merge. |
| U3 Vitest and RLS tests | `test/infra-vitest` | 3, 8 (FEAT-003 RLS part, FEAT-002 test-quality-strategy) | hard on U2 | U2 merged and `db reset` passes in CI. |
| U4 Playwright smoke | `test/infra-playwright` | 4, 8 (FEAT-002 playwright-cli) | hard on U2; soft on U3 (shared test helpers) | U3 merged (D5 order). |
| U5 Payment-flow tests | `test/infra-payment-flow` | 5 | hard on U4 (server actions run through the app); hard on U3 for DB assertions | U4 merged. |
| U6 Lint cleanup | `chore/infra-lint-cleanup` | 6 | hard on U3, U4 and U5 (regression cover) | U5 merged and the suite is green on `main`. |
| U7 Dependency policy | `docs/infra-dependency-policy` | 7 (FEAT-001) | hard on U3 to U5 (the policy names the suite) | U6 merged or the Owner allows it after U5. |

Every unit is one PR with its own detail plan, approved by the Owner before it starts. U1 to U6 change CI, the database baseline, agent permissions or server-action code, so each gets the Codex gate on its detail plan and on its diff (`.claude/rules.md` sections 2 and 3); U7 is a docs change and gets none. Commit, push, PR creation and merge are separate grants per unit (`.claude/rules.md` section 4).

## 5. Order and rollout gates

1. This plan PR: the master plan, the program files, and the `agent-workflow` closure (D10). Self-review, Codex plan gate, then the Owner approves and grants commit, push and PR separately.
2. U1: detail plan, Codex plan gate, Sonnet implements, Main and Codex review the diff, the Owner merges. After merge, the Owner may set the CI jobs as required checks on `main` in GitHub (the lint job stays non-required until U6).
3. U2: the Owner starts Docker Desktop and runs the schema-only dump with the command in the U2 detail plan; Main reviews the file against a hosted catalog snapshot (tables, columns, policies, functions, triggers including `auth.users`, grants, the `avatars` bucket and its storage policies). The dump is the current schema, which already includes H1 and H2-1, so the pre-H1 baseline is derived from it in a throwaway local database: restore the dump, apply the three published rollbacks locally in reverse order, and dump the result. Rollbacks never run on hosted. Sonnet adds config, baseline, seed and the CI job; until U2 merges the no-database rule still binds it, so Main runs `supabase db reset` locally and compares the local catalog with hosted. After merge and with a separate grant, Main or the Owner runs `migration repair` to mark the baseline as applied on hosted, then verifies the hosted migration list. Before that step, no one runs `supabase db push` against hosted.
4. U3, then U4, then U5, each after the previous merge, each adding its CI job. The rule change removing "implementors run no database" (`.claude/rules.md` section 4) lands in U2, restricted to the local stack; hosted access rules stay unchanged.
5. U6: fixes with every U3 to U5 test green before and after; then the lint job becomes blocking and the Owner adds it to required checks.
6. U7: the policy doc; then the program closes (State completed, problems resolved or moved, backlog reviewed with the Owner, Programs row `closed`).

## 6. Program risks

| Risk | Mitigation |
| --- | --- |
| The dump misses objects outside `public` (the `on_auth_user_created` trigger on `auth.users`, the `avatars` bucket row, storage policies, grants), so local differs from hosted. | U2 diffs a local catalog snapshot against the hosted one per object type; any gap is added to the baseline by hand and the diff is part of the Codex review. |
| The baseline derived through the local rollbacks differs from the real pre-H1 schema (a rollback is incomplete), so the replay fails or ends elsewhere. | The acceptance is the end state, not the derivation: `db reset` must replay all three published migrations unchanged and the final local catalog must match the hosted snapshot; a gap is fixed in the baseline, never in a published migration. |
| Hosted migration history does not know the baseline; a later `db push` would try to apply it to production. | `migration repair` is an explicit post-merge step with its own grant; until it runs, the U2 docs say no `db push` to hosted. |
| Local Postgres or CLI versions differ from hosted (hosted is 17.6). | Pin the CLI version and set the Postgres major version in `supabase/config.toml` to 17. |
| `next build` evaluates modules that create Supabase clients from env at import time (`app/action/payment.ts` and `lib/supabase.admin.ts` need `SUPABASE_SERVICE_ROLE_KEY`; the client throws when a key is missing), so the CI build fails without env. | U1 sets placeholder values for `NEXT_PUBLIC_SUPABASE_URL` (a local URL), `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in the build job; jobs that need data (U2 onward) use the local stack's keys. No hosted secret or connection. |
| Supabase local in CI is slow or flaky (Docker pulls). | Start only the services the tests need, cache where the CLI allows, and keep the U1 jobs (no database) separate so they stay fast. |
| Fixing 81 lint problems changes behavior (for example hook dependency fixes changing render timing). | U6 runs after U3 to U5, keeps each fix minimal, and runs the full suite plus a manual browser pass; any fix that needs a behavior change is recorded as a problem instead. |
| Playwright needs signed-in sessions, and agents do not enter passwords on real sites. | Seed users have test passwords stored in the seed file; tests sign in programmatically against the local stack only, which is the user's own app on localhost. |
| Characterization tests freeze bugs as correct. | Known bugs are expected failures tagged P5, P6, P25; unknown odd behavior found while writing them is recorded in `security-hotfix/problems.md`, not encoded as expected. |
| Lifting the no-database rule lets implementors reach hosted. | The U2 rule text allows only the local stack (`supabase start`, `db reset` and SQL against the local URL); Supabase MCP and hosted access stay Main-only. |

## 7. Out of scope

- Fixing P5, P6, P25 or any other security-hotfix problem (H2-2a, H2-2b).
- P7 (server components read with the anon client) and the Supabase auth helpers: left to the techstack migration.
- shadcn, Zod and React Hook Form (FEAT-005, FEAT-006) and the token-budget rule (FEAT-007).
- Preview databases per PR, Supabase branching, Vercel configuration changes and deployment changes.
- Coverage targets, visual regression, load testing and tests of Gemini or email delivery.
- Copying hosted course content into the seed.
