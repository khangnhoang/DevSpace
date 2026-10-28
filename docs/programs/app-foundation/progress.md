# Progress — app-foundation

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r2 (2026-10-28), Codex plan gate PASS in round 2 (`gpt-6.1-sol`, high, read-only); approved by the Owner on 2026-10-28. |
| Current unit / checkpoint | none active; U1 has no detail plan yet. |
| Status | not started. |
| Completed evidence | Dependency check at the opening (2026-10-28, on `cf8c60b`): `npm outdated` lists only what dependency-maintenance FEAT-019, FEAT-020 and BL-009 already track, plus the Supabase CLI patch 2.121.0 to 2.122.0; `npm audit` and `npm audit --omit=dev` report the same 5 findings as BL-009. |
| Accepted deviations | FEAT-005 and FEAT-006 close in `docs/backlog/` without a `Moved to` line, against the wording of ADR 0003: `npm run docs:check` allows one `Moved` line per ID (`scripts/docs/check-structure.mjs:689-694`) and agent-workflow already holds one, so that line now points here directly. Both entries are held in `future-features.md` while they are planned, as infrastructure held FEAT-002 to FEAT-004, because the checker needs a moved entry to exist in a `future-features.md`. |
| Blockers / Owner decisions | none. |
| Next action | The Owner decides on push and the PR of this plan; after it merges, Main writes the U1 detail plan. |
| Current authority | A local commit of this plan on `docs/app-foundation-plan` (2026-10-28). Push, PR, merge and implementation are not granted. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-28 Program opened (ADR 0003): master plan r2 with Owner decisions 1 to 4, FEAT-005, FEAT-006 and BL-005 moved in, AF-001 recorded, opening dependency check run; Codex plan gate PASS in round 2, approved by the Owner (this commit).
