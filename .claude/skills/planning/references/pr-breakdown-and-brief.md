# PR breakdown and Sonnet brief

Read this when splitting work into PRs or checkpoints, deciding whether streams can run in parallel, or writing the brief for the Sonnet implementor.

## Slicing

Pick the strategy the dependency graph needs: vertical (one complete safe behavior across layers), foundation-first, contract-first, migration-first, risk-first or docs-first. A PR or checkpoint is one coherent, reviewable outcome; it may span several files and layers when they serve one contract. Do not combine independent product changes, cleanup or different dependency chains, except as a batch that `planning` (Workflow, Dependencies and PR split) allows. File and line counts are signals, not limits.

For each PR record: title and outcome; depends on; must merge before; parallel-safe or not; scope and out of scope; expected and untouched files or domains; binding guardrails; hypotheses; acceptance; automated checks; manual QA; risks; completion criteria.

Split a PR into checkpoints only when it helps review or resume. Each checkpoint finishes one logical increment with its own acceptance and verification, and leaves the repo coherent. Do not separate an implementation from its direct regression coverage just to get more checkpoints.

## Parallel work

Parallel only when prerequisites are met, contracts are stable, file and state ownership do not overlap, integration order is known and each stream has its own acceptance. Migrations, shared contracts, permission or status models and shared components are normally sequential.

## Brief for the Sonnet session

The plan file is the source of truth and wins on any conflict. The brief names it and adds only what the plan lacks. Do not restate the plan's scope or acceptance in new words.

Include:

- the plan path and revision, and the checkpoints to implement (hand over all of them in one dispatch; split only when a later checkpoint needs an Owner decision based on an earlier result);
- the authority the Owner granted (for example local commits per checkpoint, as English Conventional Commits); the standing limits, no push, PR or merge, no Supabase MCP and no `.env*`, are owned by `.claude/rules.md` section 4;
- the sources to read first, including every skill whose Use when covers the work the brief hands over (`docs/agent-loops.md`, Sizing);
- a hosted database metadata snapshot when the work touches the database (the implementor cannot reach hosted: `.claude/rules.md` section 4);
- files and domains not to touch; how to size the work if it grows (return to Main, do not widen scope);
- concerns the plan does not cover, stated as a risk to prove with the expected result;
- the report: per checkpoint the changed files and why, the checks run with exact results, a `Tự review` block, deviations from the plan, remaining risks, the commit list.

The implementor stops and reports on any mismatch with the plan, a missing decision, or a finding that needs the Owner; it does not ask the Owner itself.

After starting the session, check and fix its effort as `.claude/rules.md` section 2 (Roles) says.
