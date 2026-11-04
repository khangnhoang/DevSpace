# Future features — agent-workflow

Direction the Owner has set that is outside the scope of the current initiative. Work in an initiative's scope belongs in its plan.

## AW-F1: Token budget rule

- Status: Deferred; the rule was cut down to "read deliberately" (`AGENTS.md` rule 6).
- Direction: revisit a fuller token-budget rule (VocaSpace Core Engineering Rule 6) only if the Owner sets budgets.
- Target program: none yet.

## AW-F2: Evergreen program candidates

- Status: Recorded 2026-10-23 (U3 D9); Quality Engineering opened on 2026-10-30 and Security Engineering on 2026-11-05 (ADR 0007), other candidates remain unopened.
- Direction: Quality Engineering was opened by the Owner on 2026-10-30; its capability and boundary live in its [charter](../quality-engineering/README.md). Security Engineering was opened by the Owner on 2026-11-05 when `security-hotfix` closed; its capability and boundary live in its [charter](../security-engineering/README.md) and [ADR 0007](../../adr/0007-security-engineering-program.md), and dependency audits stay with `dependency-maintenance`. The remaining candidates open only when their condition holds and the Owner decides: Design System when the `app-foundation` delivery program (ADR 0003) closes and hands over its shadcn components and form conventions; Reliability and Operations when there are real users or hosted backup and restore is needed; Performance Engineering when production data exists to monitor. Each charter states its boundary (an initiative belongs to exactly one program, ADR 0002) and does not invest in parts the techstack migration replaces (ADR 0001).
- Target program: agent-workflow

## AW-F3: Performance rules and verification in the skills

- Status: Deferred by the Owner on 2026-10-23.
- Direction: skill rules and a way to verify that code is correct and performant, for example N+1 queries, unbounded queries and RLS policy patterns. The scope is decided when it is planned.
- Target program: agent-workflow

## AW-F5: Harness hook that blocks dangerous database commands

- Status: Recorded 2026-11-01 by the Owner (QE-U3 planning); a later task after QE-U3.
- Direction: a Claude `PreToolUse` hook in `.claude/settings.json` refuses, before it runs:
  - a `supabase` command with `--linked`, `db push`, `link`, `--db-url` or `migration repair`;
  - `db reset` without the test-stack `--workdir`;
  - `psql` to a host other than `127.0.0.1`.
  It complements the identity check in the QE-U3 test tooling. It matches command text only, so a script that calls `supabase` internally is not caught. The `AGENTS.md` section 4 rules stay the owner of permissions, and the hook enforces part of them. Settings changes need the Owner's approval (`update-config`).
- Target program: agent-workflow

## Closed

- AW-F4 — Done: shared execution boundaries and role-to-model/effort selection delivered; runtime agent compliance remains unverified (PR #41)

- FEAT-021 — Done: U9 establishes contract-based automated verification, safe fixture prerequisites and justified residual manual QA across instruction consumers (PR #39)

- FEAT-002 — Moved to [infrastructure](../infrastructure/future-features.md)
- FEAT-003 — Moved to [infrastructure](../infrastructure/future-features.md)
- FEAT-004 — Moved to [infrastructure](../infrastructure/future-features.md)
- FEAT-005 — Moved to [app-foundation](../app-foundation/future-features.md)
- FEAT-006 — Moved to [app-foundation](../app-foundation/future-features.md)
- FEAT-008 — Dropped: the `frontend-ui-review` skill; the Owner declined it (D4).
- FEAT-009 — Dropped: the Codex multi-agent skill (`native-multi-agent-workflow`) and the skill governance skill (`maintain-repo-skills`); they exist for Codex-only governance, which DevSpace does not use (D4). A DevSpace skill-authoring skill is U5 (charter decision 3).
