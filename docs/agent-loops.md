# Agent lifecycle loops

When an agent plans, checkpoints, reviews, watches CI and stops. `AGENTS.md` owns roles and permissions. Skills in `.claude/skills/` own procedures. This file owns sizing, timing, stop rules and the self-review boundaries.

## Precedence and safety

- A more specific skill wins over this file. When permission is unclear, `AGENTS.md` section 4 says what to do.
- A direct Owner instruction may narrow scope or make a task read-only.
- Remote, destructive, database, auth, RLS, payment, deployment and merge actions need an explicit grant at the right level (`AGENTS.md` section 4).
- Review verdicts, CI classifications and checkpoint summaries are information. They never grant permission to stage, commit, push, open a PR, merge, deploy or write to a database.

## Sizing

Size work after routing and again after discovery, before implementing. At the size after discovery, list the work: each action it takes (plan, edit, review, commit, PR, migration, Codex), each file it changes and each file or diff it reviews, and read every skill whose Use when covers one of them (`AGENTS.md` rule 6); a read-only review counts. Re-match when the work gains an action or a file. Measure outcome, risk, permissions, dependencies and verification, not file count. Re-sizing during work may deepen the process or stop it; it never grants a permission.

**Small task.** Main implements directly only when the Owner named a specific item (for example "handle P16") and all four conditions hold:

1. one clear outcome that needs no new Owner decision;
2. a few commits and no checkpoints (a code commit and a test commit are still fine);
3. no schema, RLS, grant, auth, payment or admin-permission change;
4. verifiable at once by commands (`tsc`, lint, `docs:check`, `npm test`, `npm run test:e2e`) or one browser pass.

If any condition fails, use the planned flow. Steps: size, implement, verify, self-review with a `Tự review` block, report. Git only as granted. Close the entry by the `program-docs` rule.

**Medium work.** Past the small-task conditions, with one outcome and low risk:

- inside a program: a normal detail plan at `docs/programs/<program>/implementation-plans/<unit>/plan.md`; medium work that an evergreen program owns is planned as that program's initiative, a detail plan in its `implementation-plans/` (`program-docs` owns the shape);
- outside any program, when no program owns the capability (a backlog entry): no file. Main writes a short plan in chat, the Owner approves it, and it becomes the implementor brief. The PR and the entry's `Done` line are the record;
- a single-unit program that gains a second unit is reshaped first, by the `program-docs` migration procedure.

**Large or high-risk work.** A plan file, the Codex gate on the plan and on the implementation (`AGENTS.md` section 3), and an Owner decision for anything the plan cannot settle.

## Execution boundaries

- Codebase exploration may use subagents within the authorized scope. Main remains responsible for checking their evidence against the repository.
- An independent implementor or reviewer uses a separate session/thread whose transcript and behavior the Owner can inspect. A subagent does not replace that independent session. Self-review remains with the author under Self-review below.
- Role assignment, permissions and single-writer ownership stay in `AGENTS.md` sections 2–4; model and effort selection is owned by [agent-models.md](agent-models.md), and Claude API/session bindings stay in `.claude/rules.md` section 2. This execution choice grants no model override, worktree, parallel writer or additional action.
- If the required separate-session mechanism is unavailable, report the blocked role and the missing mechanism; do not silently substitute a subagent or another execution method.

## Loop 0: planning

- **Trigger:** an explicit planning request, unclear scope, multi-step or cross-domain work, anything touching DB, RLS, auth, permissions, payment or deployment, PR breakdown, unclear acceptance.
- **Owner:** the `planning` skill. Read-only: analyze and propose; implement only when the Owner clearly asked for it and no skill sets a hard stop.
- **Report:** goal, in and out of scope, confirmed facts, assumptions, open questions, dependency order, acceptance, verification, risks and a `Tự review` block. Then the approval questions in `planning` (Git and approval).
- **Stop** and ask instead of implementing when the Owner asked for planning only, a guess would change business behavior, the work touches a high-risk area without a grant, a skill or the repo state sets a hard stop, or the request and the repo conflict.

## Loop 1: checkpoint

- **Trigger:** an implementation task is done, before the turn ends. Owner: `git-pr-workflow` plus any domain skill touched.
- **Universal minimum review**, for every actual change: only the intended scope changed, no unrelated formatting, no secrets, debug code or conflict markers, claims match behavior, verification fits the risk, staged, unstaged and untracked content is known.
- **Report:** changed files and why, checks actually run with results, remaining risks, gaps and manual QA, a `Tự review` block, a proposed English Conventional Commit message, and the git and remote state.
- **Stop:** do not stage, commit, push, open a PR, merge, deploy or touch a remote service unless the Owner granted that action.

