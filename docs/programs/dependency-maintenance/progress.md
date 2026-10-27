# Progress — dependency-maintenance

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | U1 `implementation-plans/u1-in-range-updates/plan.md` r3 (2026-10-27), closed; no initiative has an open plan. |
| Current unit / checkpoint | none active. |
| Status | U1 merged (PR 31, 2026-10-27). |
| Completed evidence | U1: CI on PR 31 green at `60edc82` (typecheck, build, docs, lint, db 192 passed, e2e 46 passed; run 40503679316). Historical, first dependency check (2026-10-27, on `3ea4a09`): `npm outdated` lists the majors of FEAT-020 and BL-009, `@types/node` (FEAT-019) and `@supabase/ssr` (ADR 0001); the Monaco CDN is 0.55.1 against 0.57.0 (BL-009); `npm audit` unchanged (BL-009); six runtime packages with no import (DM-001). |
| Accepted deviations | none. |
| Blockers / Owner decisions | none. |
| Next action | Main: DM-002 and DM-001 as small tasks, batched in one PR. |
| Current authority | The Owner granted local commits for DM-002, DM-001 and this catch-up on `chore/dm-001-002` (2026-10-28). Push, PR and merge are not granted; the Codex gate on the implementation comes before any push. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-27 Program opened (ADR 0004): charter, FEAT-019, FEAT-020 and BL-009 moved from the backlog, first dependency check recorded, DM-001 and the U1 plan r1 written, Codex plan gate PASS in round 2, approved by the Owner (82db821).
- 2026-10-27 U1 CP1: React group updated to 19.3.1 and its types to 19.3.0; tsc, lint and build pass (c447f19).
- 2026-10-27 U1 CP2: Tailwind group updated to 4.3.3 and tailwind-merge to 3.7.0; tsc, lint and build pass, anonymous pages match the baseline screenshots (79cecdf).
- 2026-10-27 U1 CP3 stopped under G2: `@supabase/supabase-js` 2.118.0 fails `npx tsc --noEmit` in `__tests__/rls/content.test.ts`; plan r2 adds D4, Codex PASS, approved by the Owner (c01b9ac).
- 2026-10-27 U1 CP3: `@supabase/supabase-js` updated to 2.118.0 with the D4 type-only edit of `__tests__/rls/content.test.ts`; tsc, lint, build, `npm test` (192 passed) and `npm run test:e2e` (46 passed) pass (2af7fea).
- 2026-10-27 U1 CP4 stopped under G2: `recharts` 3.10.1 fails `npx tsc --noEmit` in `app/components/TransactionChart.tsx`; plan r3 adds G7 and D5, Codex PASS, approved by the Owner; DM-002 opened (f55cfae).
- 2026-10-27 U1 CP4: `@google/genai`, `@radix-ui/react-slot`, `@uiw/react-md-editor`, `date-fns`, `recharts`, `sonner`, `eslint` and `@types/nodemailer` updated, with the G7 edit of the Tooltip `formatter` annotation in `TransactionChart.tsx`; tsc, lint and build pass, anonymous pages match the baseline screenshots (bba29e3).
- 2026-10-27 U1 CP5 automated checks: `npm test` 192 passed, `npm run test:e2e` 46 passed, `npm outdated` and both `npm audit` runs match AC2 and AC3 (327cb5a).
- 2026-10-27 U1 manual QA by Main with the Owner's sign-in: M4 to M9 passed (M8 tooltip "Số lượng : 1 học viên" through the G7 formatter edit), M10 not run (the Owner's Gemini key has expired); DM-003 found and fixed (c7c8da4); Codex diff gate PASS on 4a1202d..164b9c7 with one Nit, fixed (ea69dc3).
- 2026-10-27 U1 DM-003 second cause: each sidebar realtime effect run gets its own topic, because the desktop and mobile sidebars were mounted together and shared one channel, fixed in e753175 (c251710).
- 2026-10-27 U1 DM-003 re-checked by Main on the dev server: no sidebar console error at desktop and 375x812 width (mobile menu opened, closed and reopened), and a local `user_progress` insert refreshed every mounted sidebar; Codex diff gate PASS on 4a1202d..c251710 (60edc82).
- 2026-10-27 U1 merged: in-range patch and minor updates with CI green; DM-003 resolved (PR 31, `0e8ed24`).
