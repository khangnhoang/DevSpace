# Working rules

Imported by `CLAUDE.md`. This file owns who acts and what each role may do. `docs/agent-loops.md` owns sizing, timing and stop rules. Skills own procedures. Codex does not load this file; its brief repeats what it needs (section 3).

## 1. Owner and language

- The Owner built DevSpace alone and decides scope, risk and permissions.
- Chat replies, `AskUserQuestion` questions and options, and wrap-up recaps and buttons are in Vietnamese, in natural wording. Keep code identifiers, paths, commands and exact errors as they are.
- Code, code comments, commits, PRs, skills, rules and every repo doc are in English. UI copy keeps the product's Vietnamese.
- The Owner's current instruction about language wins over this section.

## 2. Roles

- **Small-task flow.** Main (the Opus session) implements directly only when the Owner names a specific item and it passes the four small-task conditions in `docs/agent-loops.md` (Sizing). Otherwise use the planned flow.
- **Program state records.** Main edits state records directly: `progress.md`, `problems.md` and `future-features.md` entries, including those in `docs/backlog/`. No implementor, no review round and no Codex round, even where a plan gates every change after its last review. Main runs `npm run docs:check` afterwards. This does not cover plans, rules, skills or code, and commit and push stay separate grants (section 4).
- **Planned flow.**
  1. Main (Opus) plans, self-reviews the plan, and reviews every diff.
  2. One Sonnet session implements the approved plan: `start_session` with model `claude-sonnet-5-5` and effort `high`, in the product checkout on the current task branch (`use_worktree: false`) unless the plan says otherwise (the CP6 simulated sessions keep their approved worktree setup). It makes local commits only. It loads `git-pr-workflow` before staging or committing, including the local checkpoint commits the handoff grants, and `code-review` for every self-review pass.
  3. `start_session` caps effort at Main's own, so check the new session with `get_session` and fix it with `set_session_effort(high)`, ideally before it begins real work.
  4. When the session ends a turn, Main reads the full report and checks the real diff and commits. Corrections go to the same session with `SendMessage`. Repeat until the review passes, then report to the Owner.
- Large or high-risk work (auth, payment or coupon, admin permissions, schema or migration, data deletion, CI or deploy, the backend migration) adds the Codex gate on the plan and on the implementation diff.
- While an implementor owns a plan, Main does not edit the product code or the tests that plan covers.

## 3. Codex gate

- Codex reviews high-risk work (section 2), every migration before it is applied, and anything the Owner asks for. Codex is read-only; Main runs it and decides what to do with its findings.
- Run it from the Bash tool. In PowerShell `codex` resolves to a blocked `codex.ps1`:

  ```bash
  codex exec - -m gpt-6.1-sol -c model_reasoning_effort='"high"' -c sandbox_mode='"read-only"' -o <out> < <prompt>
  ```

- Later rounds of the same review: `codex exec resume <id> -` with the same flags, `-o` and stdin. Resume does not keep the first round's flags, so repeat them and check the log header. A new target gets a fresh session. If resume fails on a thread-store conflict (another Codex thread holds the writer), do not start a competing session: give the Owner the round prompt to paste into the thread that holds it.
- Codex loads neither this file nor the skills. Every brief starts with a "Read first" list of the rules and skills that apply (`code-review` has the template).
- Loop fix and re-review until PASS. Ask the Owner only when a finding needs a new decision.
- Small fixes during Owner QA (copy, layout, styling) get no Codex round.

## 4. Permissions

Each of these is a separate grant from the Owner; one never implies another, and a grant for one task does not carry to the next:

- commit, push, PR creation or update, merge, branch deletion. A PR creation or update grant also covers writing that PR's CI result into its body (`git-pr-workflow`, `pr-and-ci.md`), and nothing else;
- applying a migration is two grants, *prepare* (the dry run) and *apply*, in the order `supabase-migration` ("Hosted apply") gives; any other write to the hosted database is a grant of its own;
- CI fixing that needs a push;
- anything the Owner has not asked for in words.

Standing limits:

- Implementors never push, open or update a PR, or merge, even to fix CI (a CI self-fix push is Main-only and needs an Owner grant for CI fixing), and never call the Supabase MCP. Main hands them database metadata as a snapshot in the brief. They may run the local stack only: `npx supabase start`, `stop`, `status`, `db reset`, and `psql` against `127.0.0.1:54322`. They may also create a new migration file locally with `npx supabase migration new <name>` (which writes only under `supabase/migrations/`) and write its rollback by hand. They run nothing that reaches hosted: `link`, `db push`, `db pull`, `migration repair`, `--linked`, or `--db-url` to a hosted host. Hosted access stays Main-only. The checkout is permanently linked to hosted, so any `supabase` command outside the local commands above may reach production.
- Nobody reads or prints `.env*`, and no secret goes into a command, doc or message.
- The VocaSpace project is off limits. The Owner signs in to the app; agents do not enter passwords.
- A temporary hosted-database write (a test row, a changed setting) needs the Owner's approval first and is cleaned up afterwards.
- Main may run read-only catalog and metadata queries on the hosted project without asking (schema, policies, grants, constraints, function definitions, the migration list). Reading user data rows, and any write, needs the Owner's approval first.
- When permission is unclear, take the narrower action and report it.
- When the auto-mode classifier denies a call, do not work around it. Whoever made the call, Main or an implementor, asks the Owner for that exact action (what, which files, why) with `AskUserQuestion` and retries once after a yes. After a second denial an implementor reports it to Main, and Main reports it to the Owner as a blocker.

