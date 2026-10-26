# Codex brief

Read this before running, resuming or briefing a Codex review. Which work Codex reviews, and that Main runs it and decides on its findings, is owned by `.claude/rules.md` section 3.

## Running Codex

Run it from the Bash tool. In PowerShell `codex` resolves to a blocked `codex.ps1`:

```bash
codex exec - -m gpt-6.1-sol -c model_reasoning_effort='"high"' -c sandbox_mode='"read-only"' -o <out> < <prompt>
```

Later rounds of the same review: `codex exec resume <id> -` with the same flags, `-o` and stdin. Resume does not keep the first round's flags, so repeat them and check the log header. A new target gets a fresh session. If resume fails on a thread-store conflict (another Codex thread holds the writer), do not start a competing session: give the Owner the round prompt to paste into the thread that holds it.

## Template

```text
Read first (in this order, completely):
1. CLAUDE.md
2. .claude/rules.md
3. docs/agent-loops.md
4. .claude/skills/<skill>/SKILL.md for each skill whose Use when covers the target's work (`docs/agent-loops.md`, Sizing): <list>
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

- Codex loads neither `.claude/rules.md` nor the skills, so every brief starts with a "Read first" list of the rules and skills that apply (the Template section). For a later round (Running Codex), the prompt lists what changed since the last round.
- Give it the real files or diff, not a summary. A plan under review that is not committed is given as the working-tree file and a diff.
- Main checks each finding against the repo; Codex output is advisory until verified. Loop until PASS, and ask the Owner only when a finding needs a new decision.
- A migration review (when it is required: `.claude/rules.md` section 3) covers the SQL, the rollback, RLS and grants, and the rollout order.
