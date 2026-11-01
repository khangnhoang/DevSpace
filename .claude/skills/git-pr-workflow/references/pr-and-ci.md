# Push, PR, CI and merge

Read this before any push, PR creation or update, check watching, CI failure or merge. Grants are owned by `AGENTS.md` section 4; the narrowest mode the Owner stated applies (`docs/agent-loops.md` Loop 3).

Select tools under [AGENTS.md, Tool selection](../../../../AGENTS.md#tool-selection), and apply its [section 4 delivery boundary](../../../../AGENTS.md#4-permissions) throughout this procedure.

## Preconditions

Before any PR or CI action run `git status -sb`, `git branch --show-current`, `git remote -v`, `gh --version` and `gh auth status`, and confirm the remote and the authenticated account are the ones the task means (`khangnhoang/DevSpace`). Stop and report when:

- the worktree is dirty and the task did not include those changes, or the branch is unclear or wrong for the task;
- no usable Git remote exists, `gh` is missing, or `gh auth status` fails or shows no usable account;
- `gh` output shows missing scopes or token permissions, or the Windows keyring is not reachable from the current shell;
- proceeding would print or expose a secret.

Do not install or authenticate `gh`, switch to the raw REST API, or copy a token as a workaround; report the blocker and the smallest thing the Owner must do. These stops grant nothing: the action itself still needs its own grant.

## Push

Needs a push grant (`AGENTS.md` section 4). Before a normal push confirm: clean worktree and index; the exact branch and commit range; the configured upstream; refreshed remote state with ahead/behind counts; and that a normal push is enough (force-push is never implied). After it, check that the remote head equals the local head and divergence is `0 behind / 0 ahead`. For multi-checkpoint work, push once after the final self-review passes and later push only correction commits, each after its own self-review.

## Create or update a PR

1. Build the content from evidence: `git log --oneline main..HEAD`, `git diff --stat main...HEAD`, the plan, progress and the checks that really ran. Do not invent tests, QA, decisions or risks; mark unknown what you cannot confirm.
2. Check that the head branch is already on the remote. If not, stop and ask for push permission. Never accept an interactive `gh` offer to push or fork.
3. Check for an existing PR (`gh pr view <branch>`); never create a duplicate. Update title, body, labels or draft state only as asked.
4. Create with `gh pr create --base main --head <branch> --title "<title>" --body-file <file>`; update with `gh pr edit`. Use an exact title or body when the Owner gives one. Otherwise title and body follow the language rule in `AGENTS.md` section 1. Keep the body file out of the commit.
5. The body follows `.github/pull_request_template.md`: Summary, Changes, Checks run, CI result, Production impact and pending hosted steps, Risks and limits, Follow-ups. `gh pr create --body-file` does not apply the template, so build the body file from it; leave `CI result` as the placeholder table until CI ends (see "Record the CI result"). Link the plan or problem IDs.
6. After a PR exists, inspect status and handle any authorized CI fix using the shared Tool selection rule linked above; do not poll with scheduled tasks. When the Owner says to wait for CI, watch in the foreground (Watch CI).

Creating, updating, pushing and merging are separate grants (`AGENTS.md` section 4).

## Watch CI

CI runs on every PR to `main` and every push to `main`, with no hosted secret. `.github/workflows/ci.yml` has the jobs `typecheck`, `build`, `docs`, `lint`, `db` and `e2e`, listed by `gh pr checks` next to the Vercel deploy preview, which still runs as before. `db` starts the local Supabase stack, runs `db reset`, then `npm test`; `e2e` starts its own local stack, installs Chromium and runs `npm run test:e2e`. All six jobs block. A seventh job, `changes`, is a helper and not a required check (see "Docs-only pull requests"). A red `lint` job means `npm run lint` reported a problem (errors and warnings alike, `--max-warnings 0`), listed in the step's log, or setup (checkout, Node, `npm ci`) failed. A red `db` job is a real failure: read the failing step in `gh run view <id> --log-failed`. A failed `npx supabase start` step means the local stack did not come up (image pull or container health); a failed `npx supabase db reset` step means the baseline, a migration or the seed did not apply, and the SQL error is in that step's log; a failed `npm test` step means a test failed, a known bug stopped reproducing (the message names its ID, for example "P3 no longer reproduces"), or the rls setup failed (stack, host check or sign-in). A red `e2e` job is a real failure too: a failed `npx supabase start` or `npx playwright install` step is the environment, and a failed `npm run test:e2e` step is a failing row, a hosted or page-error hit of the network guard, or a build or server failure (the Playwright output is in the step's log; when Playwright ran and the job failed, the HTML report is the workflow artifact `playwright-report`, and a failure before Playwright ran uploads nothing). A passing `npm test` prints the lines `known bug P3`, `known bug P4` and `known bug P28`; CI uses Vitest's default reporter, so they show in the step's log. Whether `main` requires the blocking jobs is an Owner setting in GitHub, not something the repo enforces; check it with `gh api repos/khangnhoang/DevSpace/branches/main/protection` (read-only).

When the Owner says to wait for CI, run `gh pr checks <n> --watch --interval 30` in the foreground, rerun it if the shell timeout ends it first, and keep the turn open until every check is terminal ([Loop 3](../../../../docs/agent-loops.md#loop-3-pr-and-ci)). Otherwise use `gh pr checks --watch` (or `gh pr checks`). Report each check's exact terminal state. Do not say CI passed unless GitHub shows a passing state; report pending, failed, skipped and cancelled explicitly with the job names and a short log summary. A failed job's log comes from `gh run view <id> --log-failed`.

## Docs-only pull requests

On a pull request to `main` the `changes` job runs `scripts/ci/docs-only.mjs`, taken from the base commit (a change to the script takes effect on the PRs after it merges; a base without it fails the job, so both jobs run), on the changed paths (`git diff --name-only -z --no-renames`, base to head). When every path ends in `.md` or is exactly `.claude/skills/playwright-cli/LICENSE`, `db` and `e2e` are skipped and `typecheck`, `build`, `docs` and `lint` still run. The list lives only in that script (`DOCS_ONLY_FILES` and the `.md` rule), tested in `__tests__/unit/docs-only.test.ts`; any other file, also a script or image under `docs/` or `.claude/skills/`, runs all six jobs, and so does an empty list.

Fail-open: `db` and `e2e` are skipped only on a `pull_request` run whose `changes` job succeeded with output `true`. A push to `main`, a failed or skipped `changes` job and a missing output run both; a cancelled run starts neither. GitHub counts a job skipped by its own `if:` as passed for the required checks, so a docs-only PR stays mergeable. Read a skipped `db` or `e2e` as "docs only, not run", never as a test result. A skipped row is expected only on a docs-only PR; on a PR that changes code it means the classifier or the condition is wrong, so report it as a blocker.

## Record the CI result

When CI on a PR reaches a terminal state, red or green, Main writes the result into the body's `CI result` section with `gh pr edit <n> --body-file <file>`, then stops. What this write may cover, and who may merge or fix a red result, is owned by `AGENTS.md` section 4.

- Report the latest run for the PR's current head, not an older or cancelled one: the run link, the event, the head commit, and the table Check | Result | Duration | Notes with the Actions jobs (the six required ones; `changes` is optional) and Vercel.
- The `lint` row says pass or fail; on a failure, Notes names the first problems from the step's log.
- A check that did not reach its step says `not run`, `skipped` or `cancelled` with the reason (for example lint not run when setup failed).
- On a docs-only PR the `db` and `e2e` rows say `skipped` with the reason "docs-only PR, `changes` output true"; do not write `passed`.
- CI evidence lives in the PR body, not in a program's `progress.md` State.

## CI failure

Read the failed logs first (`gh run view <id> --log-failed` for an Actions job, or the Vercel build log). Classify as one of: `branch-caused-small-safe`, `branch-caused-large-risky`, `unrelated-main`, `infra-flaky`, `secret-env-config`, `db-risk`, `unclear`. Only `branch-caused-small-safe` may be fixed, under the CI-fix limits in `docs/agent-loops.md` Loop 3 and `AGENTS.md` section 4. A fix attempt is one cycle: read logs, edit, validate locally, commit, push, re-watch. It never widens the PR, touches schema, RLS, migrations, secrets or repo settings, weakens a check, forces a push or deletes a branch. Any other class: stop and report the job, the log evidence, the class, why it was not self-fixed and the smallest decision needed.

## Merge

Default: do not merge; report that the PR is ready for the Owner. Merge or auto-merge only when the Owner asks in the current task. Before merging verify with `gh pr view <branch> --json mergeStateStatus,reviewDecision,statusCheckRollup` and `gh pr checks`: all checks pass, none pending, no conflicts, no requested changes or open review comments, no branch rule blocking, and every hosted step the rollout order puts before the merge completed (applied and postflight done; order in `supabase-migration`). If anything is inconclusive, do not merge and say what could not be verified. Use `gh pr merge <n> --merge` unless another method is requested. Applying a migration is a separate step with its own grant (`supabase-migration`).
