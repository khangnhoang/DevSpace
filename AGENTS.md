# DevSpace

DevSpace is an online programming LMS that the Owner built alone as a graduation project: Next.js 16 (App Router), React 19, Tailwind 4, Supabase (Auth, Postgres, Storage). Production: https://devspace-lms.vercel.app. Hosted Supabase project: `lkvxxrxojjlkchzzqidu`. GitHub: `khangnhoang/DevSpace`.

Roadmap, in this order: (1) agent-workflow (rules, skills, docs system), (2) infrastructure (tests, CI, an isolated local environment), (3) app foundation (shadcn, React Hook Form, Zod on client and server), (4) techstack migration (Next.js + NestJS + PostgreSQL). Do not modernize parts that the migration will replace. See [ADR 0001](docs/adr/0001-modernization-roadmap.md) and [ADR 0003](docs/adr/0003-app-foundation-program.md).

## Commands

- `npm run dev` builds the API once, then runs `next dev` at `http://127.0.0.1:3000` and the API at `http://127.0.0.1:4000` together on the dev stack (`/api/*` on 3000 is rewritten to 4000 by `proxy.ts`), and needs the stack started (see the local databases below); it fails with a message when the stack is down and never reaches hosted. It takes no test lock and changes no data. Restart it to pick up a backend change. The AI key comes from the Owner's environment file. `npm run build`, `npm start`.
- The API (`backend/`, an npm workspace, `devspace-api`): `npm run build:api` writes `dist/backend/src/main.js`, `npm run typecheck:api` checks its production and e2e configurations, and `npm run lint:api` runs its own ESLint config at 0 warnings; the root `npm run lint` ignores `backend/`. `npm run api:schema:pull` regenerates `backend/src/db/schema.ts` and `relations.ts` from the dev database with `drizzle-kit`, and `npm run api:schema:check` compares them with the test stack (it takes the test lock). Neither writes to a database.
- Node: DevSpace runs the major in `.node-version`. On the Owner's machine fnm selects it (Node installs in `%USERPROFILE%\.fnm`, set as `FNM_DIR` in the PowerShell profile and `~/.bashrc`), and an interactive shell switches on `cd`. An agent, in Git Bash or PowerShell, runs each DevSpace Node command from the repository root as `fnm exec -- <command>`, which takes the version from `.node-version`; `npm` and `npx` are written `npm.cmd` and `npx.cmd` there, because fnm starts the program without a shell and Windows ships them as `.cmd` shims (`fnm exec -- npm.cmd test`). It shows `fnm exec -- node -v` in its report. When `fnm` is not found or `FNM_DIR` is unset it loads the shell profile first (`source ~/.bashrc` in Git Bash); when `fnm exec` fails it stops and reports instead of running the command on the system Node 24. The commands below are written without the prefix.
- `npm run lint`: it must report 0 problems, warnings included (`--max-warnings 0`).
- `npm run format -- <paths>` formats the given files with Prettier (`.prettierrc.json`); `npm run format:check -- <paths>` only reports the ones that differ. Both take the files a change adds or modifies, never the whole repository, and skip what `.prettierignore` and `.gitignore` list (Markdown, `supabase/`, `components/ui/`, the vendored skill, build output). CI has no format check. When to run it: `git-pr-workflow` (Format the changed files).
- `npx tsc --noEmit`: type check.
- `npm run docs:check`: structure and link checks for `docs/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`, `README.md`, plus the bounded instruction-import contract (`skill-authoring`, Choosing where an instruction goes). `npm run docs:check:test` runs its tests.
- CI runs on every pull request to `main`, with no hosted secret; a push to `main` starts no run. The backend runs inside the same six jobs (both type checks, both builds, `npm test` with the `api` project and the schema check, both servers in `e2e`, `lint:api`). The jobs, which of them block and how to read a failure: [pr-and-ci.md](.claude/skills/git-pr-workflow/references/pr-and-ci.md).
- Local databases (Docker Desktop running): two stacks run side by side. The dev stack (project `devspace-local`, ports 54320–54329) holds the data for manual QA: `npx supabase start`, `npx supabase db reset` (baseline, migrations, then the invented seed in `supabase/seed.sql`, which holds the users `learner@devspace.test`, `student@devspace.test` and `admin@devspace.test`), `npx supabase migration list --local` and `npx supabase migration up --local` (applies only the migrations the dev database lacks and keeps its data, without rerunning the seed; always pass `--local`, because the checkout is linked to hosted), `npx supabase stop`. Start it for manual QA and run `npx supabase stop` afterwards; no test command reads, resets or stops it. The test stack (project `devspace-test`, ports 55320–55329) belongs to the test commands below, which start, check and reset it; do not run Supabase commands on it by hand. The checkout stays linked to hosted, so only these local commands are routine; hosted applies follow `supabase-migration` ("Hosted apply").
- `npm test` runs every Vitest project (`unit`, `components`, `api` and `rls`) on the test stack. It needs Docker Desktop, takes the machine-wide test lock, builds the API (production and test-fixture builds) for the `api` project, starts the stack if it is down (a start without its data volume applies the migrations and seed and needs no reset) and otherwise resets it only when `--reset` is passed, the last run was unclean, no reset is recorded, the migrations, seed or test config changed, or the data drifted from the last reset's snapshot (order and detail: `test-quality-strategy`, Test stack). It changes only the test database. The `api` project starts the API as a separate process under a network guard and reads the stack only from the test project's status. See [test-quality-strategy](.claude/skills/test-quality-strategy/SKILL.md).
- `npm run test:unit` runs the `unit` and `components` (jsdom, Testing Library) tests and needs no Docker.
- `npm run test:stack:stop` stops the test stack and confirms that no `devspace-test` container remains. It takes the same lock, stops writer processes an interrupted run left behind and leaves the dev stack and other projects alone.
- `npm run backup:check -- <backup folder>` restores a hosted backup the Owner took ([runbook](.claude/skills/supabase-migration/references/backup-and-restore.md)) into a scratch stack of its own (project `devspace-backup-check`, ports 56320–56329, workdir `.supabase-backup-check/`) and compares it with the hosted counts and migration history Main recorded (a pass proves counts, history and Storage sizes and plain MD5s, not equal row contents); `-- --teardown` removes what an interrupted run left. It needs Docker Desktop, prints aggregates only, reaches nothing hosted and leaves the dev and test stacks alone. Main runs it under the Owner's grant for that backup (section 4); do not run Supabase commands on the scratch stack by hand.
- `npm run test:e2e` runs Playwright in Chromium (learner/admin paths, payment UI/action calls, fixture deletes, dialog/failure handling and the through-Next API rows) on the test stack, with the same lock, start and reset rules as `npm test`. It serves `next start` on port 3100 and the test-fixture build of the API on 3101, both under the network guard, and refuses to start when either port is taken. It needs Docker Desktop and Chromium installed (`npx playwright install chromium`), changes only the test database, and overwrites `.next`, so run `npm run build` before `npm start` afterwards. See [test-quality-strategy](.claude/skills/test-quality-strategy/SKILL.md).

