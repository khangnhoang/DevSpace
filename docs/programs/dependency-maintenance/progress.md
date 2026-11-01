# Progress — dependency-maintenance

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | DM-U4 `implementation-plans/dm-u4-monaco-self-host/plan.md` r1 (2026-11-01), written from a trial install; Codex plan gate PASS in round 2 (round 1: four Required on the install hook, worker and crafted-link checks and manual data, fixed); Owner-approved 2026-11-01. DM-U3 r1 closed (PR 48). |
| Current unit / checkpoint | DM-U4 on `fix/dm-u4-monaco-self-host`; CP1 done locally, CP2 and CP3 next (one dispatch). |
| Status | DM-U3 delivered in PR #48 (`0666754`); DM-P1 groups A and C fixed, group B open; DM-U4 r1 written. |
| Completed evidence | DM-U3: PR 48 (`0666754`), see milestones. DM-U4 trial (2026-11-01, plan section 2): Monaco 0.57.0 copied from the npm package to `public/monaco/vs` loads on `next start` with no request off the origin; `tsc`, lint and build pass. |
| Accepted deviations | (1) G3 expected `monaco-editor` to lose the lockfile `peer` flag; npm 11 keeps it on direct dependencies that are also peers; no version change. (2) Windows e2e builds timed out on the ownership gate because `joinRun` resolved process ancestry inside it; fixed in DM-U4 by resolving it before the gate, outside plan section 1.2 (Owner decision 2026-11-01). |
| Blockers / Owner decisions | none. |
| Next action | The implementor runs CP2 and CP3; Main reviews the report and the commits, then runs the manual pass. |
| Current authority | 2026-11-01: new branch for DM-U4 (BL-P4 included, Owner decision D1), its trial install and plan, one read-only hosted query counting code-fence languages (D3), the PR 48 docs catch-up, plan approval and a local commit of the plan and records; implementation of DM-U4 r1 by a Sonnet implementor with one local commit per checkpoint and the local stack only. No push, PR, merge or hosted access is granted. |

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
- 2026-11-01 DM-U3 r1 approved for DM-P1 groups A and C after the Codex plan gate PASS: `npm audit fix` without `--force` and a `postcss-selector-parser` 6.1.5 override (`00981f8`).
- 2026-11-01 DM-U3 CP1: `npm audit fix` without `--force` (`gaxios` 7.3.1, `rimraf` chain removed, `typescript-eslint` 8.72.1) and the `postcss-selector-parser` 6.1.5 override; tsc, lint, build and 173 unit tests pass, the CSS of a clean build is byte-identical to the baseline (`0af8fda`).
- 2026-11-01 DM-U3 CP2: `npm test` (263) and `npm run test:e2e` (60) pass, `npm audit --omit=dev` reports only `dompurify` and `monaco-editor` (group B); DM-P1 groups A and C fixed locally, AI Magic through `gaxios` 7.3.1 not verified (the Gemini key is not renewed) (`26b976b`).
- 2026-11-01 DM-U3 Codex diff gate PASS on `40bef4b..26b976b` with no findings (`37ed5d1`).
- 2026-11-01 DM-U3 merged: `gaxios` 7.3.1 and the `postcss-selector-parser` 6.1.5 override, CI green; DM-P1 groups A and C fixed, AI Magic not verified (PR 48, `0666754`).
- 2026-11-01 DM-U4 r1 approved after the Codex plan gate PASS in round 2: Monaco self-hosted from the npm package and the BL-P4 Try It fixes in one PR (`a9c0c72`).
- 2026-11-01 DM-U4 gate fix: `joinRun` resolves process ancestry before taking the ownership gate, so the seven `next build` workers no longer time out on Windows; `npm test` (267) passes (`82fee44`).
- 2026-11-01 DM-U4 CP1: `monaco-editor` 0.57.0 is copied to `public/monaco/vs` by `postinstall` and `/try_it` loads it from the app's origin; the Monaco network exception is removed from the e2e guard; a clean `npm ci` recreates an identical copy, tsc, lint, build, unit tests and `npm run test:e2e` (61) pass (this commit).
