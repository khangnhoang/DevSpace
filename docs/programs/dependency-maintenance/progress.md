# Progress — dependency-maintenance

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | DM-U2 `implementation-plans/dm-u2-nodemailer-10/plan.md` r2 (2026-11-01), written from a trial install; Codex plan gate PASS; Owner-approved 2026-11-01. U1 r3 closed. |
| Current unit / checkpoint | DM-U2 CP1 and CP2 done on `chore/dm-u2-nodemailer-10` (implementor); waiting for Main's diff review and the Codex diff gate. |
| Status | DM-U2 implemented locally; checks green; not pushed. |
| Completed evidence | DM-U2 trial (2026-11-01, plan section 2): with `nodemailer` 10.3.1 and without `@types/nodemailer`, `tsc`, lint and build pass, the e2e mail record patches the bundled `sendMail`, the server-guard unit file passes 23/23, and `npm audit --omit=dev` has no `nodemailer` finding. DM-U2 CP1 and CP2 (2026-11-01): the same holds on the branch, plus `npm test` 263 and `npm run test:e2e` 60 passed after `npx supabase db reset`, with the AC5 mail rows green. |
| Accepted deviations | none. |
| Blockers / Owner decisions | none open. |
| Next action | Main reviews the diff and runs the Codex diff gate; push and PR need the Owner's grants. |
| Current authority | 2026-11-01: new branch, the DM-U2 trial install and plan, the QE-P1 docs catch-up with one local commit (`8b54616`); plan approval, one local plan commit, and implementation by a separate implementor with local checkpoint commits. Local stack commands only; no push, PR, merge or hosted access. |

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
