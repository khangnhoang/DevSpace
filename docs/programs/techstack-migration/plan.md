# Master plan — techstack-migration

Progress: [progress.md](progress.md). Problems: [problems.md](problems.md). Future features: [future-features.md](future-features.md). Each unit has a detail plan at `implementation-plans/tm-u<n>-<slug>/plan.md`, written when the unit opens; follow-up work from `problems.md` or `future-features.md` may have an entry plan at `implementation-plans/<id>-<slug>/plan.md` with no Units row. Roadmap: [ADR 0001](../../adr/0001-modernization-roadmap.md), step 4.

## 1. Goal and outcome

- Goal: DevSpace's data operations run through a NestJS API that reads and writes the Supabase PostgreSQL with Drizzle, reached domain by domain so that production works after every merge. Supabase stays the database host and the provider of Auth and Storage.
- Outcome 1: the browser and the Next.js server no longer read or write application data through Supabase; every such read and write goes through a NestJS endpoint that authenticates the caller, checks permission on the server and validates input with the shared Zod schemas. File uploads and the Auth calls are the two exceptions (Outcome 2).
- Outcome 2: sign-up, sign-in, sign-out, email verification and password reset stay on Supabase Auth, and NestJS checks that session (ADR 0008 D6). Avatars and course images are still uploaded from the browser straight to Supabase Storage.
- Outcome 3: the Data API access that a moved operation needed is closed for its actor, and schema changes stay SQL migrations under `supabase/migrations` with the Drizzle schema generated from them.
- Outcome 4: every entry this program owns (`problems.md`, `future-features.md`) is resolved by the unit that owns it; an entry no unit owns moves to `docs/backlog/` at program close or is dropped by the Owner.
- Outcome 5: a backup of the production database and files exists before every hosted write step of this program, and has been restored once into a scratch database and checked.
- Size and risk: large and high-risk: it replaces the data access layer, permissions and payment code paths (`AGENTS.md` sections 2 and 3).

## 2. Owner decisions

1. (2026-11-08) Target stack: Next.js frontend, NestJS backend, PostgreSQL and Drizzle ORM. The Better Auth part of this decision is withdrawn by decision 9.
2. (2026-11-08) The migration is incremental, domain by domain, with NestJS beside the current app on the same database. The auth cutover and the removal of Supabase are withdrawn by decision 9.
3. (2026-11-08) All production data and accounts are kept. Decision 9 makes the copy of ids and password hashes unnecessary: accounts stay in Supabase Auth.
4. (2026-11-08) Where PostgreSQL, NestJS and files are hosted, and the toolchain (repository layout, test layers, deploy), are decided in TM-U2 as an ADR the Owner approves before backend code is written; the Supabase Postgres may serve as plain PostgreSQL during the transition. Decision 9 keeps it, and Supabase Storage, for good.
5. (2026-11-08) Folded into this program: the security-engineering entries deferred to the migration (SE-P13 to SE-P22, SE-F2, SE-F3) and SE-F1; backlog BL-P5, BL-P12, BL-P20 and BL-F11; quality-engineering QE-F4; agent-workflow AW-F5. They are TM-P1 to TM-P13 and TM-F1 to TM-F6 here.
6. (2026-11-08) BL-F9 (DeepSeek) is dropped: the Gemini key works on local and production; the AI quiz action moves to NestJS on Gemini.
7. (2026-11-08) This master plan and every unit plan and implementation pass the Codex gate. Replaced by decision 11 for the work after TM-U3.
8. (2026-11-07) The program includes a backup and restore-test step and the toolchain choice.
9. (2026-11-09) The program ends when the operations of TM-U4 to TM-U8 run on NestJS. The Owner's goal is to learn how a backend framework is built and organized, and removing Supabase serves operations more than that goal. TM-U9 (Better Auth), TM-U10 (R2), TM-U11 (database move and Supabase removal) and TM-U12 (schema review) are dropped, and their numbers stay reserved.
10. (2026-11-09) Avatar and course-image uploads stay straight from the browser to Supabase Storage. No upload moves behind the Vercel rewrite, so TM-P17 and the ADR 0008 D5 upload gate block no unit.
11. (2026-11-09) Codex reviews the implementation diff of work that touches a migration, payment, permissions or the session, and its Required findings are corrected and re-checked. Public reads use a short plan and Main's review. This revision of the master plan had Main's self-review only.
12. (2026-11-09) The TM-U4 gate compares the p95 time until the page's data is visible, before and after the move, because the home page renders its data in the browser today and its HTML time is not comparable. The limit stays at most 200 ms more. If it is exceeded, caching the public data is tried first, then the Owner decides under ADR 0008 D11.
13. (2026-11-09) Each unit is sized by its scope and risk when its detail plan opens, and is split only for a reason that sizing names. TM-U3 took on too much at once; the remedy is sizing, not smaller units by default.
14. (2026-11-09) Agents implement the units; the Owner reads each unit's request flow afterwards.

