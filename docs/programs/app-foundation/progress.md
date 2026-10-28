# Progress — app-foundation

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r2 (2026-10-28), Codex plan gate PASS in round 2 (`gpt-6.1-sol`, high, read-only); approved by the Owner on 2026-10-28. |
| Current unit / checkpoint | U1 (shadcn base and confirm dialog), [detail plan](implementation-plans/u1-confirm-dialog/plan.md) r3 on `feat/af-confirm-dialog`, approved by the Owner on 2026-10-29; CP1 (shadcn base) committed locally; next checkpoint CP2. |
| Status | U1 approved: trial install done (2026-10-29, on `4179bf5`, throwaway worktree removed); independent plan review (in place of Codex) PASS in round 3 on r3; CP1 implemented on `feat/af-confirm-dialog` (packages, `components.json`, two primitives, tokens, `ConfirmDialog`, `dependency-updates` rows); not yet reviewed by Main. |
| Completed evidence | Dependency check at the opening (2026-10-28, on `cf8c60b`): `npm outdated` lists only what dependency-maintenance FEAT-019, FEAT-020 and BL-009 already track, plus the Supabase CLI patch 2.121.0 to 2.122.0; `npm audit` and `npm audit --omit=dev` report the same 5 findings as BL-009. |
| Accepted deviations | FEAT-005 and FEAT-006 close in `docs/backlog/` without a `Moved to` line, against the wording of ADR 0003: `npm run docs:check` allows one `Moved` line per ID (`scripts/docs/check-structure.mjs:689-694`) and agent-workflow already holds one, so that line now points here directly. Both entries are held in `future-features.md` while they are planned, as infrastructure held FEAT-002 to FEAT-004, because the checker needs a moved entry to exist in a `future-features.md`. U1 plan gate (2026-10-29): Codex refused `gpt-6.1-sol` (`model_not_found` for a ChatGPT account), so at the Owner's instruction an independent Opus 5.5 session at medium effort, read-only, reviews the plan in its place, and the implementation diff the same way (Owner, 2026-10-29). AC7 screenshots: agents never sign in, so the implementor compared only the public pages (`/`, `/course/lam-quen-voi-html`, `/login`, light and dark OS scheme; identical before and after CP1) plus the compiled CSS (no rule removed or changed); the student lesson page and `/admin/transactions` comparisons against a baseline build of `4179bf5` are taken by Main with the Owner in the QA pass. |
| Blockers / Owner decisions | none. |
| Next action | A Sonnet implementor implements CP2 and CP3; Main reviews each checkpoint, then the Opus diff review runs after CP3. |
| Current authority | 2026-10-29: the U1 plan approved; a local commit of the plan; implementation of U1 with one local commit per checkpoint on `feat/af-confirm-dialog`. Push, PR and merge are not granted. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-28 Program opened (ADR 0003): master plan r2 with Owner decisions 1 to 4, FEAT-005, FEAT-006 and BL-005 moved in, AF-001 recorded, opening dependency check run; Codex plan gate PASS in round 2, approved by the Owner (PR 36, 46f70bf).
- 2026-10-29 U1 detail plan r3 approved after the trial install and an independent plan review PASS (this commit).
