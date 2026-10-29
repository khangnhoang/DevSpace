# Instruction audit

Read this before running or reporting an audit of the agent instructions. The audit is read-only: it classifies and proposes, and edits nothing.

## Procedure

1. **Scope.** `AGENTS.md`, `CLAUDE.md`, `.claude/rules.md`, `docs/agent-loops.md`, every project `SKILL.md` and every file under a project `references/`. For the vendored `playwright-cli`, only its DevSpace block under the H1.
2. **Classify each instruction** (a rule, a step or a fact a reader would act on) with exactly one of:
   - **in place**: its owner is right under "Choosing where an instruction goes" in `SKILL.md`;
   - **belongs elsewhere**: the load-time placement rule or the owner table puts it elsewhere; name the owner;
   - **duplicate or restatement**: another owner states it; name that owner;
   - **tooling that does not exist**: it describes a command, file or service the repo does not have;
   - **shape break**: it breaks a required rule of `npm run docs:check`; report the rule ID, subject to the allowlist in `scripts/docs/check-skills.mjs` (a recommended convention is never a shape break);
   - **provenance unknown**: no Owner decision or commit explains it (check `git log -S` and the program docs); do not guess a reason.
3. **Report** one table with `file:line`, the classification, the proposed owner and the reason. A proposed move is only a proposal: how a move is approved follows `AGENTS.md` section 4 (anything the Owner has not asked for in words) and section 6 (one question per decision).
4. **Edit nothing.** A Codex run of the audit uses the Codex brief in `code-review` ([codex-brief.md](../../code-review/references/codex-brief.md)).

## Evidence

Use `rg`, `git log` and `npm run docs:check` for factual questions (does the tool exist, who else states this, which rule fails). Use judgment only for placement and meaning. State what was not read.
