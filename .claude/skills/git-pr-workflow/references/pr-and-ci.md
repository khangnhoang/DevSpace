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
5. The body has: summary; changed files or areas; checks run and results; production impact (migrations and their rollout order, hosted steps still pending); risks and limits; follow-ups. Link the plan or problem IDs.
6. After a PR exists, the desktop app's PR tools handle status and auto-fix; do not poll with scheduled tasks.

PR creation never merges, and update-only permission does not deliver new commits.

## Watch CI

A PR to `main` runs `.github/workflows/ci.yml`: the jobs `typecheck`, `build`, `docs` and `lint`, listed by `gh pr checks` next to the Vercel deploy preview. `typecheck`, `build` and `docs` block; `lint` does not, and runs `npm run lint` in a step that is allowed to fail until the lint cleanup unit (`docs/programs/infrastructure/`). A green `lint` job therefore does not mean lint is clean: read the lint step's own result and log (`gh run view <id> --log`), which lists the 81 existing problems. A red `lint` job means setup (checkout, Node, `npm ci`) failed, which is a CI failure. Requiring the blocking jobs on `main` is an Owner setting in GitHub (pending), not something the repo enforces.

Use `gh pr checks --watch` (or `gh pr checks`) and report each check's exact terminal state. Do not say CI passed unless GitHub shows a passing state; report pending, failed, skipped and cancelled explicitly with the job names and a short log summary. A failed job's log comes from `gh run view <id> --log-failed`.

## CI failure

Read the failed logs first (`gh run view <id> --log-failed` for an Actions job, or the Vercel build log). Classify as one of: `branch-caused-small-safe`, `branch-caused-large-risky`, `unrelated-main`, `infra-flaky`, `secret-env-config`, `db-risk`, `unclear`. Only `branch-caused-small-safe` may be fixed, under the CI-fix limits in `docs/agent-loops.md` Loop 3 and `.claude/rules.md` section 4. A fix attempt is one cycle: read logs, edit, validate locally, commit, push, re-watch. It never widens the PR, touches schema, RLS, migrations, secrets or repo settings, weakens a check, forces a push or deletes a branch. Any other class: stop and report the job, the log evidence, the class, why it was not self-fixed and the smallest decision needed.

## Merge

Default: do not merge; report that the PR is ready for the Owner. Merge or auto-merge only when the Owner asks in the current task. Before merging verify with `gh pr view <branch> --json mergeStateStatus,reviewDecision,statusCheckRollup` and `gh pr checks`: all checks pass (the failed lint step inside a green `lint` job is expected until the lint cleanup unit), none pending, no conflicts, no requested changes or open review comments, no branch rule blocking, and no migration or hosted step that has not been approved. If anything is inconclusive, do not merge and say what could not be verified. Use `gh pr merge <n> --merge` unless another method is requested. Applying a migration is a separate step with its own grant (`supabase-migration`).