## 3. Shared invariants

- Production works after every merge: each unit ships alone, and a unit never leaves a screen that depends on code a later unit writes — prevents a broken production between units.
- An operation moves whole: the unit of a move is an operation and its actor (for example "an enrolled learner reads a lesson's exercises", "an admin edits a course"). When a unit moves an operation to NestJS, every call site of that operation in `app/`, `lib/` and `components/` uses the API in the same PR, and the detail plan lists the operations on the same tables that stay on Supabase until a named later unit — prevents two write paths with different rules and an untracked leftover.
- The old door closes with the move: once a moved operation is live on the API, direct Data API access that only that operation needed is revoked or narrowed for its actor (grant or RLS) in a compatible later step of the same unit, keeping what unmoved operations still need, and a test proves the old endpoint now refuses it (for TM-P7, an enrolled learner can no longer select `exercises.correct_answer` through PostgREST while the admin editor keeps its access). Data that is public by design has no door to close — prevents a client bypassing the new server rule through the old path.
- Authorization lives on the server: each endpoint authenticates the session and checks role and ownership itself, never trusts a client id, price or role, and validates its body with a schema from `lib/schemas` (the `server-actions` rules apply to every endpoint) — prevents the browser deciding what it may do once RLS no longer guards a path.
- An access guarantee that an `rls` test proves today is proven again by an API-level test before the path it covers stops being the enforcement — prevents losing a security guarantee silently in the move.
- One migration owner: schema changes are SQL files in `supabase/migrations` with a rollback in `supabase/rollbacks` under `supabase-migration`, and the Drizzle schema is generated from the database and never used to migrate — prevents two tools writing conflicting histories.
- Before every hosted write step (migration apply, data copy) a fresh backup exists and the TM-U1 restore check passed on it — prevents an unrecoverable production loss.
- Backups hold personal data and password hashes: they never enter the repository, a chat, a CI artifact or a log, and they live only where the Owner chooses — prevents a credential and privacy leak.
- No secret in code, docs or commands; new keys are set by the Owner in the hosting settings (`AGENTS.md` section 4) — prevents leaked credentials.
- Behavior and look stay the same unless an entry this program owns changes them; visual redesign stays with `ui-ux` — prevents scope creep in a high-risk program.
- A change that makes an instruction false (`AGENTS.md`, a skill, `.claude/rules.md`, CI) updates it in the same PR under `skill-authoring`; a new skill or a widened permission waits for the Owner — prevents agents following rules for a stack that no longer exists.

## 4. Units

| Unit | Branch | Outcome | Dependencies | Gate to start or enable |
| --- | --- | --- | --- | --- |
| TM-U1 Guardrails and backup drill | `chore/tm-u1-guardrails-backup` | Outcome 5: a written, repeatable backup of the hosted database (roles, schema, data with the `auth` schema) and Storage objects, restored once into a scratch local PostgreSQL and checked; TM-F6 (a hook for hosted database commands) dropped by the Owner (TM-U1 detail plan, Owner decision 13) | none | Codex gate on the plan and the implementation; Owner grant for the hosted read that the backup is |
| TM-U2 Architecture ADR | `docs/tm-u2-architecture-adr` | ADR 0008 accepted: hosts for NestJS, PostgreSQL and files; repository layout; browser-to-API origin and cookie topology; how NestJS verifies a Supabase session; authorization model (server checks, with or without RLS as a second layer); realtime replacement; Drizzle use; API test layers, CI and deploy; cost limits. Spikes stay out of `main` | TM-U1 merged | Codex gate on the ADR; Owner acceptance of the ADR |
| TM-U3 Backend foundation | `feat/tm-u3-backend-foundation` | A NestJS app in the ADR layout, deployed, with a health endpoint, the Drizzle schema generated from the database, a session guard that accepts the current Supabase session, a validation pipe on the shared Zod schemas, API tests on the test stack, CI jobs, and `npm run dev` starting the frontend and the API on the dev stack; no screen changes | TM-U2 accepted | Codex gate; Owner instruction for the first deploy of the new service and its settings |
| TM-U4 Public content and Try It | `feat/tm-u4-public-content` | Public reads of courses, chapters, lesson outlines, instructors and reviews, and the Header search, through the API (writes on these tables stay until TM-U6 and TM-U8); TM-P1 for these reads, TM-P13 (search with literal text), TM-P11 (a C++ runner the detail plan chooses, or the tab removed by the Owner) | TM-U3 merged | Codex on its grant migration (decision 11); Owner choice of the C++ runner in the detail plan; its first slice reads the home page through the server helper and is measured on production under decision 12 |
| TM-U5 Learner data | `feat/tm-u5-learner-data` | The course-access check and protected lesson reads (content, video, exercises) for enrolled learners, enrollment of free courses, lesson progress, notes, own profile (the avatar file itself stays on the direct upload of decision 10), quiz with server grading and stored results, and the sidebar progress update through the API; TM-P6, TM-P7 (with the old exercise read closed for learners), the rest of TM-P1 | TM-U4 merged | Codex (decision 11); before its first session route reaches production, TM-U3's P3, P4, T5 and M2 pass on real routes (ADR 0008 Consequences) |
| TM-U6 Community | `feat/tm-u6-community` | Comments (soft delete kept), reviews and notifications through the API; the notification items of TM-F4 that do not need new tables | TM-U5 merged | Codex where decision 11 applies |
| TM-U7 Payments and mail | `feat/tm-u7-payments-mail` | Orders, coupons, approval and rejection through the API on the existing database payment functions and their reservation invariant; the activation mail sent by a NestJS mail module with a configurable transport; TM-F5 (mail asserted through local Mailpit) | TM-U6 merged | Codex (decision 11) |
| TM-U8 Admin | `feat/tm-u8-admin` | Admin users, courses, chapters, lessons with the Gemini quiz generation, transactions and the dashboard through the API (course-image files stay on the direct upload of decision 10); TM-P9 (rule chosen by the Owner), TM-P10, TM-F2, TM-F3 (on Supabase Auth), TM-P12 (slug rule and a unique course slug, Codex-gated migration) | TM-U7 merged | Codex (decision 11); Owner decision for TM-P9 in the detail plan; hosted read of slugs for TM-P12; the real Gemini call passes on the production topology before the merge that moves it (ADR 0008, decision 23) |

