# PR breakdown and Sonnet brief

Read this when splitting work into PRs or checkpoints, deciding whether streams can run in parallel, or writing the brief for the Sonnet implementor.

## Slicing

Pick the strategy the dependency graph needs: vertical (one complete safe behavior across layers), foundation-first, contract-first, migration-first, risk-first or docs-first. A PR or checkpoint is one coherent, reviewable outcome; it may span several files and layers when they serve one contract. Do not combine independent product changes, cleanup or different dependency chains. File and line counts are signals, not limits.

For each PR record: title and outcome; depends on; must merge before; parallel-safe or not; scope and out of scope; expected and untouched files or domains; binding guardrails; hypotheses; acceptance; automated checks; manual QA; risks; completion criteria.

Split a PR into checkpoints only when it helps review or resume. Each checkpoint finishes one logical increment with its own acceptance and verification, and leaves the repo coherent. Do not separate an implementation from its direct regression coverage just to get more checkpoints.

## Parallel work

Parallel only when prerequisites are met, contracts are stable, file and state ownership do not overlap, integration order is known and each stream has its own acceptance. Migrations, shared contracts, permission or status models and shared components are normally sequential.

## Brief for the Sonnet session

The plan file is the source of truth and wins on any conflict. The brief names it and adds only what the plan lacks. Do not restate the plan's scope or acceptance in new words.

Include:

- the plan path and revision, and the checkpoints to implement (hand over all of them in one dispatch; split only when a later checkpoint needs an Owner decision based on an earlier result);
- the authority: local commits only, English Conventional Commits, no push, PR or merge; never call the Supabase MCP; never read `.env*`;
- the sources to read first, including every matching skill;
- a database metadata snapshot when the work touches the database (the implementor cannot query it);
- files and domains not to touch; how to size the work if it grows (return to Main, do not widen scope);
- concerns the plan does not cover, stated as a risk to prove with the expected result;
- the report: per checkpoint the changed files and why, the checks run with exact results, a `Tự review` block, deviations from the plan, remaining risks, the commit list.

The implementor stops and reports on any mismatch with the plan, a missing decision, or a finding that needs the Owner; it does not ask the Owner itself.

After starting the session, check its effort with `get_session` and fix it with `set_session_effort` (`.claude/rules.md` section 2).
