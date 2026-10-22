# U2 detail plan — Local database and seed

Revision: r2, 2026-10-23 (r2 fixes the Codex round 1 findings: AC5 file list, AC2 privilege and RLS coverage, baseline gate order, `git-pr-workflow` scope, G1 Owner exception, no skipped reset in CI, clean CP1 build, throwaway derivation, CLI flag and cleanup checks; round 2: the throwaway stack runs the pinned CLI from the checkout with `--workdir`). Owner approval: 2026-10-23 (r2). Master plan: [plan.md](../../plan.md) (unit U2, decisions D2, D3, D6, D7 and D9; rollout order step 3).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the repo holds a schema baseline ordered before the three published migrations, a pinned Supabase CLI, a local config and a minimal invented seed. `npx supabase db reset` rebuilds the hosted schema plus the seed on the Owner's machine and in a blocking CI job `db`, with no hosted credential. Agents may run the local stack, and only the local stack. After merge, hosted migration history knows the baseline and `main` requires the `db` check.

| ID | Observable result |
| --- | --- |
| AC1 | On the Owner's machine with Docker Desktop running, `npx supabase start` and then `npx supabase db reset` both exit 0; the reset log applies the baseline first, then `20261021131351`, `20261021181051` and `20261021185249`, then `supabase/seed.sql`. |
| AC2 | After AC1, a catalog snapshot of the local database equals the hosted snapshot taken for this unit, object type by object type: public tables with columns, types, nullability and defaults; RLS enabled and forced flags per table; constraints; indexes; the `profile_cards` view definition, owner and `reloptions`; public function definitions, owners and `security definer` flags; triggers including `on_auth_user_created` on `auth.users`; policies in `public` and on `storage.objects`; table, column, view, sequence and function privileges for `anon`, `authenticated` and `service_role` (column privileges cover the H2-1b column grants); the default ACLs on schema `public`; owners of public tables; the `avatars` bucket row; the extensions the schema uses. Every remaining difference is listed in State as an accepted deviation with its reason, or is fixed in the baseline. |
| AC3 | After AC1, the local database holds exactly the seed: a learner `learner@devspace.test` (role `user`) and an admin `admin@devspace.test` (role `admin`) whose `profiles` rows were created by `on_auth_user_created`; one free course (price 0) and one paid course (price above 0), each with at least one chapter and two lessons. Both seed users get an access token from the local Auth endpoint (`http://127.0.0.1:54321/auth/v1/token?grant_type=password`) with the password written in `seed.sql`. No seed row comes from hosted. |
| AC4 | On every pull request to `main` and every push to `main`, the GitHub Actions job `db` starts the local stack with the pinned CLI and runs `db reset`; the job fails when either command fails, and a broken baseline, migration or seed makes the run fail. |
| AC5 | No published migration or rollback changed: `git diff 8f9ea0a -- supabase/migrations/20261021131351_h1_block_role_escalation.sql supabase/migrations/20261021181051_h2_1a_public_profile_view.sql supabase/migrations/20261021185249_h2_1b_restrict_reads.sql supabase/rollbacks/20261021131351_h1_block_role_escalation.down.sql supabase/rollbacks/20261021181051_h2_1a_public_profile_view.down.sql supabase/rollbacks/20261021185249_h2_1b_restrict_reads.down.sql` is empty. |
| AC6 | An agent reading `.claude/rules.md` section 4 learns that implementors may run the local stack (`npx supabase start`, `stop`, `status`, `db reset`, and `psql` against `127.0.0.1:54322`) and nothing that reaches hosted (`link`, `db push`, `db pull`, `migration repair`, `--linked`, `--db-url` to a hosted host, the Supabase MCP). `supabase-migration` names `db reset` plus the catalog diff as the local verification and no longer says there is no local database; `CLAUDE.md` Commands and `git-pr-workflow` (`SKILL.md` short form, `references/pr-and-ci.md` Watch CI and Merge) list the `db` job as blocking and say that requiring it on `main` is an Owner setting; `CLAUDE.md` Commands also lists the local database commands; no file under `.claude/` or `CLAUDE.md` still says there is no local database or no seed. |
| AC7 | After merge and the runbook steps (section 5): the hosted migration list shows the baseline version as applied before the three published versions, and `gh api repos/khangnhoang/DevSpace/branches/main/protection` lists `db` beside `typecheck`, `build` and `docs`. |

