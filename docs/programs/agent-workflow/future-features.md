# Future features — agent-workflow

Direction the Owner has set that is outside the scope of the current initiative. Work in an initiative's scope belongs in its plan.

## AW-F1: Token budget rule

- Status: Deferred; the rule was cut down to "read deliberately" (`AGENTS.md` rule 6).
- Direction: revisit a fuller token-budget rule (VocaSpace Core Engineering Rule 6) only if the Owner sets budgets.
- Target program: none yet.

## AW-F2: Evergreen program candidates

- Status: Recorded 2026-10-23; none is opened (U3 D9).
- Direction: each candidate becomes an evergreen program only when its condition holds and the Owner decides: Quality Engineering when `infrastructure` closes and hands over CI, the test suites and lint; Security Engineering when `security-hotfix` closes after H2-2, for RLS and grant review of new migrations and dependency audits; Design System when the `app-foundation` delivery program (ADR 0003) closes and hands over its shadcn components and form conventions; Reliability and Operations when there are real users or hosted backup and restore is needed; Performance Engineering when production data exists to monitor. Each charter states its boundary (an initiative belongs to exactly one program, ADR 0002) and does not invest in parts the techstack migration replaces (ADR 0001).
- Target program: agent-workflow

## AW-F3: Performance rules and verification in the skills

- Status: Deferred by the Owner on 2026-10-23.
- Direction: skill rules and a way to verify that code is correct and performant, for example N+1 queries, unbounded queries and RLS policy patterns. The scope is decided when it is planned.
- Target program: agent-workflow

## AW-F4: Shared execution boundaries for exploration and independent roles

- Status: Fixed locally, awaiting delivery; paired with AW-P2 on `chore/agent-sessions-doc-links`, with separate commits and verification (Owner-approved 2026-10-29).
- Direction: put the tool-neutral lifecycle choice in `docs/agent-loops.md`: codebase exploration may use subagents; an independent implementor or reviewer should use a separate session/thread so the Owner can inspect its transcript and behavior. Preserve role/permission and single-writer ownership in `AGENTS.md`. The Owner's 2026-10-29 follow-up puts role-to-model and effort choices in `docs/agent-models.md`; Claude API/session bindings remain in `.claude/rules.md`. Do not infer a model override, new worktree, parallel writers or any additional permission; an unavailable session mechanism stays an explicit blocker. This is an Owner operating preference, not an unverified claim that subagents perform worse.
- Target program: agent-workflow.

## Closed

- FEAT-021 — Done: U9 establishes contract-based automated verification, safe fixture prerequisites and justified residual manual QA across instruction consumers (PR #39)

- FEAT-002 — Moved to [infrastructure](../infrastructure/future-features.md)
- FEAT-003 — Moved to [infrastructure](../infrastructure/future-features.md)
- FEAT-004 — Moved to [infrastructure](../infrastructure/future-features.md)
- FEAT-005 — Moved to [app-foundation](../app-foundation/future-features.md)
- FEAT-006 — Moved to [app-foundation](../app-foundation/future-features.md)
- FEAT-008 — Dropped: the `frontend-ui-review` skill; the Owner declined it (D4).
- FEAT-009 — Dropped: the Codex multi-agent skill (`native-multi-agent-workflow`) and the skill governance skill (`maintain-repo-skills`); they exist for Codex-only governance, which DevSpace does not use (D4). A DevSpace skill-authoring skill is U5 (charter decision 3).
