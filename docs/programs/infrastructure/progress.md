# Progress — infrastructure

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r2 (2026-10-22), master plan; r1 approved by the Owner 2026-10-22, r2 only renames the units (D11). |
| Current unit / checkpoint | U2 Local database and seed ([detail plan](implementation-plans/u2-local-db/plan.md) r2), CP1 on `chore/infra-local-db` |
| Status | Detail plan r2 approved by the Owner 2026-10-23 after the Codex plan gate PASS in round 3; CP1 handed to the Sonnet implementor |
| Completed evidence | Hosted catalog read-only on 2026-10-23 (in the plan, section 2). U1 (historical): PR 11 merged as `8f9ea0a`; push run 39822994019 on `main` passed all four jobs (lint log 81 problems); classic protection on `main` set by Main with the Owner's grant (contexts `typecheck`, `build`, `docs`, enforce admins on, no reviews, strict off) and read back; not yet tested with a failing PR |
| Accepted deviations | none for U2. U1 AC5 (historical): the lint step reports `success` under `continue-on-error`; the result is only in its log |
| Blockers / Owner decisions | none open; D13 (minimal seed) and D14 (`db` job blocks from U2) decided 2026-10-23. After CP1 the Owner runs the schema dump (runbook step 1) |
| Next action | The Sonnet implementor does CP1; Main reviews it, then the Owner runs the dump |
| Current authority | Implementation granted 2026-10-23: one Sonnet session implements, local commits only. Main: state records and local commits on `chore/infra-local-db`, read-only hosted catalog queries. Push, PR, merge, hosted writes and `migration repair` are not granted |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-22 Master plan r1 written, Codex plan gate PASS in round 2, approved by the Owner (`aa6e318`).
- 2026-10-22 Program created; agent-workflow entries AW-001 and FEAT-002 to FEAT-004, and backlog FEAT-001, moved in (`7969be9`).
- 2026-10-22 Plan PR merged (PR 7, `08f72f2`).
- 2026-10-22 Units renamed from I1-I7 to U1-U7 to follow the master-plan template (`435ca73`).
- 2026-10-22 U1 detail plan r2 written, Codex plan gate PASS in round 2, approved by the Owner (`139d35f`).
- 2026-10-23 U1 merged; push run on `main` passed and `main` protection set (PR 11, `8f9ea0a`).
- 2026-10-23 U2 detail plan r2 written, Codex plan gate PASS in round 3, approved by the Owner (this commit).