### 1.2 Scope and non-goals

- In scope (implementor): the `supabase` devDependency and lockfile entry; `supabase/config.toml` and the CLI's own `supabase/.gitignore`; the baseline migration and its rollback, built from the file Main hands over; `supabase/seed.sql`; the `db` job in `.github/workflows/ci.yml`; `.gitignore` for the dump folder; `.claude/rules.md` section 4; `supabase-migration` `SKILL.md` and `references/rpc-trigger-concurrency.md`; `planning` `references/qa-matrix.md`; `git-pr-workflow` `SKILL.md` and `references/pr-and-ci.md`; the `CLAUDE.md` Commands section.
- In scope (Main): the hosted catalog snapshot, the derivation of the pre-H1 schema in a local database, every `db reset` and catalog diff before merge, the state records (`progress.md`, FEAT-003 and FEAT-004 status).
- In scope (Owner, outside the repo): the schema-only dump, `migration repair` on hosted, adding `db` to the required checks.
- Non-goals: any test runner or test (U3, U4); running the app against the local stack, local `.env` files or an env example; seed content beyond AC3; Storage objects or files; fixing any security-hotfix problem; changing product code; the lint job; Supabase branching or preview databases; any `db push` to hosted.

### 1.3 Execution guardrails

Only guardrails whose omission causes a concrete failure.

| Guardrail | Failure if omitted |
| --- | --- |
| G1. No committed file holds a hosted connection string, password, access token or service key; `config.toml` `project_id` is a local name, not `lkvxxrxojjlkchzzqidu`; CI, repo scripts and any implementor never run `supabase link`, `db push`, `db pull`, `migration repair`, `--linked` or `--db-url`. The only exception is the Owner running the dump and the repair in the runbook (section 5), the repair with its own grant; `db push` to hosted is not run by anyone in this unit. | A secret leaks, or a CI or agent command writes to production (shared invariants 1 and 3). |
| G2. The CLI is the exact devDependency `supabase@2.121.0` (no range) and is run as `npx supabase`; CI installs it with `npm ci` and uses no third-party action. | Local and CI run different CLI versions, or a third-party action runs in CI. |
| G3. `config.toml` sets `[db] major_version = 17`. | The local schema replays on a Postgres major that differs from hosted 17.6. |
| G4. The three published migrations and rollbacks stay byte-identical (AC5); a replay gap is fixed in the baseline only. | Hosted history and repo diverge (shared invariant 5). |
| G5. The baseline is the pre-H1 schema: it does not contain the H1 trigger `prevent_role_escalation`, the view `profile_cards` or the H2-1 restricted grants and policies; its file name sorts before `20261021131351`. | The published migrations fail on replay or end in a different state. |
| G6. The baseline adds by hand what a `public` dump misses: `on_auth_user_created` on `auth.users`, the `avatars` bucket row and the three `storage.objects` policies, each copied from the hosted snapshot. | Local lacks the signup trigger or storage rules, and later RLS tests pass against the wrong schema. |
| G7. The baseline rollback does not drop anything: it raises an exception that says the baseline cannot be rolled back. | Someone runs it on hosted and drops the production schema. |
| G8. Seed users use `.test` email addresses and passwords marked in a comment as local test values; seed content is invented (D6). | Real data, or a reusable real password, lands in the repo. |
| G9. The raw dump lives only in a gitignored folder and is never committed. | A current hosted schema with object names the Owner did not review is published, and it drifts from the reviewed baseline. |
| G10. After the dump, the repo is not linked to hosted (`supabase/.temp/project-ref` is absent). | A later `npx supabase db push` defaults to production before `migration repair` (master plan risk 3). |
| G11. The CI job id is exactly `db` with no `name:`, `timeout-minutes` at most 20, and it sits under the workflow's existing triggers, permissions and concurrency. | The required check never reports under its name, or a hung Docker pull burns Actions minutes. |
| G12. Until this PR merges, the implementor runs no database (`.claude/rules.md` section 4 as it stands on `main`); Main runs every `start`, `db reset` and catalog query. | The rule is broken before the change that relaxes it is approved. |

