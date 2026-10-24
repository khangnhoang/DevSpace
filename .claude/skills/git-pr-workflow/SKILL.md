---
name: git-pr-workflow
description: "Git and GitHub workflow for DevSpace: what git action is allowed, branch start from latest main, staging only related files, English Conventional Commits, correction history, push, PR creation and update, watching checks, CI fixing and merge. Use before any git, gh or PR action, including before every commit, even a local checkpoint commit an implementor makes under a handoff, and when reporting a completed checkpoint."
---

# Git and PR workflow

## Use when / do not use when

Use before any `git` or `gh` action, when a task is complete and needs a commit message and report, when the tree is dirty or the branch is unclear, and for PR, CI and merge requests.

Do not use it to justify committing unfinished, conflicting, unrelated or knowingly broken work. Planning, review and domain rules belong to `planning`, `code-review` and the domain skills.

## The rule: no git action beyond what was granted

- Run only the git or remote action the Owner requested, or that a handoff to you granted (for example "local commits per checkpoint"). Commit, push, PR, merge, branch deletion and CI fixing are separate grants; "commit" never implies "push".
- Natural phrasing counts ("commit đi", "create the commit"). Anything vaguer is not a grant: ask, or take the narrower action.
- An implementor with local-commit authority never pushes, opens a PR or merges, even to fix CI (`.claude/rules.md` section 4). Plans are not committed by default and only after their review passes (`planning`).
- Never force-push, `git reset --hard`, `git clean`, `git checkout -- .`, `git restore .`, amend, squash or rebase without the Owner's explicit request. Never skip hooks (`--no-verify`).
- Do not create a worktree whose `node_modules` is a junction or symlink to another checkout: removing it on Windows can delete the target's `node_modules`.

## Before working or committing

Run `git branch --show-current` and `git status --short`. If the tree is dirty, identify and keep pre-existing changes: do not revert, stage or commit them, and stop if ownership cannot be told.

New task branch: read [branch-and-commit.md](references/branch-and-commit.md). Short form: branch from the latest `main` (fetch and fast-forward only with permission when it touches the network), name it `<type>/<kebab-name>` (`feat fix refactor test docs chore perf ci`, never `claude/` or `agent/`), and stop if the base or a dependency on unmerged work is unclear.

## Commit

Read [branch-and-commit.md](references/branch-and-commit.md) when you are about to stage or commit. The gate:

- permission exists; the checkpoint's scope and acceptance are complete and its self-review passed (`docs/agent-loops.md`, Self-review); relevant checks ran after the last edit (`npx tsc --noEmit`, `npm run lint` with 0 problems, `npm run docs:check`); no conflict marker, debug code or secret; no unresolved decision;
- stage explicit paths (`git add path/a path/b`), not `git add .`, unless the tree began clean and everything is in scope; inspect `git diff --cached` and `git diff --check`;
- one commit per checkpoint (a small task without checkpoints: as `docs/agent-loops.md` Sizing allows); split a checkpoint only for a reason you state in the report (for example a part that must revert alone). Commit in its own message after every edit succeeded, never in parallel with an edit. Message `<type>(<scope>): <imperative summary>`, entirely in English, no trailing period, no attribution lines, no vague words ("update files", "final fix").

Fixes for findings of a review after the commit are new correction commits; never amend a reviewed commit by default.

## After a checkpoint (report)

When the work is done and no commit is granted, report: changed files with the reason; checks run and their exact results (passed, failed, skipped, not run); the `Tự review` block (`docs/agent-loops.md`); a proposed English commit message; and the remote state ("nothing was pushed"). With a commit grant, report the hash, message, scope, checks and remote state instead. The Owner-facing version is in Vietnamese; commands, paths and the commit message stay as they are.

## Push, PR, CI and merge

Read [pr-and-ci.md](references/pr-and-ci.md) before any push, PR, CI or merge request. Short form: a normal push needs a clean tree, the exact branch and range, and an explicit grant; a PR needs the head already on the remote; the PR title and body are in English, follow `.github/pull_request_template.md` and state only what really ran; when CI on the PR ends, red or green, Main writes the result into the body's `CI result` section and stops; CI is the GitHub Actions jobs `typecheck`, `build`, `docs`, `lint`, `db` and `e2e` plus the Vercel deploy preview (`gh pr checks --watch`; every job blocks, `lint` included, and requiring them on `main` is an Owner setting); merge only with explicit permission and never auto-merge unless asked. Who may fix CI, and how many rounds, is owned by `docs/agent-loops.md` Loop 3 and `.claude/rules.md` section 4.

## Stop when

The base or branch is unclear; ownership of a change cannot be separated; verification fails because of the change and the fix needs a scope or product decision; a hook fails for a reason outside the task; a secret is found (unstage and remove only the task-owned part, do not commit, report that rotation may be needed); a remote action is not granted.

## Resources

| Resource | Read when | Skip when |
| --- | --- | --- |
| [branch-and-commit.md](references/branch-and-commit.md) | starting or switching a branch, staging, committing, a correction, conflict or history question | a planning or review task with no git action |
| [pr-and-ci.md](references/pr-and-ci.md) | a push, PR create or update, watching checks, a CI failure or merge | the work stays local |

## Checklist

- [ ] the Owner asked for this action or the handoff granted it; nothing wider was done
- [ ] branch, dirty-tree ownership and the staged diff were checked
- [ ] only related files are staged; no secrets, debug code or artifacts
- [ ] message in English, Conventional Commits; correction as a new commit
- [ ] remote state reported truthfully
