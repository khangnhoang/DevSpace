# Codex brief

Read this before writing or resuming a Codex review. Command and flags: `.claude/rules.md` section 3. Codex has no skill routing and loads no rules file, so the brief carries what it needs.

## Template

```text
Read first (in this order, completely):
1. CLAUDE.md
2. .claude/rules.md
3. docs/agent-loops.md
4. .claude/skills/<skill>/SKILL.md for each skill that matches the target: <list>
5. The plan: <path and revision>

Role: read-only reviewer. Do not edit files, run the app, call the database or any network service, or read .env*.

Target: <plan revision | commit range <baseline>..<head> | working-tree file plus `git diff <last committed revision>`>
Scope and exclusions: <from the plan>
Acceptance to check: <ids from the plan>
Known facts you cannot query: <database metadata snapshot, hosted state, if relevant>

Review for: <correctness against the plan; the dimensions that fit: RLS and grants, rollout order, auth and ownership in actions, state transitions, scope creep, claims versus evidence>.
Report findings with severity (Critical, Required, Suggestion, Nit, FYI), file:line evidence and the smallest correction, then a verdict: PASS or CHANGES REQUIRED. State what you could not verify.
```

## Rules

- Session and resume mechanics are in `.claude/rules.md` section 3. For a later round, the prompt lists what changed since the last round.
- Give it the real files or diff, not a summary. A plan under review that is not committed is given as the working-tree file and a diff.
- Main checks each finding against the repo; Codex output is advisory until verified. Loop until PASS, and ask the Owner only when a finding needs a new decision.
- Every migration goes through Codex before it is applied. The review covers the SQL, the rollback, RLS and grants, and the rollout order.