### 1.4 Owner decisions that bind this unit

- D2: the Owner runs the schema-only dump; Main reviews it; it becomes a baseline before `20261021131351`; `migration repair` on hosted is a separate grant.
- D3: Supabase local on Docker Desktop; the CLI is a pinned devDependency; CI runs the same stack.
- D6: seed data is invented, minimal, and grows with the tests.
- D7: CI uses no hosted secret; it uses the CLI's local keys.
- D9: rules, skills and `CLAUDE.md` change in this PR (FEAT-003 reset part, FEAT-004 U2 part).
- D13 (2026-10-23, new, binds this unit only): the U2 seed is two users (one learner, one admin) and two courses (one free, one paid) with chapters and lessons, as in AC3.
- D14 (2026-10-23, new, binds this unit only): the `db` job blocks from U2; after merge the Owner adds `db` to the required checks on `main`. U3 adds its tests after the reset in the same CI path.

## 2. Repository facts

Only facts that justify a Spec item or expose a conflict. Frozen after approval.

Baseline: `8f9ea0a`, checked 2026-10-23.

- `supabase/` holds only `migrations/` and `rollbacks/` with the three hotfix files each; there is no `config.toml`, no seed and no baseline — justifies AC1, AC3, G5.
- Hosted `list_migrations` returns exactly `20261021131351`, `20261021181051`, `20261021185249` — justifies AC7 and the baseline ordering in G5.
- Hosted catalog (read-only, 2026-10-23): 14 public tables, 1 public view (`profile_cards`), 4 public functions, 44 public policies and 3 on `storage`, triggers `comments.update_comments_updated_at`, `profiles.prevent_role_escalation` and `auth.users.on_auth_user_created`, one bucket `avatars` (public), no public enum types, extensions `plpgsql`, `pg_stat_statements`, `uuid-ossp`, `pgcrypto`, `supabase_vault`, `pg_graphql`; PostgreSQL 17.6 — justifies AC2, G3, G6.
- `courses` has `price integer` with a default and `instructor_id bigint` nullable; `lessons` needs `title`, `slug`, `course_id`; `chapters` needs `course_id`, `title`; `profiles.role` is `text` with a default — justifies AC3 and D13 without an instructor row.
- H1 (`20261021131351`) recreates `handle_new_user` and adds `prevent_role_escalation`; H2-1a adds `profile_cards`; H2-1b restricts reads — justifies G5 (the baseline must be the state before them).
- `.claude/rules.md:49` forbids implementors any database "until the infrastructure program provides a local database (FEAT-003)"; `supabase-migration` `SKILL.md:3` and `:21`, `rpc-trigger-concurrency.md:34` and `qa-matrix.md:5` say there is no local database or seed — justifies AC6.
- `.github/workflows/ci.yml` has four jobs, `permissions: contents: read`, per-ref concurrency and only GitHub-owned actions; `CLAUDE.md:13` says CI runs "with no database" — justifies AC4, G11, AC6.
- The Owner's machine runs Docker 29.9.2 (daemon up on 2026-10-23); `npm view supabase` reports `latest` 2.121.0; the Owner's `pg_dump` is PostgreSQL 18 client tools, so the dump goes through the CLI, not a local `pg_dump` — justifies G2 and the runbook.

## 3. Bounded implementation hypotheses

Each names what may change and which Spec or guardrail facts must stay true.

