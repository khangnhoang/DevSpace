# DevSpace

DevSpace is an online programming LMS that the Owner built alone as a graduation project: Next.js 16 (App Router), React 19, Tailwind 4, Supabase (Auth, Postgres, Storage). Production: https://devspace-lms.vercel.app. Hosted Supabase project: `lkvxxrxojjlkchzzqidu`. GitHub: `khangnhoang/DevSpace`.

Roadmap, in this order: (1) agent-workflow (rules, skills, docs system), (2) infrastructure (tests, CI, an isolated local environment), (3) app foundation (shadcn, React Hook Form, Zod on client and server), (4) techstack migration (Next.js + NestJS + PostgreSQL). Do not modernize parts that the migration will replace (for example the Supabase auth helpers). See [ADR 0001](docs/adr/0001-modernization-roadmap.md) and [ADR 0003](docs/adr/0003-app-foundation-program.md).

## Commands

- `npm run dev` runs `next dev` at `http://127.0.0.1:3000` on the local stack and needs it started (see the local database below); it fails with a message when the stack is down and never reaches hosted. The AI key comes from the Owner's environment file. `npm run build`, `npm start`.
- `npm run lint`: it must report 0 problems, warnings included (`--max-warnings 0`).
- `npx tsc --noEmit`: type check.
- `npm run docs:check`: structure and link checks for `docs/`, `.claude/`, `CLAUDE.md`, `README.md`. `npm run docs:check:test` runs its tests.
- CI runs on every pull request to `main` and every push to `main`, with no hosted secret. The jobs, which of them block and how to read a failure: [pr-and-ci.md](.claude/skills/git-pr-workflow/references/pr-and-ci.md).
- Local database (Docker Desktop running): `npx supabase start`, `npx supabase db reset` (baseline, migrations, then the invented seed in `supabase/seed.sql`, which holds the users `learner@devspace.test`, `student@devspace.test` and `admin@devspace.test`), `npx supabase stop`. The checkout stays linked to hosted, so only these local commands are routine; hosted applies follow `supabase-migration` ("Hosted apply").
- `npm test` runs the Vitest `unit` and `rls` projects; `rls` needs the local stack started and `db reset` done. See [test-quality-strategy](.claude/skills/test-quality-strategy/SKILL.md).
- `npm run test:unit` runs the unit tests alone and needs no Docker.
- `npm run test:e2e` runs the Playwright smoke in Chromium: it needs the local stack started, `db reset` done and Chromium installed (`npx playwright install chromium`), and it overwrites `.next`, so run `npm run build` before `npm start` afterwards. See [test-quality-strategy](.claude/skills/test-quality-strategy/SKILL.md).

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
7. **Surface conflicts, do not average them.** Name the conflicting sources and apply documented precedence. If permission is still unclear, follow `AGENTS.md` section 4.
8. **Read before writing.** Inspect the target, nearby contracts and conventions (and the program's plan, progress and problems when they affect scope) before proposing a change.
9. **Tests verify observable behavior.** Assert the promised contract (inputs, outputs, permissions, persistence), not the implementation; the `test-quality-strategy` skill owns how. Say plainly which checks ran, failed, were skipped or were not possible.
10. **A finished implementation is a review checkpoint.** Report as `docs/agent-loops.md` Loop 1 (Report) says. Permissions for git, remote and database actions are owned by `AGENTS.md` section 4.
11. **Match conventions.** Follow the nearby naming, placement, error handling and doc structure, even if you would choose differently. Keep one owner and one source of truth per fact.
12. **Fail loud.** A blocked, failed, partial or unverified result stays visibly so. Report the exact failure and the smallest thing needed to resume. Do not hide it behind a mock, fallback or weaker check.
13. **Comment the why.** Comment why, a boundary or a hidden constraint (RLS and auth assumptions, migration order, concurrency, external service limits, a workaround), never what the code plainly says; prefer a clearer name or simpler flow, one comment for adjacent code that shares a rule, and no JSDoc on routine code. A TODO states the missing work, why it waits and where it is tracked, and is removed when the condition ends. Update comments that your change makes false; report misleading ones elsewhere instead of cleaning up silently.


## Working contract

Read `docs/agent-loops.md` before planning or acting, and read each applicable skill completely (Core engineering rules, rule 6; loops, Sizing). `.claude/skills/` is canonical; `.agents/skills/` exposes the same skills. This file owns shared policy and project context; loops own lifecycle, skills own procedures, and `.claude/rules.md` owns Claude-specific bindings. Source references here are not automatic imports in another agent.

## 1. Owner and language

- The Owner built DevSpace alone and decides scope, risk and permissions.
- Chat replies, native question-box questions and options, and wrap-up recaps and buttons are in Vietnamese, in natural wording. Keep code identifiers, paths, commands and exact errors as they are.
- Code, code comments, commits, PRs, skills, rules and every repo doc are in English. UI copy keeps the product's Vietnamese.
- Reports from an implementor or Codex to Main are in English.
- The Owner's current instruction about language wins over this section.

## 2. Roles

- **Small-task flow.** Main implements directly only for a small task as `docs/agent-loops.md` (Sizing) defines it. Otherwise use the planned flow.
- **Program state records.** While an implementor is active on an approved plan, Main edits nothing in the checkout, state records included, and sends every change, an Owner-requested state fix included, to that implementor (an implementor once committed Main's uncommitted diff with its own). An implementor is active only while its session is running a turn; an open, idle session is not active. The implementor updates State in its checkpoint commits (`program-docs`, State has one owner). When no implementor is active, Main edits state records directly: `progress.md`, `problems.md` and `future-features.md` entries, including those in `docs/backlog/`. Before Main sends another message to an idle implementor, Main's state edits are committed; without a commit grant, Main asks the Owner instead of sending the message. No implementor, no review round and no Codex round, even where a plan gates every change after its last review. Main runs `npm run docs:check` afterwards. This does not cover plans, rules, skills or code, and commit and push stay separate grants (section 4).
- **Planned flow.** Main plans, self-reviews the plan, and reviews every diff. One assigned implementor implements the approved plan in the product checkout on the current task branch unless the plan says otherwise. It makes local commits only, loads `git-pr-workflow` before staging or committing (including handoff-granted checkpoint commits), and `code-review` for every self-review. When its turn ends, Main reads the full report and checks the real diff and commits; corrections go to the same implementor until review passes, then Main reports to the Owner. Concrete Claude role/model/session bindings are in `.claude/rules.md` section 2.
- Large or high-risk work (auth, payment or coupon, admin permissions, schema or migration, data deletion, CI or deploy, the backend migration) adds the Codex gate on the plan and on the implementation diff.

Main, implementor and reviewer are assigned responsibilities, not privileges inferred from a product name. An assignment does not create a new grant or an execution method; Claude bindings remain in `.claude/rules.md`. This contract introduces no standing Codex implementation workflow.

## 3. Codex gate

- Codex reviews high-risk work (section 2), every migration before it is applied, and anything the Owner asks for. The assigned Codex reviewer is read-only; Main runs it and decides what to do with its findings.
- Small fixes during Owner QA (copy, layout, styling) get no Codex round.
- How to run Codex, resume a review and write its brief: [codex-brief.md](.claude/skills/code-review/references/codex-brief.md).

## 4. Permissions

Each of these is a separate grant from the Owner; one never implies another, and a grant for one task does not carry to the next:

- commit, push, PR creation or update, merge, branch deletion. A PR creation or update grant also covers writing that PR's CI result into its body (`git-pr-workflow`, `pr-and-ci.md`), and nothing else;
- applying a migration is two grants, *prepare* (the dry run) and *apply*, in the order `supabase-migration` ("Hosted apply") gives; any other write to the hosted database is a grant of its own;
- CI fixing that needs a push; the grant covers only the edit, validate, commit and push actions the Owner named;
- anything the Owner has not asked for in words.

Standing limits:

- Implementors never push, open or update a PR, or merge, even to fix CI (a CI self-fix push is Main-only and needs an Owner grant for CI fixing), and never call the Supabase MCP. Main hands them database metadata as a snapshot in the brief. They may run the local stack only: `npx supabase start`, `stop`, `status`, `db reset`, and `psql` against `127.0.0.1:54322`. They may also create a new migration file locally with `npx supabase migration new <name>` (which writes only under `supabase/migrations/`) and write its rollback by hand. They run nothing that reaches hosted: `link`, `db push`, `db pull`, `migration repair`, `--linked`, or `--db-url` to a hosted host. Hosted access stays Main-only. The checkout is permanently linked to hosted, so any `supabase` command outside the local commands above may reach production.
- Nobody reads or prints `.env*`, and no secret goes into a command, doc or message.
- The VocaSpace project is off limits. The Owner signs in to the app; agents do not enter passwords.
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

1. A working rule goes to this file, the lifecycle owner or the owning skill. Example: "Codex runs read-only".
2. Program state goes to that program's own `progress.md`, `problems.md` or `future-features.md`. Example: the status of H2-2.
3. A decision that spans programs goes to an ADR. Example: the order of the three roadmap steps.
4. Work no open program owns goes to `docs/backlog/`. Example: a UI bug such as BL-004 (the quiz completion screen).
5. Memory keeps only facts about the Owner and state that no doc reflects yet. Example: a step outside the repo, or a doc that lags reality.

A memory fact expires once the owning doc has caught up; storage operations follow the agent environment's authorized bindings. A new durable rule goes to its owner as a separate `chore(agent-rules): ...` commit; until then it sits in memory marked "pending move".

## 8. Changing skills

- A new skill, or one that widens a permission, needs the Owner's decision.
- No skill can widen section 4.
- The procedure for creating, changing and maintaining skills is owned by the `skill-authoring` skill.
