# Push, PR, CI and merge

Read this before any push, PR creation or update, check watching, CI failure or merge. Every step still needs its own grant; the narrowest mode the Owner stated applies (`docs/agent-loops.md` Loop 3).

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

DevSpace has no CI workflow yet; the check on a PR is the Vercel deploy preview. Use `gh pr checks --watch` (or `gh pr checks`) and report each check's exact terminal state. Do not say CI passed unless GitHub shows a passing state; report pending, failed, skipped and cancelled explicitly with the job names and a short log summary. GitHub Actions for lint, typecheck, build and tests is deferred to the test-infra program (`docs/backlog/` and the roadmap ADR).

## CI failure

Read the failed logs first (`gh run view <id> --log-failed`, or the Vercel build log). Classify as one of: `branch-caused-small-safe`, `branch-caused-large-risky`, `unrelated-main`, `infra-flaky`, `secret-env-config`, `db-risk`, `unclear`. Only `branch-caused-small-safe` may be fixed, under the CI-fix limits in `docs/agent-loops.md` Loop 3 and `.claude/rules.md` section 4. A fix attempt is one cycle: read logs, edit, validate locally, commit, push, re-watch. It never widens the PR, touches schema, RLS, migrations, secrets or repo settings, weakens a check, forces a push or deletes a branch. Any other class: stop and report the job, the log evidence, the class, why it was not self-fixed and the smallest decision needed.

## Merge

Default: do not merge; report that the PR is ready for the Owner. Merge or auto-merge only when the Owner asks in the current task. Before merging verify with `gh pr view <branch> --json mergeStateStatus,reviewDecision,statusCheckRollup` and `gh pr checks`: all required checks pass, none pending, no conflicts, no requested changes or open review comments, no branch rule blocking, and no migration or hosted step that has not been approved. If anything is inconclusive, do not merge and say what could not be verified. Use `gh pr merge <n> --merge` unless another method is requested. Applying a migration is a separate step with its own grant (`supabase-migration`).