- `npx supabase init` generates `config.toml` and `supabase/.gitignore`; edits are limited to `project_id`, `major_version = 17` and turning off services nothing uses (Studio, Inbucket or Mailpit, Edge Runtime, analytics, image transformation) — may change if AC1 to AC4 and G1 to G3 hold.
- The baseline is `supabase/migrations/20261021000000_baseline.sql`, with the matching `supabase/rollbacks/20261021000000_baseline.down.sql` that only raises (G7). The header says where it came from (Owner dump of 2026-10-23, the three rollbacks applied locally in reverse, re-dumped by Main) and that hosted marks it applied through `migration repair` only — the timestamp and header may change if G5 and G7 hold.
- Main derives the pre-H1 schema in a throwaway folder outside the checkout, always calling the pinned CLI from the product checkout with `--workdir <throwaway folder>` (G2), never `npx` from inside that folder (its own `init`, an empty `migrations/`, no seed, a different `project_id` and ports so it cannot clash with the product stack): start it, load the dump, apply the three `.down.sql` files in reverse order, then `npx supabase db dump --local --workdir <throwaway folder>` to a scratch file; Main hands that file and a snapshot of the hand-added objects (G6) to the implementor, who places it and adds the G6 statements — may change if G4 to G6 and G12 hold.
- `seed.sql` inserts `auth.users` rows (with `crypt()` passwords) and the matching `auth.identities` rows, lets the trigger create the profiles, updates the admin's role, then inserts courses, chapters and lessons with explicit ids and resets their sequences — may change if AC3 and G8 hold.
- The `db` job: checkout, setup-node 24 with npm cache, `npm ci`, `npx supabase start` with the unused containers excluded, then `npx supabase db reset`. `supabase start` already applies migrations and seed on an empty database; the explicit reset is what developers run and is the step U3 extends. The job always runs both commands (AC4); only the excluded services may change.
- The catalog snapshot is one SQL query Main runs on hosted (Supabase MCP, read-only) and on local (`psql` against `127.0.0.1:54322`), sorted per object type, compared with `diff`. It stays in Main's scratchpad, not the repo — may change if AC2 holds.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 (Sonnet) | Pinned CLI, `config.toml`, gitignore entries (G1 to G3, G9). | `npm ci` then `npx supabase --version` prints 2.121.0; `npx supabase <cmd> --help` confirms every command and flag the runbook and CI use (`start -x`, `db reset`, `db dump --linked -f`, `db dump --local`, `link --project-ref`, `unlink`, `migration repair --status`, the global `--workdir`), and `npx supabase --workdir <scratch folder> --version` run from the checkout prints 2.121.0; `grep -n "major_version\|project_id" supabase/config.toml`; `grep -rn "lkvxxrxojjlkchzzqidu\|supabase.co" supabase/ .github/` finds nothing; `npx tsc --noEmit` exits 0; Main runs `npm ci` and `npm run build` in a clean `git archive` copy of the CP1 commit with no `.env*` file and only the three placeholders of the `build` job (exit 0); lint still 81 problems. |
| CP2 (Owner, then Main, then Sonnet, then Codex, then Main) | Dump taken, pre-H1 baseline derived and committed with its rollback (G4 to G7, G9, G10); Codex PASS on the complete baseline file, hand-added objects included, before any `db reset` in the product checkout applies it. | Owner runbook step 1; Main: `supabase/.temp/project-ref` absent, AC5 diff empty, the baseline contains none of the G5 objects (`grep -n "prevent_role_escalation\|profile_cards" ...baseline.sql` empty); after the Codex PASS, `db reset` exits 0 and the AC2 diff is reviewed. |
| CP3 (Sonnet, Main checks) | `seed.sql` per AC3 and G8. | Main: `db reset` exits 0; SQL counts of users, profiles by role, courses by price, chapters and lessons; both token requests return an access token; `grep -n "@" supabase/seed.sql` shows only `.test` addresses. |
| CP4 (Sonnet) | CI job `db` (AC4, G11) and the docs, `git-pr-workflow` included (AC6, G1). | `git diff --check`; `grep -n "secrets\.\|link\|db push\|--linked\|--db-url\|repair" .github/workflows/ci.yml` finds nothing; `npm run docs:check` and `npm run docs:check:test` pass; `grep -rn "no local database\|no seed\|no database" CLAUDE.md .claude` shows no stale claim. |
| CP5 (Main, on the PR) | AC1 to AC6 observed; Codex diff gate PASS; state records updated. | `gh pr checks <n>` shows `typecheck`, `build`, `docs`, `lint`, `db` and Vercel; the `db` job log shows the four migrations and the seed applied; Main reruns `db reset` and the AC2 diff on the PR head; `npm run docs:check`. |
| CP6 (after merge) | AC7. | Owner runbook steps 3 and 4; Main: `list_migrations` shows four versions with the baseline first; `gh api .../branches/main/protection` lists `db`; the push run on `main` passed all five jobs. |

