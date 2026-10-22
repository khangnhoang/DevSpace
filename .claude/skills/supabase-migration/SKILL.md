---
name: supabase-migration
description: "Workflow for DevSpace Supabase/PostgreSQL changes: migrations and rollbacks, RLS, grants, views, RPC, triggers, Storage policies, rollout order, hosted-database safety and verification on the local Supabase stack. Use before writing, reviewing or relying on database behavior, and before any hosted database step."
---

# Supabase migration

## Use when / do not use when

Use when a task touches tables, columns, constraints, indexes, migrations or rollbacks, RLS policies, grants, views, RPC functions, triggers, SQL helpers, Storage policies, or code that relies on database behavior.

Do not use for UI work with no database dependency. For server action contracts use `server-actions`; for ordering and PR split use `planning`.

Database behavior is changed by a migration file, never by dashboard SQL left as the final state. This is a high-risk area: the plan is Codex-gated and so is every migration before it is applied (`.claude/rules.md` section 3).

## Hard rules

- Files: `supabase/migrations/<timestamp>_<name>.sql` and `supabase/rollbacks/<same-name>.down.sql`. Every migration has a `.down.sql`.
- A new migration must replay through `npx supabase db reset` after the baseline and the earlier migrations; the CI `db` job fails otherwise.
- Never edit a published migration. A fix is a new migration. A migration that was applied under a different version is renamed to the recorded version in a separate PR (see the H2-1 history).
- Implementors never call the Supabase MCP, never touch the hosted database and never apply or "repair" anything; they never run `link`, `--linked` or `db push`. Main hands them a metadata snapshot (policies, grants, constraints, function definitions) in the brief and applies migrations only through "Hosted apply" below, after Codex PASS and the Owner's grants.
- Local verification is `npx supabase db reset` on the local stack (baseline, published migrations, minimal invented seed); the implementor may run it (`.claude/rules.md` section 4), and for a schema-shaping change Main also compares the local catalog with hosted. The implementor writes the SQL, the rollback and a verification plan from the snapshot, and never touches hosted to compensate. Main runs the preflight and postflight checks on hosted; checks not yet run stay `pending` in the report. Automated RLS tests are deferred to U3 (`docs/programs/infrastructure/`). The baseline was recorded in hosted history once, through `migration repair` by the Owner; later migrations go through "Hosted apply".
- Do not weaken RLS or a constraint to make code work. Do not trust client-sent owner, role, status, price or counter fields. Do not change unrelated objects.
- Do not change Supabase-managed schemas (`auth`, `storage`, `realtime`, `cron` and similar) unless the scope names it. Touching the `handle_new_user` provisioning trigger is a stop unless the task is specifically about provisioning.
- Put the migration in one `begin; ... commit;` and keep locks short; no external call while holding a lock.

## DevSpace traps (learned in H1, H2-1 and U2)

1. **Policy recursion.** In the `profiles` SELECT policy, a scalar subquery `(select auth.uid())` combined with UPDATE and DELETE policies that subquery `profiles` raised `42P17 infinite recursion detected in policy`. Plain `auth.uid()` fixed it. Do not wrap `auth.uid()` in a subquery in a policy on a table that other policies also read.
2. **Default ACL on new objects.** The schema's default ACL grants write privileges on new views and functions. A simple view is auto-updatable and would write through to its table as the owner, bypassing RLS. Always `revoke all ... from public, anon, authenticated` first, then grant exactly what is needed. For a function: `revoke execute ... from public, anon, authenticated`, then grant to the intended role.
3. **Column revoke does nothing under a table grant.** If a table-level `SELECT` exists, `revoke select (col)` has no effect. Revoke the table-level privilege, then grant the allowed columns. The rollback must undo both in reverse (revoke the column grants before restoring the table grant).
4. **Policy names.** Drop an old policy by its exact name before creating its replacement; a missing drop leaves the old permissive policy, and permissive policies are OR-ed.
5. **Service role bypasses RLS.** Code using `lib/supabase.admin.ts` is not protected by any policy; the check must be in the action (`server-actions`).
6. **Line endings.** `.gitattributes` checks out SQL under `supabase/migrations` and `supabase/rollbacks` as LF. Do not add CRLF to those files or a new `-text` line; the baseline is the one `-text` file, which keeps hosted's CR bytes.
7. **The baseline is frozen.** `supabase/migrations/20261021000000_baseline.sql` is the pre-H1 schema derived from the Owner's hosted dump of 2026-10-23; the baseline plus the published migrations rebuild hosted. Never edit it: its guard aborts on a database that already has `public.profiles`, and hosted history marks it applied.

## Rollout order

Order follows compatibility between old code, new code and the migration:

- **Additive first.** Objects the new code needs (a view, a column, an RPC) go in a migration that old code ignores; apply it, then deploy the code.
- **Restriction after the code is live.** A migration that removes reads or access old code still uses (H2-1 B) is applied only after the new code is live in production, or the old code breaks.
- **Guard before the deploy.** A guard that blocks old writers (H2-2) is applied before the deploy that changes the writer, with a rollback that cannot strand in-flight state.
- The plan and the migration header both state the order. Say which step is the Owner's and which is Main's.