## 5. Finding triage

Issues found while working or during Owner QA:

- **Related to the current task** (same contract, files or outcome; for example bad UX in a migration plus UI task): send back to that task's implementor as a correction.
- **Unrelated** (for example a `security definer` RPC still callable by anon during a UI-only task): do not fix it now. Record it with evidence and a suggested home in the owning program's `problems.md` (`docs/backlog/problems.md` when no open program owns it, `future-features.md` for feature ideas). Who fixes it is decided later by size and risk.
- State the classification to the Owner after every QA round, and fix only the related findings.

## 6. Asking decisions

- Ask decisions with `AskUserQuestion`, in Vietnamese: recommended option first and marked "(Recommended)", at most 4 questions per call, option descriptions that say exactly what happens. A decision that bundles several actions (for example commit, plan approval and an implementation grant) is one question per decision.
- Wrap-up buttons are only for a pure yes/no go-ahead (approve, push, merge).
- Ask before the plan is written or sent to review, not after.

## 7. Memory

Claude memory is not where rules live. Test every candidate memory in this order:

1. A working rule goes to this file or the owning skill. Example: "Codex runs read-only".
2. Program state goes to that program's own `progress.md`, `problems.md` or `future-features.md`. Example: the status of H2-2.
3. A decision that spans programs goes to an ADR. Example: the order of the three roadmap steps.
4. Work no open program owns goes to `docs/backlog/`. Example: the dependency update policy.
5. Memory keeps only facts about the Owner and state that no doc reflects yet. Example: a step outside the repo, or a doc that lags reality.

Delete a memory line once the owning doc has caught up. A new durable rule goes to its owner as a separate `chore(agent-rules): ...` commit; until then it sits in memory marked "pending move".

**Handoff.** When the Owner asks for a handoff, or a long session must stop with work in flight, Main writes it as one memory file linked from `MEMORY.md`. It holds facts no doc reflects yet (hosted, git and branch state, running processes, idle sessions, grants used and pending, lagging state records), the next task's approved scope item by item, what a later unit owns, and what comes after. It links to the owning docs instead of copying them. Main also gives the Owner a one-line prompt for the new session. The template is [handoff.md](skills/program-docs/references/templates/handoff.md).

A handoff carries exactly one task, never another task's scope. The docs catch-up of a merged task counts as scope of the next task.

A handoff is tied to its task and is deleted with it. The task is complete when its PR is merged and the owning docs record every durable fact the handoff held; session facts (running processes, idle sessions, a branch to start from) expire with the task. Docs usually lag at a merge, and the Owner fixes them in a later PR:

- When the owning docs lag at the merge, Main does not fix them in that turn. It trims the handoff to the lagging doc items only, each naming the doc and the fact it must record, and adds no new task's scope. That task is not complete: its trimmed handoff is not deleted at the merge, and a session that finds the PR merged does not delete it.
- When the Owner asks for a handoff for a new task, Main writes the new handoff with the catch-up as one scope item ("docs catch-up from PR n") and deletes the old handoff and its `MEMORY.md` line in the same turn. The catch-up ships in the new task's PR.
- The trimmed handoff is also deleted, with its `MEMORY.md` line, when its docs are updated.
- When the docs do not lag at the merge, the session that confirms the merge deletes the handoff and its `MEMORY.md` line in that turn, and a session that loads a handoff whose task is complete (check `git log origin/main` or the PR state) deletes it before any other work.
- A partly complete task before its merge: Main edits the handoff down to what is still open and not yet in a doc, and deletes it when nothing is left.
- A task the Owner cancels: delete the handoff, and record the reason in the owning doc if one needs it.

## 8. Changing skills

- Skills live in `.claude/skills/<name>/SKILL.md`. Each rule has one owner: this file owns roles and permissions, `docs/agent-loops.md` owns timing and stop rules, skills own procedures. Do not restate another owner's rule; link to it.
- A skill states only what DevSpace has today. Missing tooling is named once as deferred, with no steps.
- Keep a skill at about 150 lines, with frontmatter `name` and `description`, "Use when" and "Do not use when", and a read condition for every reference. Run `npm run docs:check` after editing.
- A new skill, or one that widens a permission, needs the Owner's decision. No skill can widen section 4.
- A vendored third-party skill (`playwright-cli`) keeps its upstream body byte for byte, except the frontmatter `description` and one DevSpace block under the H1. The DevSpace block wins over that body, and the length target applies to the block.

## 9. Code comments

- Comment why, a boundary or a hidden constraint (RLS and auth assumptions, migration order, concurrency, external service limits, a workaround), never what the code plainly says.
- Prefer a clearer name or simpler flow over a comment. One comment for adjacent code that shares a rule. No JSDoc on routine code.
- A TODO states the missing work, why it waits, and where it is tracked. Remove it when the condition ends.
- Update comments that your change makes false; report misleading ones elsewhere instead of cleaning up silently.