The implementor does CP1, its part of CP2, CP3 and CP4 as local commits and edits no state record. The Codex gate runs on this plan, on the complete baseline file inside CP2 before its first `db reset` (D2), and on the CP1 to CP4 diff before push. Commit, push, PR, merge, `migration repair` and the protection change are separate grants.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The dump misses objects outside `public`, so local differs from hosted. | G6 and AC2: per-type diff against the hosted snapshot; a gap goes into the baseline by hand. |
| A rollback is incomplete, so the derived baseline still holds part of H1 or H2-1 and the replay fails or ends elsewhere. | AC1 and AC2 test the end state; G5 greps for the H1 and H2-1 objects; a gap is fixed in the baseline, never in a published file. |
| The `supabase` devDependency's install script downloads the CLI binary in every `npm ci`, including the other four CI jobs and the Vercel build, adding time or failing on a network error. | CP1 runs `npm run build` after `npm ci`; CP5 checks the Vercel preview and the job durations; a failing download is a CI failure handled under Loop 3, never by unpinning. |
| Docker pulls make the `db` job slow or flaky. | Unused containers excluded; G11 timeout; durations recorded in State at CP5. |
| GoTrue rejects seed users inserted directly into `auth.users` (missing identity row or token columns). | CP3 checks sign-in through the Auth endpoint, not only the rows. |
| The hosted dump needs the database password, which agents never handle. | The Owner runs it in their own terminal (runbook step 1); the password is typed into the CLI prompt, not into a command or file. |
| A later `db push` to hosted before `migration repair` would try to apply the baseline to production. | G1 and G10; the rules text forbids `db push` to agents; repair is runbook step 3. |

- Rollout runbook (Owner or hosted steps, in order):
  1. Owner, after CP1 is committed and Docker is running, in a terminal at the repo root: `npx supabase login`, `npx supabase link --project-ref lkvxxrxojjlkchzzqidu` (type the database password at the prompt), `npx supabase db dump --linked -f supabase/dumps/hosted-schema.sql`, then `npx supabase unlink`. If any command fails, the Owner still runs `npx supabase unlink` before anything else. Main then confirms the file exists and G10.
  2. Owner merges the U2 PR after CP5 and the reviews; the push run on `main` runs all five jobs.
  3. Owner, with the separate hosted-write grant: `npx supabase migration repair 20261021000000 --status applied` against hosted (link, repair, then unlink, as in step 1), then Main checks `list_migrations` read-only.
  4. Owner adds `db` to the required status checks of the `main` protection rule (enforce for administrators stays on); Main checks it read-only.
- Stop when: the dump or the derivation needs a hosted write; the replay needs a change to a published file; AC2 leaves a difference that is not explainable as Supabase-managed; seed sign-in needs a hosted service or a real credential; the `db` job needs a secret or a third-party action; the CLI install breaks the Vercel build.
- Rollback: before repair, revert the U2 merge (the Owner first removes `db` from the required checks); hosted is untouched. After repair, also run `migration repair 20261021000000 --status reverted` on hosted with a grant; this changes only the history table, never the schema. The baseline rollback file is never run.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