## Code map

- `components/ui/`: shadcn primitives (`button`, `alert-dialog`, `input`, `textarea`, `label`, `field`, `native-select`, `select`, `separator`) added with `npx shadcn add`; `lib/schemas/`: the Zod schemas of the server actions and of the learner, auth and admin content forms; `app/components/ConfirmDialog.tsx` is the confirm dialog of the destructive and payment actions in app-foundation Appendix A. Edits to generated files: [frontend-design](.claude/skills/frontend-design/SKILL.md).
- `backend/`: the NestJS API (ADR 0008): `src/auth` (default-deny, CSRF and session guards), `src/common` (env, body, upload, Zod pipe, limits), `src/db` (pool and the generated Drizzle schema), `src/health`, `src/courses` (public GET routes at `/api/courses/home`, `/api/courses/detail` and `/api/courses/reviews`), and `e2e/` (test-only fixture routes, built apart into `dist-e2e` and absent from `dist`). `lib/api.server.ts` is the one server-side helper that calls the API (`API_INTERNAL_URL`); `proxy.ts` rewrites `/api/*` to it. The Railway service's settings live in the Railway dashboard, and `Dockerfile.api` is its fallback build (`RAILWAY_DOCKERFILE_PATH=Dockerfile.api`). `scripts/api/` builds the API and generates its schema.
- `app/(main)`: learner and public pages (`course`, `learn`, `profile`, `try_it`, `login`). `app/admin`: admin pages. `app/e2e-fixture` (a test-only page, compiled only when `E2E_NEXT_FIXTURES=1`).
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
7. **Surface conflicts, do not average them.** Name the conflicting sources and apply documented precedence. If permission is still unclear, follow `AGENTS.md` section 4.
8. **Read before writing.** Inspect the target, nearby contracts and conventions (and the program's plan, progress and problems when they affect scope) before proposing a change.
9. **Tests verify observable behavior.** Assert the promised contract (inputs, outputs, permissions, persistence), not the implementation; the `test-quality-strategy` skill owns how. Say plainly which checks ran, failed, were skipped or were not possible.
10. **A finished implementation is a review checkpoint.** Report as `docs/agent-loops.md` Loop 1 (Report) says. Permissions for git, remote and database actions are owned by `AGENTS.md` section 4.
11. **Match conventions.** Follow the nearby naming, placement, error handling and doc structure, even if you would choose differently. Keep one owner and one source of truth per fact.
12. **Fail loud.** A blocked, failed, partial or unverified result stays visibly so. Report the exact failure and the smallest thing needed to resume. Do not hide it behind a mock, fallback or weaker check.
13. **Comment the why.** Comment why, a boundary or a hidden constraint (RLS and auth assumptions, migration order, concurrency, external service limits, a workaround), never what the code plainly says; prefer a clearer name or simpler flow, one comment for adjacent code that shares a rule, and no JSDoc on routine code. A TODO states the missing work, why it waits and where it is tracked, and is removed when the condition ends. Update comments that your change makes false; report misleading ones elsewhere instead of cleaning up silently.
14. **Separate concerns.** Keep validation, data access, business rules and presentation in units that can change and be tested on their own (for example a schema in `lib/schemas/`, a pure function for a rule a test must reach). Apply this to the code you change, at a size that fits the change. Add an abstraction only for a benefit you can name, such as testing a rule, isolating a side effect or holding a trust boundary; it never justifies refactoring outside the task (rule 3) or building a layer the roadmap at the top of this file will replace. When a recurring case is unclear under this rule, propose a specific rule for the owning skill to the Owner (section 8; `skill-authoring`, Choosing where an instruction goes).


## Working contract

Read `docs/agent-loops.md` before planning or acting, and read each applicable skill completely (Core engineering rules, rule 6; loops, Sizing). Read [agent-models.md](docs/agent-models.md) before selecting a model or effort for an assigned role. `.claude/skills/` is canonical; `.agents/skills/` exposes the same skills. This file owns shared policy and project context; loops own lifecycle, skills own procedures, `docs/agent-models.md` owns role-to-model choices, and `.claude/rules.md` owns Claude-specific execution bindings. Source references here are not automatic imports in another agent.

Only when Main in Codex app actually hands work to another app chat through desktop chat tools, or an app chat receives that matching handoff, read [codex-app-sessions.md](docs/codex-app-sessions.md). This condition excludes Claude Code/OpenCode and Codex CLI invocations, including `codex exec` launched by Main in Codex app; those keep their existing execution and report paths. Tool availability or quoted app instructions alone do not activate the binding.

## Tool selection

For an authorized operation, use an available CLI that supports it before MCP (for example `gh`, `vercel`, or repository-pinned `npx supabase`). Before declaring a capability gap, inspect installed help, including a supported CLI API path where relevant. Use MCP only for a confirmed CLI capability gap that MCP can fill, within the same role, target and grants under section 4.

A missing executable, CLI error, expired authentication, unavailable network, or sandbox/permission denial is a blocker, not a capability gap. Report the exact blocker and stop; do not implicitly install, log in, link a project or use MCP as a workaround. Before an environment failure becomes a rule or a workaround, isolate its root cause and test the alternative explanations, in the Owner's own shell when the agent's environment may differ. A tool removed outside the repository workflow is detected at its next attempted use; no earlier detection is promised.

When a task adds, removes or replaces a CLI, synchronize its owning instructions and affected consumers in the same change using [skill-authoring, Maintaining](.claude/skills/skill-authoring/SKILL.md#maintaining); the reviewer verifies that synchronization. Selecting an already available CLI requires no new package, scripts or PATH inventory scan. Tool names above are examples, not an inventory to maintain.

## 1. Owner and language

- The Owner built DevSpace alone and decides scope, risk and permissions.
- Chat replies, native question-box questions and options, and wrap-up recaps and buttons are in Vietnamese, in natural wording. Keep code identifiers, paths, commands and exact errors as they are.
- Code, code comments, commits, PRs, skills, rules and every repo doc are in English. UI copy keeps the product's Vietnamese.
- Reports from an implementor or Codex to Main are in English.
- The Owner's current instruction about language wins over this section.

## 2. Roles

- **Small-task flow.** Main implements directly only for a small task as `docs/agent-loops.md` (Sizing) defines it. Otherwise use the planned flow.
- **Program state records.** While an implementor is active on an approved plan, Main edits nothing in the checkout, state records included, and sends every change, an Owner-requested state fix included, to that implementor (an implementor once committed Main's uncommitted diff with its own). An implementor is active only while its session is running a turn; an open, idle session is not active. The implementor updates State in its checkpoint commits (`program-docs`, State has one owner). When no implementor is active, Main edits state records directly: `progress.md`, `problems.md` and `future-features.md` entries, including those in `docs/backlog/`. Before Main sends another message to an idle implementor, Main's state edits are committed; without a commit grant, Main asks the Owner instead of sending the message. No implementor, no review round and no Codex round, even where a plan gates every change after its last review. Main runs `npm run docs:check` afterwards. This does not cover plans, rules, skills or code, and commit and push stay separate grants (section 4).
- **Planned flow.** Main plans, self-reviews the plan, and reviews every diff. One assigned implementor implements the approved plan in the product checkout on the current task branch unless the plan says otherwise. It makes local commits only, loads `git-pr-workflow` before staging or committing (including handoff-granted checkpoint commits), and `code-review` for every self-review. When its turn ends, Main reads the full report and checks the real diff and commits; corrections go to the same implementor until review passes, then Main reports to the Owner. Model and effort choices are in `docs/agent-models.md`; Claude session bindings are in `.claude/rules.md` section 2.
- Large or high-risk work (auth, payment or coupon, admin permissions, schema or migration, data deletion, CI or deploy, the backend migration) adds the Codex gate on the plan and on the implementation diff. An exemption from one stage of the gate (the plan round or the diff round) exists only as a numbered, dated Owner decision in the owning program's master plan or charter, which names the work and the stage it exempts; a detail plan cites that decision and never creates one. No such decision exempts a migration from its review before it is applied (section 3) or a review the Owner asks for.

Main, implementor and reviewer are assigned responsibilities, not privileges inferred from a product name. An assignment does not create a new grant or an execution method; Claude bindings remain in `.claude/rules.md`. This contract introduces no standing Codex implementation workflow.

## 3. Codex gate

- Codex reviews high-risk work (section 2), every migration before it is applied, and anything the Owner asks for. The assigned Codex reviewer is read-only; Main runs it and decides what to do with its findings.
- Small fixes during Owner QA (copy, layout, styling) get no automatic Codex round; one the Owner explicitly asks for still runs.
- How to run Codex, resume a review and write its brief: [codex-brief.md](.claude/skills/code-review/references/codex-brief.md).

## 4. Permissions

Each of these is a separate grant from the Owner; one never implies another, and a grant for one task does not carry to the next:

- commit, push, PR creation or update, merge, branch deletion. A PR creation or update grant also covers writing that PR's CI result into its body (`git-pr-workflow`, `pr-and-ci.md`), and nothing else;
- applying a migration is two grants, *prepare* (the dry run) and *apply*, in the order `supabase-migration` ("Hosted apply") gives; any other write to the hosted database is a grant of its own;
- restoring a hosted backup into the scratch stack: Main runs `npm run backup:check` and, for one named backup, reads hosted counts and metadata only (`count(*)` of tables, the migration list and the hosted service versions, no rows), after checking that the linked project ref is `lkvxxrxojjlkchzzqidu`. The Owner takes the backup (the dump and the Storage download) themself in their own terminal; no agent runs those steps;
- CI fixing that needs a push; the grant covers only the edit, validate, commit and push actions the Owner named;
- anything the Owner has not asked for in words.

Standing limits:

- Agents follow the repository's review, CI and delivery workflow with its separate grants. Direct deployment, redeployment, promotion or rollback outside that workflow, through CLI, MCP, API or UI, requires an explicit Owner instruction naming the action and target. An authorized push or merge may trigger the existing GitHub/Vercel automatic deployment; it does not authorize an extra deployment command. Tool availability and workflow documentation grant no push, merge or deployment authority.
- Implementors never push, open or update a PR, or merge, even to fix CI (a CI self-fix push is Main-only and needs an Owner grant for CI fixing), and never call the Supabase MCP. Main hands them database metadata as a snapshot in the brief. They may work on the local dev and test databases only through an Owner-approved plan or a direct Owner assignment, which names the database, the kind of operation and the scope; otherwise Main handles database requests. The test commands above, `npm run test:stack:stop` and `npx supabase status` need no such assignment. A reset or bulk delete on the dev database needs the Owner's request, and before any write or reset the connection's real target is verified, not only its port. They may also create a new migration file locally with `npx supabase migration new <name>` (which writes only under `supabase/migrations/`) and write its rollback by hand. They run nothing that reaches hosted: `link`, `db push`, `db pull`, `migration repair`, `--linked`, or `--db-url` to a hosted host. Hosted access stays Main-only. The checkout is permanently linked to hosted, so any `supabase` command outside the local commands above may reach production.
- Main may work on the local dev and test databases within an authorized task. A reset or bulk delete on the dev database needs the Owner's request. Before any write or reset, the connection's real target is verified, not only its port. None of this extends to hosted, which stays under the grants above.
- The API and Railway: the same direct-deployment boundary applies, and committing `Dockerfile.api` deploys nothing. The Owner sets every Railway variable and runs the first deploy. An implementor runs no `railway` command. Main uses the Railway CLI only for the read-only operations an approved plan grants, and reads or prints no secret value. Creating or altering the hosted `devspace_api` role or its password is a hosted database write under the grants above.
- Nobody reads or prints `.env*`, and no secret goes into a command, doc or message.
- The VocaSpace project is off limits.
- Agents enter no password, with one exception: the seed users' password from `supabase/seed.sql`, typed into the app served on `127.0.0.1` or `localhost` by `npm run dev` (dev stack) or the e2e server (test stack), after checking the page's origin. The Owner signs in everywhere else (production, Vercel, hosted Supabase, any third-party service), and agents never type the Owner's own passwords. The seed password is not repeated in chat or messages.
- A temporary hosted-database write (a test row, a changed setting) needs the Owner's approval first and is cleaned up afterwards.
- Main may run read-only catalog and metadata queries on the hosted project without asking (schema, policies, grants, constraints, function definitions, the migration list). Reading user data rows, and any write, needs the Owner's approval first.
- When permission is unclear, take the narrower action and report it.

## 5. Finding triage

Issues found while working or during Owner QA:

- **Related to the current task** (same contract, files or outcome; for example bad UX in a migration plus UI task): send back to that task's implementor as a correction.
- **Unrelated** (for example a `security definer` RPC still callable by anon during a UI-only task): do not fix it now. Record it with evidence and a suggested home in the owning program's `problems.md` (`docs/backlog/problems.md` when no open program owns it, `future-features.md` for feature ideas). Who fixes it is decided later by size and risk.
- State the classification to the Owner after every QA round, and fix only the related findings.

## 6. Asking decisions

- Ask decisions through the agent's supported native question interface, in Vietnamese: recommended option first and marked "(Recommended)", at most 4 questions per call, option descriptions that say exactly what happens. A decision that bundles several actions (for example commit, plan approval and an implementation grant) is one question per decision.
- Ask decisions that change the Spec before the plan is written or sent to review, not after. The grants after the review follow `planning` (Git and approval).
- A different native question-tool name is not a missing capability. If a required tool or approved execution method is genuinely unavailable, report it and the pending check; do not silently substitute a server launch, model dispatch or permission workaround.

## 7. Information ownership

Memory is not where rules live. Test every candidate memory in this order:

1. A shared working rule goes to this file, the lifecycle owner or the owning skill; a Claude-specific binding goes to `.claude/rules.md`. Example: "Codex runs read-only".
2. Program state goes to that program's own `progress.md`, `problems.md` or `future-features.md`. Example: the status of a unit or checkpoint.
3. A decision that spans programs goes to an ADR. Example: the order of the three roadmap steps.
4. Work no open program owns goes to `docs/backlog/`. Example: a UI bug on a screen that no program owns.
5. Memory keeps only facts about the Owner and state that no doc reflects yet. Example: a step outside the repo, or a doc that lags reality.

A memory fact expires once the owning doc has caught up; storage operations follow the agent environment's authorized bindings. A new durable rule goes to its owner as a separate `chore(agent-rules): ...` commit; until then it sits in memory marked "pending move".

## 8. Changing skills

- A new skill, or one that widens a permission, needs the Owner's decision.
- No skill can widen section 4.
- The procedure for creating, changing and maintaining skills is owned by the `skill-authoring` skill.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
