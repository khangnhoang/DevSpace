# Future features — agent-workflow

Direction the Owner has set that is outside the scope of the current initiative. Work in an initiative's scope belongs in its plan.

## FEAT-007: Token budget rule

- Status: Deferred; the rule was cut down to "read deliberately" (`CLAUDE.md` rule 6).
- Direction: revisit a fuller token-budget rule (VocaSpace Core Engineering Rule 6) only if the Owner sets budgets.
- Target program: none yet.

## FEAT-010: Evergreen program candidates

- Status: Recorded 2026-10-23; none is opened (U3 D9).
- Direction: each candidate becomes an evergreen program only when its condition holds and the Owner decides: Quality Engineering when `infrastructure` closes and hands over CI, the test suites and lint; Security Engineering when `security-hotfix` closes after H2-2, for RLS and grant review of new migrations and dependency audits; Design System when the foundation PR with shadcn, Zod and React Hook Form has merged, taking FEAT-005 and FEAT-006; Reliability and Operations when there are real users or hosted backup and restore is needed; Performance Engineering when production data exists to monitor. Each charter states its boundary (an initiative belongs to exactly one program, ADR 0002) and does not invest in parts the techstack migration replaces (ADR 0001).
- Target program: agent-workflow

## FEAT-011: Performance rules and verification in the skills

- Status: Deferred by the Owner on 2026-10-23.
- Direction: skill rules and a way to verify that code is correct and performant, for example N+1 queries, unbounded queries and RLS policy patterns. The scope is decided when it is planned.
- Target program: agent-workflow

## Closed

- FEAT-002 — Moved to [infrastructure](../infrastructure/future-features.md)
- FEAT-003 — Moved to [infrastructure](../infrastructure/future-features.md)
- FEAT-004 — Moved to [infrastructure](../infrastructure/future-features.md)
- FEAT-005 — Moved to [backlog](../../backlog/future-features.md)
- FEAT-006 — Moved to [backlog](../../backlog/future-features.md)
- FEAT-008 — Dropped: the `frontend-ui-review` skill; the Owner declined it (D4).
- FEAT-009 — Dropped: the Codex multi-agent skill (`native-multi-agent-workflow`) and the skill governance skill (`maintain-repo-skills`); they exist for Codex-only governance, which DevSpace does not use (D4).
