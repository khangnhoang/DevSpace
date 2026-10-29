# Future features — agent-workflow

Direction the Owner has set that is outside the scope of the current initiative. Work in an initiative's scope belongs in its plan.

## FEAT-007: Token budget rule

- Status: Deferred; the rule was cut down to "read deliberately" (`AGENTS.md` rule 6).
- Direction: revisit a fuller token-budget rule (VocaSpace Core Engineering Rule 6) only if the Owner sets budgets.
- Target program: none yet.

## FEAT-010: Evergreen program candidates

- Status: Recorded 2026-10-23; none is opened (U3 D9).
- Direction: each candidate becomes an evergreen program only when its condition holds and the Owner decides: Quality Engineering when `infrastructure` closes and hands over CI, the test suites and lint; Security Engineering when `security-hotfix` closes after H2-2, for RLS and grant review of new migrations and dependency audits; Design System when the `app-foundation` delivery program (ADR 0003) closes and hands over its shadcn components and form conventions; Reliability and Operations when there are real users or hosted backup and restore is needed; Performance Engineering when production data exists to monitor. Each charter states its boundary (an initiative belongs to exactly one program, ADR 0002) and does not invest in parts the techstack migration replaces (ADR 0001).
- Target program: agent-workflow

## FEAT-011: Performance rules and verification in the skills

- Status: Deferred by the Owner on 2026-10-23.
- Direction: skill rules and a way to verify that code is correct and performant, for example N+1 queries, unbounded queries and RLS policy patterns. The scope is decided when it is planned.
- Target program: agent-workflow

## FEAT-021: Automated-first test planning and test-data safety policy

- Status: Fixed locally, awaiting delivery ([U9 r1](implementation-plans/u9-test-policy/plan.md), 2026-10-29); CP1–CP3 implemented and author-reviewed, Main review pending. First of four follow-up PRs; no PR exists and remote delivery is not granted.
- Direction: make `test-quality-strategy` the single owner of automated-first selection and the shared test-data safety contract; align `frontend-workflow`, `planning`, QA matrix, server-action verification and review guidance with it. Derive observable behavior, invariants, edge cases, failure paths, permissions and concurrency where relevant from the task, then map each to unit, real-database/API integration or browser E2E at the smallest sufficient layer. Existing smoke/payment coverage and a missing pre-existing fixture must not become a ceiling on new tests. Require a concrete reason for manual-only checks; keep exploratory/design judgment and actual external-provider verification distinct from automatable application behavior. Avoid duplicate assertions while retaining tests for different boundaries, such as RLS versus endpoint authorization. Define fixture ownership, target/exclusive-use checks before writes or reset, scoped cleanup, failed-setup behavior, interrupted-run recovery and required use/extension of shared helpers. Document currently available mechanisms and known gaps honestly; do not prescribe a helper before the PR that adds it. The next PR implements this contract in helpers, the third adds bounded failure/concurrency coverage, and CI remains a separate fourth PR; see [backlog follow-ups](../../backlog/future-features.md) FEAT-022 to FEAT-024. This entry changes instructions only when implemented, not test code, CI, product behavior or hosted data.
- Target program: agent-workflow

## Closed

- FEAT-002 — Moved to [infrastructure](../infrastructure/future-features.md)
- FEAT-003 — Moved to [infrastructure](../infrastructure/future-features.md)
- FEAT-004 — Moved to [infrastructure](../infrastructure/future-features.md)
- FEAT-005 — Moved to [app-foundation](../app-foundation/future-features.md)
- FEAT-006 — Moved to [app-foundation](../app-foundation/future-features.md)
- FEAT-008 — Dropped: the `frontend-ui-review` skill; the Owner declined it (D4).
- FEAT-009 — Dropped: the Codex multi-agent skill (`native-multi-agent-workflow`) and the skill governance skill (`maintain-repo-skills`); they exist for Codex-only governance, which DevSpace does not use (D4). A DevSpace skill-authoring skill is U5 (charter decision 3).