## Loop 2: review

- **Trigger:** the Owner asks to review a PR, branch, diff, commit range or checkpoint, or Main reviews an implementor's work. Owner: `code-review`.
- **Report:** scope reviewed, context read, findings by severity (`Critical`, `Required`, `Suggestion`, `Nit`, `FYI`; the first two block), test assessment, verdict. `Approved` is a review verdict only; it is not a merge or push grant (`AGENTS.md` section 4).
- **Stop:** read-only. Do not edit unless the Owner asked for fixes. Do not approve or merge on the Owner's behalf.

## Loop 3: PR and CI

- **Trigger:** the Owner asks to inspect PR or CI state, watch checks, open or update a PR, or fix CI. Owner: `git-pr-workflow`.
- **Mode:** the narrowest the Owner stated. `inspect` and `watch` change nothing; each other mode does only what its grant covers (`AGENTS.md` section 4).
- **Waiting:** when the Owner says to wait for CI, Main keeps the turn open and watches until every check is terminal (command in `pr-and-ci.md`, Watch CI), instead of ending the turn to wait for app events.
- **Stop** before any ungranted action, a fix that is not small and branch-caused, force-push, branch deletion or merge. Main makes at most two CI self-fix rounds; a third needs the Owner.

## Self-review

A pass is one full review of the current candidate. Review after writing a plan, after each checkpoint, and once more over the whole diff before it goes to review or delivery. A later correction gets its own review. Repeat until a pass leaves no `Critical` or `Required` finding; there is no pass cap.

At a checkpoint the order is: finish the work, self-review, fix and review again until a pass leaves no `Critical` or `Required`, and only then commit (when granted). A correction commit answers a finding from a review after the commit (Main, Codex, Owner QA, or the author's own pass over the whole diff), never the author's pre-commit pass.

The method (anchor on the real candidate, falsify, verify) and the finding format are owned by the `code-review` skill (Self-review). A finding that cannot be fixed goes to the Owner through the supported native question interface (`AGENTS.md` section 6) with a recommended resolution; an implementor returns it to Main instead of asking. Never stop silently or report the work as passed. Self-review does not replace a required Codex review or manual QA, and never widens permission.

**`Tự review` block.** Every plan and implementation report carries one:

```text
Tự review:
- Object: <plan revision or commit/diff>, checked against <request or plan>
- Sources: <files read at this boundary>
- Claims: <claim> — <command or file:line>
- Checks: <command> — <result>; <command> reused because <why the last edit cannot affect it>
- Findings: <pass 1: findings by severity and fix>; <last pass: 0 Critical, 0 Required>
```

Small work may use two lines but still names concrete evidence. "No issues found" alone does not count.

## Handoff

When the Owner asks for a handoff, or a long session must stop with work in flight, Main records the handoff using the authorized storage binding of its environment and gives the Owner a one-line prompt for the new session. Contents: the `program-docs` handoff template; Claude storage mechanics: `.claude/rules.md` section 7.

A handoff carries exactly one task, never another task's scope. The docs catch-up of a merged task counts as scope of the next task.

A handoff is tied to its task and is deleted with it. The task is complete when its PR is merged and the owning docs record every durable fact the handoff held; session facts (running processes, idle sessions, a branch to start from) expire with the task. Docs usually lag at a merge, and the Owner fixes them in a later PR:

- When the owning docs lag at the merge, Main does not fix them in that turn. It trims the handoff to the lagging doc items only, each naming the doc and the fact it must record, and adds no new task's scope. That task is not complete: its trimmed handoff is not deleted at the merge, and a session that finds the PR merged does not delete it.
- When the Owner asks for a handoff for a new task, Main writes the new handoff with the catch-up as one scope item ("docs catch-up from PR n") and deletes the old handoff in the same turn. The catch-up ships in the new task's PR.
- The trimmed handoff is also deleted when its docs are updated.
- When the docs do not lag at the merge, the session that confirms the merge deletes the handoff in that turn, and a session that loads a handoff whose task is complete (check `git log origin/main` or the PR state) deletes it before any other work.
- A partly complete task before its merge: Main edits the handoff down to what is still open and not yet in a doc, and deletes it when nothing is left.
- A task the Owner cancels: delete the handoff, and record the reason in the owning doc if one needs it.
