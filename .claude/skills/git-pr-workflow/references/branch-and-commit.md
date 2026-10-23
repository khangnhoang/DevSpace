# Branch start, commit and history

Read this when starting or switching a branch, staging, committing, or deciding about a correction, a conflict or history. Permissions are in `SKILL.md`; nothing here grants an action.

## Starting a task branch

1. `git branch --show-current`, `git status --short`. Record the branch, `HEAD`, and any pre-existing changes.
2. Pick the type from the primary purpose: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`. Name `<type>/<short-kebab-name>`. Check the name is unused locally and on the remote.
3. Independent task: with permission, `git fetch`, then switch to `main`, `git pull --ff-only`, confirm it matches `origin/main`, then create the branch from it. Never branch from a stale `main` or from a feature branch just because it has recent work.
4. Stacked task (it really depends on unmerged work): create the branch from that verified dependency `HEAD` and say that the stacked procedure applies.
5. If several branches are unmerged and independence is unclear, stop and report the branch and dependency state. Do not guess a base.
6. Stop when the tree is dirty, `main` cannot fast-forward, a required dependency is missing from `origin/main`, or fetch is not permitted.

Do not create, rename, switch, merge or delete branches just to silence a problem. Claim a branch was created or synchronized only after you ran it and saw the resulting `HEAD` and ahead/behind state.

## Commit procedure

1. Confirm the branch and the working tree; list unstaged, staged and untracked changes.
2. Separate task-owned changes from unrelated or unclear ones; stop and report if unclear ones are present.
3. Run or confirm the smallest relevant checks that are still current after the last edit.
4. Audit: `git status --short`, `git diff --check`, `git diff`, then stage explicit paths (hunks only when they separate cleanly) and read `git diff --cached`.
5. Look for conflict markers, debug code, unrelated formatting, accidental deletions or renames, and secrets or environment values in the actual staged content. Keyword search is only a supplement.
6. Create one local commit for the checkpoint, in its own message after every edit has succeeded: an edit sent in parallel with `git commit` can fail while the commit still runs. Report the hash, message, scope, checks and that nothing was pushed.

A commit may include the implementation plus the tests, types, migration files, comments and docs it directly needs. It must not include pre-existing work, unrelated cleanup, broad formatting, unneeded dependency changes, personal settings, `.env*`, build output or debug dumps. Do not commit `.claude/*.local.json` or `.claude/worktrees/`.

A commit is not final approval. Manual QA may stay pending if reported; it still blocks merge when required.

## Message

`<type>(<scope>): <imperative summary>`, with types `feat fix refactor test docs chore perf build ci revert`. All of it in English. Add a body only when the reason, a compatibility point, a risk or a known limit is not obvious. Good: `fix(profile): send null for an empty date of birth`. Bad: `fix issue`, `update files`, `done`.

## Failures

- Verification fails because of the change: fix in scope and rerun; stop if the fix needs a scope or product decision. Do not commit broken work unless the Owner asked for a labeled WIP commit.
- A failure that existed before you: confirm it and record the evidence; do not fix it silently (triage in `.claude/rules.md` section 5).
- Commit or hook fails: report the exact reason, keep the tree, fix only in-scope causes, then rerun the focused checks and re-audit the staged diff before trying again.

## Corrections and history

A finding of the author's pre-commit self-review is fixed before the commit (`docs/agent-loops.md`, Self-review). A finding of a review after the commit, including the author's own pass over the whole diff once the checkpoints are committed, gets a new correction commit, understandable alone; that is the default. Amend, squash, rebase and interactive history edits need the Owner's explicit request; before one, name the affected commits, whether they were pushed and whether a force-push would follow (which also needs its own request).

For merge or rebase conflicts: read both sides and the intent, keep unrelated changes, run the affected checks, and stop when a product decision is needed. Never pick `ours` or `theirs` wholesale. Inspect the state before aborting an operation so resolved work is not lost.
