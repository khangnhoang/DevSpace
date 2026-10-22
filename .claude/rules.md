# Working rules

Imported by `CLAUDE.md`. This file owns who acts and what each role may do. `docs/agent-loops.md` owns sizing, timing and stop rules. Skills own procedures. Codex does not load this file; its brief repeats what it needs (section 3).

## 1. Owner and language

- The Owner built DevSpace alone and decides scope, risk and permissions.
- Chat replies, `AskUserQuestion` questions and options, and wrap-up recaps and buttons are in Vietnamese, in natural wording. Keep code identifiers, paths, commands and exact errors as they are.
- Code, code comments, commits, PRs, skills, rules and every repo doc are in English. UI copy keeps the product's Vietnamese.
- The Owner's current instruction about language wins over this section.

## 2. Roles

- **Small-task flow.** Main (the Opus session) implements directly only when the Owner names a specific item and it passes the four small-task conditions in `docs/agent-loops.md` (Sizing). Otherwise use the planned flow.
- **Planned flow.**
  1. Main (Opus) plans, self-reviews the plan, and reviews every diff.
  2. One Sonnet session implements the approved plan: `start_session` with model `claude-sonnet-5-5` and effort `high`. It makes local commits only.
  3. `start_session` caps effort at Main's own, so check the new session with `get_session` and fix it with `set_session_effort(high)`, ideally before it begins real work.
  4. When the session ends a turn, Main reads the full report and checks the real diff and commits. Corrections go to the same session with `SendMessage`. Repeat until the review passes, then report to the Owner.
- Large or high-risk work (auth, payment or coupon, admin permissions, schema or migration, data deletion, CI or deploy, the backend migration) adds the Codex gate on the plan and on the implementation diff.
- While an implementor owns a plan, Main does not edit the product code that plan covers.

## 3. Codex gate

- Codex reviews high-risk work (section 2), every migration before it is applied, and anything the Owner asks for. Codex is read-only; Main runs it and decides what to do with its findings.
- Run it from the Bash tool. In PowerShell `codex` resolves to a blocked `codex.ps1`:

  ```bash
  codex exec - -m gpt-6.1-sol -c model_reasoning_effort='"high"' -c sandbox_mode='"read-only"' -o <out> < <prompt>
  ```

- Later rounds of the same review: `codex exec resume <id> -` with the same flags, `-o` and stdin. Resume does not keep the first round's flags, so repeat them and check the log header. A new target gets a fresh session.
- Codex loads neither this file nor the skills. Every brief starts with a "Read first" list of the rules and skills that apply (`code-review` has the template).
- Loop fix and re-review until PASS. Ask the Owner only when a finding needs a new decision.
- Small fixes during Owner QA (copy, layout, styling) get no Codex round.

## 4. Permissions

Each of these is a separate grant from the Owner; one never implies another, and a grant for one task does not carry to the next:

- commit, push, PR creation or update, merge, branch deletion;
- applying a migration and any write to the hosted database;
- CI fixing that needs a push;
- anything the Owner has not asked for in words.

Standing limits:

- Implementors never push, even to fix CI (a CI self-fix push is Main-only and needs an Owner grant for CI fixing), and never call the Supabase MCP. Main hands them database metadata as a snapshot in the brief.
- Nobody reads or prints `.env*`, and no secret goes into a command, doc or message.
- The VocaSpace project is off limits. The Owner signs in to the app; agents do not enter passwords.
- A temporary hosted-database write (a test row, a changed setting) needs the Owner's approval first and is cleaned up afterwards.
- When permission is unclear, take the narrower action and report it.
- When the auto-mode classifier denies a call, do not work around it. Ask the Owner for that exact action (what, which files, why) with `AskUserQuestion`, retry once after a yes, and report a second denial to Main as a blocker.

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

## 8. Changing skills

- Skills live in `.claude/skills/<name>/SKILL.md`. Each rule has one owner: this file owns roles and permissions, `docs/agent-loops.md` owns timing and stop rules, skills own procedures. Do not restate another owner's rule; link to it.
- A skill states only what DevSpace has today. Missing tooling is named once as deferred, with no steps.
- Keep a skill at about 150 lines, with frontmatter `name` and `description`, "Use when" and "Do not use when", and a read condition for every reference. Run `npm run docs:check` after editing.
- A new skill, or one that widens a permission, needs the Owner's decision. No skill can widen section 4.

## 9. Code comments

- Comment why, a boundary or a hidden constraint (RLS and auth assumptions, migration order, concurrency, external service limits, a workaround), never what the code plainly says.
- Prefer a clearer name or simpler flow over a comment. One comment for adjacent code that shares a rule. No JSDoc on routine code.
- A TODO states the missing work, why it waits, and where it is tracked. Remove it when the condition ends.
- Update comments that your change makes false; report misleading ones elsewhere instead of cleaning up silently.
