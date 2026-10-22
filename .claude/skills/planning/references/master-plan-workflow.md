# Master plan workflow

Read this when writing or materially revising a master plan for a multi-unit program. The `planning` skill owns the method; `program-docs` owns the shape and its template.

## Authoring

1. Read the Owner's request and the roadmap ADR. Separate confirmed facts, Owner decisions, assumptions, conflicts and open questions; for each material assumption, record the evidence and what would invalidate it.
2. Put the goal first, as an observable outcome and boundary. Mechanisms (tables, modules, APIs) belong in unit plans, not in the goal.
3. List Owner decisions, numbered and dated, one line each. Ask the Owner (`AskUserQuestion`) before writing anything the repo cannot answer.
4. Split into units by dependency and verification boundary. For each unit: outcome, hard or soft dependencies, and the gate to start or enable it (Owner approval, merge of another unit, a hosted rollout step).
5. Write the rollout order, including hosted steps and what must be true before each. Respect compatibility between old code, new code and the database (see `supabase-migration`).
6. Write shared invariants with the failure each prevents, program risks and explicit exclusions.
7. Keep State out of the plan: `progress.md` owns it, and the plan links to it.

## Revision

- A change to the goal, an Owner decision or the scope needs the Owner. An agent that finds such a need stops and asks; it does not rewrite the decision.
- When repository reality contradicts an approved master plan, pause the lower units, report the mismatch with evidence and the smallest correction that preserves the goal, and let the Owner decide.
- Lower-level detail changes (decomposition, hypotheses) do not reopen the master plan.

## Self-review

- Every Owner requirement maps to a unit; every unit maps to a requirement or a repository necessity.
- Every dependency and gate has evidence, or is marked unknown rather than assumed.
- Acceptance is observable and sits close to the unit that introduces the behavior.
- No material decision is deferred to the implementor.
- The plan ends at planning: it grants no implementation, git or hosted permission.
