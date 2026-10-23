# U2 detail plan — CI result in the PR body and hosted apply with db push

Revision: r3, 2026-10-23. Owner approval: 2026-10-23 in chat, after the Codex plan gate passed in round 3 (Main's session record). Merged in PR 13 as `38d431b`. Charter: [README.md](../../README.md).

Retroactive record: this is the chat plan r3 of PR 13 ("next docs PR after infrastructure U2"), written before `agent-workflow` became evergreen and committed with U3. Its content is r3's, put into the detail-plan template; a section r3 had no content for says "not recorded in r3". r3 described the work as medium work outside a program unit (docs, rules, skills), Codex-gated because it changes how migrations are applied to hosted.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: five Owner-approved items (Owner, 2026-10-23):

1. CI result in the PR body, plus a PR body template.
2. Hosted migrations are applied with `npx supabase db push` from the permanently linked checkout, behind two grants.
3. Small `supabase-migration` fixes that U2 made necessary.
4. Move the pending "handoff goes in memory" rule into `.claude/rules.md` section 7.
5. Infrastructure State: record U2 merged and CP6, move State to U3 (not started).

| ID | Observable result |
| --- | --- |
| AC1 | (item 1) `pr-and-ci.md` says: when CI on a PR reaches a terminal state, red or green, Main writes the result into the PR body's `CI result` section (run link, event, head commit, a table Check \| Result \| Duration \| Notes covering the five jobs and Vercel, with the lint problem count from the lint step log in the `lint` row) with `gh pr edit --body-file`, then stops. The Owner decides the merge; nobody merges on their own, and a red result is not fixed without a CI-fix grant. CI evidence lives in the PR body, not in `progress.md` State. The permission itself lives in `.claude/rules.md` section 4 (a skill cannot widen it, section 8): the first bullet says a PR creation or update grant also covers writing that PR's CI result into its body, and nothing else. `docs/agent-loops.md` Loop 3 Mode ("`create PR` and `update PR` do only that action") names this one exception by linking to section 4, so the two files do not conflict. The row for a check that did not reach its step says `not run`, `skipped` or `cancelled` with the reason (for example no lint count when setup failed); the section reports the latest run for the PR's current head, not an older or cancelled one. |
| AC2 | (item 1) `.github/pull_request_template.md` exists with the sections Summary, Changes, Checks run, CI result (placeholder table with `typecheck`, `build`, `docs`, `lint`, `db`, Vercel), Production impact and pending hosted steps, Risks and limits, Follow-ups. `pr-and-ci.md` step 5 points to it and says `gh pr create --body-file` does not apply it, so the body file is built from it. The `git-pr-workflow` `SKILL.md` short form names the CI result step. |
| AC3 | (item 2) `supabase-migration` has a hosted apply procedure that Main follows: 1. precondition: the migration and its rollback passed Codex, the PR's CI is green, and the rollout order says it is time. A merge to `main` deploys production, so additive and guard migrations are applied, and their postflight done, before the merge; a restriction is applied only after the merge and after Main confirms the compatible production deploy is live; 2. target check: `supabase/.temp/project-ref` reads `lkvxxrxojjlkchzzqidu` (`CLAUDE.md`); missing or different, stop; 3. Main asks the Owner for grant 1 (prepare), naming the project and the migration file(s), and runs `npx supabase db push --linked --dry-run`. Main records the commit (`git rev-parse HEAD`, clean tree) and the listed versions; 4. only if the dry run lists exactly the expected file(s), Main asks for grant 2 (apply), naming the project, the commit and the version(s). Right before applying, Main re-checks the project ref, a clean tree at the same commit, and runs the dry run again; any difference stops and the prepare step starts over. Then `npx supabase db push --linked --yes`, and `list_migrations` must show the new version with the file's name; 5. stop and report instead when the dry run lists anything else or nothing, when the CLI asks for a database password, or on any error. The Owner then decides (for example runs the step themself). The two grants cover only the dry run and the apply. Postflight on metadata uses Main's standing read-only catalog permission (`.claude/rules.md` section 4); a postflight that reads user data rows or writes a test row needs its own Owner approval first and stays `pending` until it has it. Never `--include-all`, `--include-seed`, `--include-roles` or `--db-url`, and never the MCP `apply_migration` for a repo migration. It states why (F7). Implementors never run `link`, `--linked` or `db push`. |
| AC4a | (item 1 and 2 merge gate) `pr-and-ci.md` Merge: instead of "no migration or hosted step that has not been approved", a hosted step that the rollout order puts before the merge must be completed (applied and postflight done), linking to `supabase-migration` for the order instead of copying it. |
| AC4 | (item 2) `SKILL.md:20-21` no longer says nobody runs `db push`; it says the baseline was recorded once by `migration repair` and later migrations go through the apply procedure. `.claude/rules.md` section 4: applying a migration is two grants (prepare, apply) per `supabase-migration`; the checkout is permanently linked, so any `supabase` command outside the implementors' local list may reach production. `CLAUDE.md` Commands no longer implies the checkout is unlinked. |
| AC5 | (item 3) `supabase-migration` says: create the migration with `npx supabase migration new <name>` and the rollback by hand as `supabase/rollbacks/<same name>.down.sql`; a new migration must replay through `npx supabase db reset` after the baseline and earlier migrations (the CI `db` job fails otherwise); two new traps: SQL under `supabase/migrations` and `supabase/rollbacks` checks out as LF through `.gitattributes`, so do not add CRLF or a new `-text` line; never edit the baseline (it is the pre-H1 schema derived from the Owner's hosted dump of 2026-10-23; the baseline plus the published migrations rebuild hosted; its guard aborts on an existing database, and hosted history marks it applied). The traps heading no longer says only H1 and H2-1. |
| AC6 | (item 4) `.claude/rules.md` section 7 holds the handoff rule: when the Owner asks for a handoff, or a long session must stop with work in flight, Main writes it as one memory file linked from `MEMORY.md`, holding facts no doc reflects yet (hosted, git and branch state, running processes, idle sessions, grants used and pending, lagging state records), the next task's approved scope item by item, what a later unit owns, and what comes after; it links to owning docs instead of copying; Main also gives the Owner a one-line prompt for the new session. Deletion is tied to the handoff's task, with an observable test: the task is complete when its PR is merged and the owning docs record every durable fact the handoff held (session facts such as running processes, idle sessions or a branch to start from expire with the task). The session that completes the task deletes the handoff and its `MEMORY.md` line in the same turn it confirms the merge. A session that loads a handoff whose task is already complete (checked with `git log origin/main` or the PR state) deletes it before any other work. A partly complete task: Main edits the handoff down to what is still open and not yet in a doc, and deletes it when nothing is left. A task the Owner cancels: delete it, and record the reason in the owning doc if one needs it. It lands as its own `chore(agent-rules): ...` commit. |
| AC7 | (item 5) Infrastructure `progress.md` State: current unit U3 (Vitest and RLS tests, branch `test/infra-vitest`), not started; next action: Main writes the U3 detail plan; U2 evidence shrinks to milestones. New milestones: U2 merged (PR 12, `49006a9`); U2 CP6: baseline recorded on hosted by `migration repair` (4 versions), `db` required on `main`, push run 39839581443 on `main` passed (lint 81). `npm run docs:check` passes. |
| AC8 | (exclusions hold) `git diff --stat origin/main..HEAD` touches only: `.github/pull_request_template.md`, `.claude/skills/git-pr-workflow/SKILL.md`, `.claude/skills/git-pr-workflow/references/pr-and-ci.md`, `.claude/skills/supabase-migration/SKILL.md`, `.claude/rules.md`, `CLAUDE.md`, `docs/agent-loops.md` (Loop 3 Mode sentence only), `docs/programs/infrastructure/progress.md`. `supabase-migration` Workflow step 3 and `references/rls-and-storage.md` are unchanged. |

### 1.2 Scope and non-goals

- In scope: not recorded in r3 as a list; the five items and AC1 to AC8 above.
- Non-goals (r3 "Out of scope"): local RLS checks and anything U3 owns (F10); the frozen U2 detail plan and the master plan text (their "no `db push` before the repair" lines are historical and still true); the closed security-hotfix plan's MCP apply line; `.github/workflows/ci.yml`; any hosted write; deleting the two memory files now (AC6 applies to them once this PR merges: the session that confirms the merge deletes both); the rest of `docs/agent-loops.md` (Loop 3 stop rules already cover "stop, Owner decides"); the "no automated tests" lines in `CLAUDE.md:15` and `code-review` `references/domain-dimensions.md:19`, which U3 rewrites when it adds Vitest (master plan D9: skills change with their tooling).

In this section and in 1.1, "U2" and "U3" without a program name are infrastructure units, as in r3.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. No `--include-seed` anywhere in the apply flow. | The seed holds invented users with known passwords and would land in production. |
| G2. No step text grants anything: every hosted step still names its grant. | not recorded in r3 |
| G3. Each rule has one owner: `rules.md` section 4 states the two grants and links to `supabase-migration` for the procedure; it does not copy the steps. | not recorded in r3 |
| G4. Skills stay near 150 lines (`.claude/rules.md` section 8). | not recorded in r3 |

### 1.4 Owner decisions that bind this unit

- (2026-10-23) The five items in 1.1.
- (2026-10-23) The checkout's link to hosted stays permanently (F4).

## 2. Repository facts

Historical evidence, read 2026-10-23. Baseline: `origin/main` at `49006a9` (PR 12 merge). The working checkout `chore/infra-local-db` had the same tree.

- F1. Hosted `list_migrations` (MCP, read-only): `20261021000000 baseline`, `20261021131351 h1_block_role_escalation`, `20261021181051 h2_1a_public_profile_view`, `20261021185249 h2_1b_restrict_reads`. The Owner ran `migration repair` for the baseline with a grant.
- F2. `gh api repos/khangnhoang/DevSpace/branches/main/protection`: required checks `typecheck`, `build`, `docs`, `db`; `enforce_admins` on; `strict` off.
- F3. Push run 39839581443 on `main`, head `49006a9`: `completed success`; all five jobs `completed success`; lint step log `✖ 81 problems (56 errors, 25 warnings)`.
- F4. `supabase/.temp/project-ref` exists (gitignored by `supabase/.gitignore`): the checkout is linked to hosted. Owner decision: the link stays permanently.
- F5. CLI 2.121.0 `db push --help`: flags `--dry-run`, `--include-all`, `--include-seed`, `--include-roles`, `--skip-vault`, `--linked`, `--local`, `--db-url`, `--password`; global `--yes` answers all prompts. `config.toml` has no `[db.vault]` secrets (commented out). `migration new <name>` creates an empty migration file.
- F6. Text that the new flow makes false:
  - `.claude/skills/supabase-migration/SKILL.md:21` ends "Hosted history records the baseline only through `migration repair` by the Owner, and nobody runs `db push` to hosted."
  - `SKILL.md:20` "... applies migrations only after Codex PASS and the Owner's approval" does not say how.
  - `CLAUDE.md` Commands, local database line, ends "No command links to hosted." (the listed commands are local, but the checkout itself is now linked).
  - `.claude/rules.md` section 4 lists "applying a migration and any write to the hosted database" as one grant and forbids implementors `link`, `db push`, `--linked`; it does not say the checkout is linked.
- F7. Why `db push` instead of the MCP `apply_migration`: the MCP records its own version, so H2-1's hosted version differed from the file name (fixed by a rename PR), and it applies the SQL text it is given, which is how U2 found `lessons.word_count` stored differently on hosted (real Unicode characters) than in the H2-1a file (`\uXXXX` escapes). `db push` applies the file under the file's version.
- F8. `git-pr-workflow` `references/pr-and-ci.md` "Create or update a PR" step 5 lists the body sections; there is no CI result section and no template. PR 12's body used: Summary, Changes, Checks run, CI result (run link, event, head, table Check | Result | Duration | Notes), Production impact and pending hosted steps, Risks and limits. `.github/` holds only `workflows/`.
- F9. `.gitattributes` checks out `supabase/migrations/*.sql` and `supabase/rollbacks/*.sql` as LF; the baseline is `-text` to keep hosted's CR bytes. The baseline's guard aborts on a database that already has `public.profiles`.
- F10. U3 owns local RLS checks with the seed users (master plan U3 row, FEAT-003 RLS part, D9). `supabase-migration` Workflow step 3 and `references/rls-and-storage.md:27` still say RLS checks run on hosted after the apply; this PR leaves them.
- F11. Infrastructure `progress.md` State on `main` still says U2 at CP5, not pushed; milestones stop at U2 CP4.

## 3. Bounded implementation hypotheses

Implementation may change if the Spec holds.

- The apply procedure is a new `## Hosted apply` section in `supabase-migration` `SKILL.md` after "Rollout order", and Hard rule lines 20-21 shrink to point at it.
- Workflow step 2 gains the `migration new` sentence; the replay rule goes in Hard rules.

## 4. Checkpoints

r3 planned commits, not checkpoints. Branch `docs/ci-result-and-db-push` from `origin/main` (Main creates it; local operation).

| CP | Outcome | Verification |
| --- | --- | --- |
| Commit 1 (Sonnet) | `docs(agent-rules): record the CI result in the PR body and add a PR template` (AC1, AC2) | the verification list below |
| Commit 2 (Sonnet) | `docs(agent-rules): apply hosted migrations with db push from the linked checkout` (AC3, AC4) | the verification list below |
| Commit 3 (Sonnet) | `docs(agent-rules): add the migration new, replay, LF and baseline rules` (AC5) | the verification list below |
| Commit 4 (Sonnet) | `chore(agent-rules): write session handoffs as one memory file` (AC6) | the verification list below |
| Commit 5 (Main) | `docs(programs): record U2 merged and CP6 and move State to U3` (AC7), a state record after reviewing 1-4; standalone commit, because it records a merge and rollout event (`program-docs`) | the verification list below |

- Sonnet implementor (`claude-sonnet-5-5`, effort high, this checkout, `use_worktree: false`), local commits only.
- Codex gate on this plan, and on the diff 1-4 before push.
- Grants still needed, each separate: the Main commit, push, PR creation (which then covers the CI result body update), merge.

Verification (r3 section 6):

- `npm run docs:check` and `npm run docs:check:test` after each commit; `git diff --check`.
- `grep -rn "nobody runs \`db push\`\|No command links to hosted" .claude CLAUDE.md` finds nothing.
- `grep -n "include-all\|include-seed\|include-roles\|--dry-run\|migration new" .claude/skills/supabase-migration/SKILL.md` shows the new rules.
- `git diff origin/main..HEAD -- .claude/skills/supabase-migration/references/` is empty; Workflow step 3 is byte-identical.
- AC8 file list via `git diff --stat origin/main..HEAD`.
- `npx tsc --noEmit` and lint are not affected (Markdown only); not run, and the report says so.
- Not verifiable in this PR: the `db push` flow itself, until the next real migration. The first use is its QA; if the CLI asks for a password, AC3 step 5 applies.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A permanently linked checkout makes a stray `db push`, `db reset --linked` or `db dump` reach production. | AC4 rules text; implementors keep the local allow-list; Main's two grants with the dry run in between. |
| `db push` needs the database password the agent must not handle. | AC3 step 5: stop, the Owner runs it. |
| The linked project is not production, or the files change between the dry run and the apply. | AC3 steps 2 and 4: project ref check, same clean commit, second dry run right before the apply. |
| The dry run shows the baseline or an old migration as pending (history drift). | Only "exactly the expected file(s)" proceeds; never `--include-all`. |
| An additive migration applied before merge, then the PR is not merged. | It is additive by definition; the rollback file exists; the Owner decides the rollback. |
| The PR template drifts from `pr-and-ci.md`. | `pr-and-ci.md` names the template as the section list owner. |

- Rollout runbook: not recorded in r3.
- Stop when: not recorded in r3.
- Rollback: not recorded in r3.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