## Hosted apply

Main applies a repo migration to hosted with `npx supabase db push` from this checkout, which stays linked to hosted (`supabase/.temp/project-ref`, gitignored). Two Owner grants gate it, *prepare* and *apply*; no step text below grants anything (`.claude/rules.md` section 4).

1. **Precondition.** The migration and its rollback passed Codex, the PR's CI is green, and the rollout order says it is time. A merge to `main` deploys production, so an additive or guard migration is applied, and its postflight done, before the merge; a restriction is applied only after the merge and after Main confirms the compatible production deploy is live.
2. **Target.** `supabase/.temp/project-ref` must read `lkvxxrxojjlkchzzqidu` (`CLAUDE.md`). Missing or different: stop.
3. **Grant 1, prepare.** Ask the Owner, naming the project and the migration file(s). Then run `npx supabase db push --linked --dry-run`, and record the commit (`git rev-parse HEAD`, clean tree) and the versions it lists.
4. **Grant 2, apply.** Only if the dry run lists exactly the expected file(s), ask the Owner, naming the project, the commit and the version(s). Right before applying, re-check the project ref and a clean tree at the same commit, and run the dry run again; any difference stops the apply and the prepare step starts over. Then run `npx supabase db push --linked --yes`; `list_migrations` must show the new version under the file's name.
5. **Stop and report** when the dry run lists anything else or nothing, when the CLI asks for a database password, or on any error. The Owner then decides (for example runs the step themself).

The two grants cover only the dry run and the apply. Postflight on metadata uses Main's standing read-only catalog permission (`.claude/rules.md` section 4); a postflight that reads user data rows or writes a test row needs its own Owner approval first and stays `pending` until it has it.

Never `--include-all`, `--include-seed` (the seed holds invented users with known passwords) or `--include-roles`; never `--db-url`; never the MCP `apply_migration` for a repo migration. The MCP records its own version, so H2-1's hosted version differed from its file name until a rename PR, and it applies the SQL text it is given, which is how `lessons.word_count` was found stored differently on hosted than in the H2-1a file. `db push` applies the file itself under the file's version.

## Workflow

1. **Inspect first:** existing migrations, the snapshot of policies, grants, helpers (`is_admin()` and similar), triggers, RPCs, call sites in `app/action/*` and pages, and the plan's acceptance. Search for an existing helper or pattern before writing a new one. An index needs a concrete query pattern; check existing indexes for duplicates or overlap first. Surface conflicts before writing SQL.
2. **Write** the smallest migration for the approved behavior. Create the file with `npx supabase migration new <name>` (it creates an empty migration under the right timestamp) and the rollback by hand as `supabase/rollbacks/<same name>.down.sql`. Write it in an existing-data-safe order (nullable or default, backfill, validate, then `NOT NULL` / `UNIQUE` / `CHECK`). Add a short English comment only for non-obvious order, RLS reasoning, atomicity, `security definer` or rollback. Write the `.down.sql` so it restores the exact earlier state.
3. **Verification plan** with who runs each check: Main preflight (current policies and grants match the snapshot; data satisfies the new constraints), postflight (REST calls as anon and as a user, simulated-role SQL `set local role` / `request.jwt.claims`, `EXPLAIN` for new policies), and the Owner's manual pass. For each RLS change state what `USING` and `WITH CHECK` allow, test an allowed and a denied actor, and cover owner, enrolled, other-user and admin.
4. **Report** exact changes, files, checks that ran, checks pending (marked pending, never as passed), the rollout order, and "needs Codex and Main to apply".

Read the references when they match:

| Resource | Read when | Skip when |
| --- | --- | --- |
| [rls-and-storage.md](references/rls-and-storage.md) | changing or reviewing a policy, a helper, a grant, a bucket or Storage access | schema-only or RPC-only work |
| [rpc-trigger-concurrency.md](references/rpc-trigger-concurrency.md) | adding or changing an RPC, trigger, SQL helper, lock, retry or idempotent transition (coupons, payments, enrollment) | a migration that merely contains such objects and is not being changed or reviewed for them |

## Anti-patterns

Editing a published migration; dashboard SQL as the final change; weakening RLS; duplicate helpers; a new object left with default privileges; applying or "repairing" the hosted database from an implementor; claiming a remote application when only a plan or local reading ran; skipping the rollback; reporting a planned check as executed.

## Checklist

- [ ] existing objects, call sites and the snapshot were read
- [ ] focused new migration plus `.down.sql`; no published file edited
- [ ] new objects have explicit grants; no policy recursion; old permissive policies dropped by name
- [ ] rollout order stated against old code, new code and the database
- [ ] verification plan names who runs each check; pending checks stay pending
- [ ] Codex-gated; hosted database untouched by the implementor
