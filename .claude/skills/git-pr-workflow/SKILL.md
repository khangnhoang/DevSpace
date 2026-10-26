---
name: git-pr-workflow
description: "Git and GitHub workflow for DevSpace: what git action is allowed, branch start from latest main, staging only related files, English Conventional Commits, correction history, push, PR creation and update, watching checks, CI fixing and merge. Use before any git, gh or PR action, including before every commit, even a local checkpoint commit an implementor makes under a handoff, and when reporting a completed checkpoint."
---

# Git and PR workflow

## Use when / do not use when

Use before any `git` or `gh` action, when a task is complete and needs a commit message and report, when the tree is dirty or the branch is unclear, and for PR, CI and merge requests.

Do not use it to justify committing unfinished, conflicting, unrelated or knowingly broken work. Planning, review and domain rules belong to `planning`, `code-review` and the domain skills.

## The rule: no git action beyond what was granted

- Which git and remote actions need a grant, and what an implementor may do, is owned by `.claude/rules.md` section 4. Run only the action the Owner requested or a handoff to you granted (for example "local commits per checkpoint").
- Natural phrasing counts ("commit đi", "create the commit"). Anything vaguer is not a grant: ask, or take the narrower action.
- Committing a plan: `planning`, Git and approval.
- Never force-push, `git reset --hard`, `git clean`, `git checkout -- .`, `git restore .`, amend, squash or rebase without the Owner's explicit request.
- Do not create a worktree whose `node_modules` is a junction or symlink to another checkout: removing it on Windows can delete the target's `node_modules`.

## Before working or committing

Run `git branch --show-current` and `git status --short`. If the tree is dirty, identify and keep pre-existing changes: do not revert, stage or commit them, and stop if ownership cannot be told.

New task branch: read [branch-and-commit.md](references/branch-and-commit.md). Short form: branch from the latest `main` (fetch and fast-forward only with permission when it touches the network), name it `<type>/<kebab-name>` (`feat fix refactor test docs chore perf ci`, never `claude/` or `agent/`), and stop if the base or a dependency on unmerged work is unclear.

## Commit

Read [branch-and-commit.md](references/branch-and-commit.md) when you are about to stage or commit. The gate:

- permission exists; the checkpoint's scope and acceptance are complete and its self-review passed (`docs/agent-loops.md`, Self-review); relevant checks ran after the last edit (`npx tsc --noEmit`, `npm run lint` with 0 problems, `npm run docs:check`); no conflict marker, debug code or secret; no unresolved decision;
- stage explicit paths (`git add path/a path/b`), not `git add .`, unless the tree began clean and everything is in scope; inspect `git diff --cached` and `git diff --check`;
- one commit per checkpoint (a small task without checkpoints: as `docs/agent-loops.md` Sizing allows); split a checkpoint only for a reason you state in the report (for example a part that must revert alone). Commit in its own message after every edit succeeded, never in parallel with an edit. Message `<type>(<scope>): <imperative summary>`, language per `.claude/rules.md` section 1, no trailing period, no vague words ("update files", "final fix").

Fixes for findings of a review after the commit are new correction commits; never amend a reviewed commit by default.

## After a checkpoint (report)

When the work is done, report as `docs/agent-loops.md` Loop 1 (Report) says, with the remote state stated ("nothing was pushed"). With a commit grant, report the hash, message, scope, checks and remote state instead of a proposed message. Language: `.claude/rules.md` section 1.

## Push, PR, CI and merge

Read [pr-and-ci.md](references/pr-and-ci.md) before any push, PR, CI or merge request. Short form (the grants are owned by `.claude/rules.md` section 4): a normal push needs a clean tree and the exact branch and range; a PR needs the head already on the remote; the PR title and body follow `.github/pull_request_template.md` and state only what really ran; when CI on the PR ends, red or green, Main writes the result into the body's `CI result` section and stops; the CI jobs, which block and how to read a failure are in `pr-and-ci.md` (`gh pr checks --watch`); merge and auto-merge follow "Merge" in `pr-and-ci.md`. Who may fix CI, and how many rounds, is owned by `docs/agent-loops.md` Loop 3 and `.claude/rules.md` section 4.

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
