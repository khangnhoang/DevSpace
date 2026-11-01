# Progress — dependency-maintenance

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | DM-U3 `implementation-plans/dm-u3-audit-cleanup/plan.md` r1 (2026-11-01), written from a trial install; Codex plan gate PASS; Owner-approved 2026-11-01. DM-U2 r2 closed (PR 47). |
| Current unit / checkpoint | DM-U3 on `chore/dm-u3-audit-cleanup`; CP1 assigned to the implementor, CP1 and CP2 in one dispatch. |
| Status | DM-U2 delivered in PR #47 (`f900b18`); DM-U3 plan approved for DM-P1 groups A and C. |
| Completed evidence | DM-U2: PR 47 (`f900b18`), see milestones. DM-U3 trial (2026-11-01, plan section 2): `npm audit fix` plus the `postcss-selector-parser` override leave 2 production findings; `tsc`, lint, build and unit tests pass; the CSS of a clean build is unchanged. |
| Accepted deviations | none. |
| Blockers / Owner decisions | none. |
| Next action | The implementor runs CP1 and CP2; Main reviews the report and the commits. |
| Current authority | 2026-11-01: plan approval and local commits of the records and plan; implementation of DM-U3 r1 by a Sonnet implementor with one local commit per checkpoint and the local stack only. No push, PR, merge or hosted access is granted. |

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
- 2026-10-28 DM-002 fixed, closes when this PR merges: the `dependency-updates` skill gains the trial install and the type-only edit rule; the trial steps were run once on the baseline (`tsc`, lint and build pass) (3c29a26).
- 2026-10-28 DM-001 fixed, closes when this PR merges: six runtime packages with no import removed; tsc, lint and build pass, `npm test` 192 passed, `npm run test:e2e` 46 passed, `npm audit` unchanged at 5 findings (`115739e`).

- 2026-10-28 DM-001/002 merged: historical removal of six unused packages and the trial-install/type-only policy delivered; later features may reintroduce packages (PR 32, `1c99b77`).
- 2026-11-01 DM-U2 r2 approved for DM-P1's `nodemailer` finding after the Codex plan gate PASS: `nodemailer` 10.3.1 and removal of `@types/nodemailer` (`fba8027`).
- 2026-11-01 DM-U2 CP1 and CP2: `nodemailer` 10.3.1 installed and `@types/nodemailer` removed with no code edit; tsc, lint, build, `npm test` (263) and `npm run test:e2e` (60) pass, `npm audit --omit=dev` has no `nodemailer` finding (8 findings left), the Gmail SMTP send is not verified; DM-P1's `nodemailer` finding is fixed locally (`c01b360`).
- 2026-11-01 DM-U2 merged: `nodemailer` 10.3.1 without `@types/nodemailer`, CI green; DM-P1's `nodemailer` finding fixed; the Gmail SMTP send remains unverified (PR 47, `f900b18`).
- 2026-11-01 DM-U3 r1 approved for DM-P1 groups A and C after the Codex plan gate PASS: `npm audit fix` without `--force` and a `postcss-selector-parser` 6.1.5 override (this commit).