TM-U4 to TM-U8 run in the order above, one writer at a time; the Owner may reorder them when the dependency column still holds.

## 5. Order and rollout gates

1. Program opening (this plan, docs only): Codex gate, Owner approval, then commit and PR under their own grants. Nothing reaches hosted.
2. TM-U1: the backup runbook and `backup:check` merge; the first backup is taken and restored into a scratch local PostgreSQL with the Owner's hosted-read grant, and the check result is recorded in State without any data.
3. TM-U2: the ADR is accepted before any backend code.
4. TM-U3: the NestJS service is deployed to its host under the Owner's deploy instruction and its health endpoint answers through the production frontend's origin before any domain moves; no screen uses it yet, so production behavior is unchanged.
5. TM-U4 to TM-U8, each in this order, every hosted step after a backup (`supabase-migration`, Hosted apply): an additive migration the new code needs is applied before that code merges; the backend endpoints are deployed and answer on production before the frontend that calls them; the frontend merges and deploys and the Owner smoke-checks the moved operations; only then the restrictive migration that closes the old door is applied, and its old-endpoint refusal is checked on production. A unit with no door to close has no restrictive step. A guard migration runs at the boundary its detail plan names and Codex reviewed.
6. Program close: State says completed, open entries resolved, moved to the backlog or dropped, the dependency check, a backlog review with the Owner, and the row set to `closed`.

## 6. Program risks

| Risk | Mitigation |
| --- | --- |
| Latency between the Vercel frontend, the API and the database in Sydney makes pages slow | TM-U3 measured the ADR's budget on production and it failed on the Vercel rewrite; ADR 0008 D11 records the breakdown; server-rendered reads use the helper, which does not cross the rewrite, and TM-U4 measures under decision 12 |
| Two systems hold the rules (RLS for unmoved paths, NestJS for moved ones) | An operation moves whole and its old door closes in the same unit; RLS keeps guarding the unmoved operations; each detail plan lists the operations still on Supabase |
| Supabase stays a permanent dependency: the Free project can pause after low activity, and each uncached API request pays a call to Supabase Auth | The uptime monitors of TM-U3 alert the Owner; ADR 0008 D2 and D6 hold the recovery and the options |
| The program is long for a solo graduation project and may stop midway | Every unit leaves production working on a mixed stack; the Owner may pause after any unit, and State records where |
| A hosted step corrupts data or locks users out | Backup and restore check before each hosted write; additive migrations first, removals after QA |
| Hosting costs or free-tier limits | The ADR states the plan, limits and monthly cost, and the Owner accepts them |

## 7. Out of scope

- Better Auth, a file store other than Supabase Storage, a database move and the removal of Supabase (decision 9).
- Moving uploads behind the API (decision 10).
- The TM-F4 schema-review items that TM-U6 and TM-U8 do not take (they go to the backlog at program close).
- Visual redesign and new features beyond the entries this program owns; the learner notification bell and reply notifications in TM-F4 stay out unless the Owner adds them.
- DeepSeek or another AI provider (Owner decision 6).
- Dependency majors unrelated to the stack change (`typescript` 7, `eslint` 10, `lucide-react` 1, `recharts`): `dependency-maintenance` DM-F2.
- Social sign-in, two-factor auth and new auth methods.
- Mobile apps and a public API for third parties.
