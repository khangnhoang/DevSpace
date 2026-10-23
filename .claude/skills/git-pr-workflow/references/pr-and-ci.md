# Push, PR, CI and merge

Read this before any push, PR creation or update, check watching, CI failure or merge. Every step still needs its own grant; the narrowest mode the Owner stated applies (`docs/agent-loops.md` Loop 3).

## Preconditions

Before any PR or CI action run `git status -sb`, `git branch --show-current`, `git remote -v`, `gh --version` and `gh auth status`, and confirm the remote and the authenticated account are the ones the task means (`khangnhoang/DevSpace`). Stop and report when:

- the worktree is dirty and the task did not include those changes, or the branch is unclear or wrong for the task;
- no usable Git remote exists, `gh` is missing, or `gh auth status` fails or shows no usable account;
- `gh` output shows missing scopes or token permissions, or the Windows keyring is not reachable from the current shell;
- proceeding would print or expose a secret.

Do not install or authenticate `gh`, switch to the raw REST API, or copy a token as a workaround; report the blocker and the smallest thing the Owner must do. These stops grant nothing: the action itself still needs its own grant.

## Push

Needs an explicit grant. Before a normal push confirm: clean worktree and index; the exact branch and commit range; the configured upstream; refreshed remote state with ahead/behind counts; and that a normal push is enough (force-push is never implied). After it, check that the remote head equals the local head and divergence is `0 behind / 0 ahead`. For multi-checkpoint work, push once after the final self-review passes and later push only correction commits, each after its own self-review; this order grants nothing.

## Create or update a PR

1. Build the content from evidence: `git log --oneline main..HEAD`, `git diff --stat main...HEAD`, the plan, progress and the checks that really ran. Do not invent tests, QA, decisions or risks; mark unknown what you cannot confirm.
2. Check that the head branch is already on the remote. If not, stop and ask for push permission. Never accept an interactive `gh` offer to push or fork.
3. Check for an existing PR (`gh pr view <branch>`); never create a duplicate. Update title, body, labels or draft state only as asked.
4. Create with `gh pr create --base main --head <branch> --title "<title>" --body-file <file>`; update with `gh pr edit`. Use an exact title or body when the Owner gives one. Otherwise title and body are in English. Keep the body file out of the commit.
5. The body follows `.github/pull_request_template.md`: Summary, Changes, Checks run, CI result, Production impact and pending hosted steps, Risks and limits, Follow-ups. `gh pr create --body-file` does not apply the template, so build the body file from it; leave `CI result` as the placeholder table until CI ends (see "Record the CI result"). Link the plan or problem IDs.
6. After a PR exists, the desktop app's PR tools handle status and auto-fix; do not poll with scheduled tasks. When the Owner says to wait for CI, watch in the foreground instead (Watch CI).

PR creation never merges, and update-only permission does not deliver new commits.

## Watch CI

A PR to `main` runs `.github/workflows/ci.yml`: the jobs `typecheck`, `build`, `docs`, `lint`, `db` and `e2e`, listed by `gh pr checks` next to the Vercel deploy preview. `typecheck`, `build`, `docs`, `db` and `e2e` block; `lint` does not, and runs `npm run lint` in a step with `continue-on-error` until the lint cleanup unit (`docs/programs/infrastructure/`). The `lint` job and its lint step both report success, so a green `lint` check does not mean lint is clean: the lint result is the problem count in the lint step's log (`gh run view <id> --log`, line "✖ N problems"), 82 today. A red `lint` job means setup (checkout, Node, `npm ci`) failed, which is a CI failure. A red `db` job is a real failure: read the failing step in `gh run view <id> --log-failed`. A failed `npx supabase start` step means the local stack did not come up (image pull or container health); a failed `npx supabase db reset` step means the baseline, a migration or the seed did not apply, and the SQL error is in that step's log; a failed `npm test` step means a test failed, a known bug stopped reproducing (the message names its ID, for example "P3 no longer reproduces"), or the rls setup failed (stack, host check or sign-in). A red `e2e` job is a real failure too: a failed `npx supabase start` or `npx playwright install` step is the environment, and a failed `npm run test:e2e` step is a failing row, a hosted or page-error hit of the network guard, or a build or server failure (the Playwright output is in the step's log; when Playwright ran and the job failed, the HTML report is the workflow artifact `playwright-report`, and a failure before Playwright ran uploads nothing). A passing `npm test` prints the lines `known bug P3`, `known bug P4` and `known bug P28`; CI uses Vitest's default reporter, so they show in the step's log. Whether `main` requires the blocking jobs is an Owner setting in GitHub, not something the repo enforces; check it with `gh api repos/khangnhoang/DevSpace/branches/main/protection` (read-only).

When the Owner says to wait for CI, run `gh pr checks <n> --watch --interval 30` in the foreground, rerun it if the shell timeout ends it first, and keep the turn open until every check is terminal ([Loop 3](../../../../docs/agent-loops.md#loop-3-pr-and-ci)). Otherwise use `gh pr checks --watch` (or `gh pr checks`). Report each check's exact terminal state. Do not say CI passed unless GitHub shows a passing state; report pending, failed, skipped and cancelled explicitly with the job names and a short log summary. A failed job's log comes from `gh run view <id> --log-failed`.

## Record the CI result

When CI on a PR reaches a terminal state, red or green, Main writes the result into the body's `CI result` section with `gh pr edit <n> --body-file <file>`, then stops. The PR creation or update grant covers this write and nothing else (`.claude/rules.md` section 4). The Owner decides the merge; nobody merges on their own, and a red result is not fixed without a CI-fix grant.

- Report the latest run for the PR's current head, not an older or cancelled one: the run link, the event, the head commit, and the table Check | Result | Duration | Notes with the six Actions jobs and Vercel.
- The `lint` row carries the problem count from the lint step's log ("✖ N problems"); see Watch CI.
- A check that did not reach its step says `not run`, `skipped` or `cancelled` with the reason (for example no lint count when setup failed).
- CI evidence lives in the PR body, not in a program's `progress.md` State.

## CI failure

Read the failed logs first (`gh run view <id> --log-failed` for an Actions job, or the Vercel build log). Classify as one of: `branch-caused-small-safe`, `branch-caused-large-risky`, `unrelated-main`, `infra-flaky`, `secret-env-config`, `db-risk`, `unclear`. Only `branch-caused-small-safe` may be fixed, under the CI-fix limits in `docs/agent-loops.md` Loop 3 and `.claude/rules.md` section 4. A fix attempt is one cycle: read logs, edit, validate locally, commit, push, re-watch. It never widens the PR, touches schema, RLS, migrations, secrets or repo settings, weakens a check, forces a push or deletes a branch. Any other class: stop and report the job, the log evidence, the class, why it was not self-fixed and the smallest decision needed.

## Merge

Default: do not merge; report that the PR is ready for the Owner. Merge or auto-merge only when the Owner asks in the current task. Before merging verify with `gh pr view <branch> --json mergeStateStatus,reviewDecision,statusCheckRollup` and `gh pr checks`: all checks pass (a green `lint` job whose log still shows "✖ N problems" is expected until the lint cleanup unit), none pending, no conflicts, no requested changes or open review comments, no branch rule blocking, and every hosted step the rollout order puts before the merge completed (applied and postflight done; order in `supabase-migration`). If anything is inconclusive, do not merge and say what could not be verified. Use `gh pr merge <n> --merge` unless another method is requested. Applying a migration is a separate step with its own grant (`supabase-migration`).
