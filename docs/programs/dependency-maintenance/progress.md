# Progress — dependency-maintenance

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | U1 `implementation-plans/u1-in-range-updates/plan.md` r1 (2026-10-27), Codex plan gate PASS in round 2, 0 Critical and 0 Required (session `01a17ce0-d194-7dd1-8e1a-d9ce3c722e65`), approved by the Owner on 2026-10-27; r2 (D4, a type-only test edit for `@supabase/supabase-js` 2.118.0), Codex PASS in round 4 of the same session, approved by the Owner on 2026-10-27; r3 (G7 type-only edits, D5), Codex PASS in round 5 of the same session, approved by the Owner on 2026-10-27. |
| Current unit / checkpoint | U1 In-range patch and minor updates, on branch `chore/deps-in-range-updates`; CP1 to CP5 done; manual QA M4 to M9 passed, M10 not run (Gemini key expired); DM-003 fixed and re-checked in the browser; Codex diff gate PASS. |
| Status | U1 in progress on `chore/deps-in-range-updates`; first dependency check recorded (2026-10-27, on `3ea4a09`). |
| Completed evidence | First dependency check: 17 packages behind within their major, the 16 of U1 section 2 and the Supabase CLI (2.122.0 available, kept at 2.121.0, U1 D2); `npm outdated` also lists the majors of FEAT-020 and BL-009, `@types/node` (FEAT-019) and `@supabase/ssr` (ADR 0001); `@playwright/test` 1.64.1 and `next` 16.4.3 are the latest; the Monaco CDN is 0.55.1 against 0.57.0 (BL-009); `npm audit` unchanged (BL-009); six runtime packages with no import (DM-001). |
| Accepted deviations | The DM-003 fix in `app/components/SidebarContent.tsx` is outside plan section 1.2 and G2; the Owner accepted it on 2026-10-27 without a plan revision. |
| Blockers / Owner decisions | none. D5 (2026-10-27): the Owner chose a general type-only edit rule, G7, over a plan revision per error; DM-002 records the missing trial install. |
| Next action | Push and PR (separate Owner grants); CI on the PR, then the PR body records it (AC6, AC7). |
| Current authority | The Owner approved U1 plan r1, r2 and r3 and granted its implementation with one local commit per checkpoint (2026-10-27). Push, PR and merge are separate grants. |

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
- 2026-10-27 U1 DM-003 re-checked by Main on the dev server: no sidebar console error at desktop and 375x812 width (mobile menu opened, closed and reopened), and a local `user_progress` insert refreshed every mounted sidebar; Codex diff gate PASS on 4a1202d..c251710 (this commit).
