# Progress — dependency-maintenance

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [DM-U5](implementation-plans/dm-u5-node-26/plan.md) r6 closed (PR 52). No initiative plan open. |
| Current unit / checkpoint | none; DM-U5 closed (PR 52). |
| Status | DM-P2 delivered in PR 92 (`ee91948`): `next` and `eslint-config-next` 16.4.5. DM-U5 delivered in PR #52 (`84d3def`): production, every CI job and `@types/node` run Node 26, DM-F1 closed. DM-U4 delivered in PR #49 (`1bc9802`); DM-P1 open for group B only. |
| Completed evidence | DM-U3: PR 48 (`0666754`); DM-U4: PR 49 (`1bc9802`); DM-U5: PR 52 (`84d3def`); see milestones. |
| Accepted deviations | none open. |
| Blockers / Owner decisions | none. |
| Next action | The next initiative starts only on the Owner's request; DM-P1 group B, DM-F2 to DM-F5 and the `tailwindcss` with `@tailwindcss/postcss` and `@hookform/resolvers` patches of the 2026-11-05 dependency check stay open. |
| Current authority | none. |

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
- 2026-11-01 DM-U4 CP1: `monaco-editor` 0.57.0 is copied to `public/monaco/vs` by `postinstall` and `/try_it` loads it from the app's origin; the Monaco network exception is removed from the e2e guard; a clean `npm ci` recreates an identical copy, tsc, lint, build, unit tests and `npm run test:e2e` (61) pass (`bcadf5c`).
- 2026-11-01 DM-U4 CP2: "Thử ngay" opens a lesson example in its own language with the exact code (no second decode), a block in another language has no button, and the example returns on its own tab; `npm test` (293), `npm run test:e2e` (69, run twice) and build pass (`bf90da1`).
- 2026-11-01 DM-U4 CP3: the `dependency-updates` Monaco row, description and Dependency check, the charter capability line and DM-P1 say Monaco comes from the npm package; BL-P4 is `Fixed locally, awaiting delivery`; `npm audit --omit=dev` still reports `dompurify` and `monaco-editor` (2 findings), now for the running version (`62a48b5`).
- 2026-11-01 DM-U4 correction after the Codex diff gate: `tryItLanguage` matches own keys only, so `language-constructor` and `language-__proto__` get no Thử ngay button, and the routine JSDoc of the copy script is removed (`fd81c24`).
- 2026-11-01 DM-U4 Codex diff gate PASS in round 2 (round 1: one Required, inherited keys in the language lookup, fixed); manual pass on the local dev server: HTML and JavaScript links load the exact code and run, Monaco and its workers load from `/monaco/vs/`; C++ cannot run because the public Piston API refuses it (backlog BL-P5, predates DM-U4) (`eb6c89a`).
- 2026-11-01 DM-U4 merged: Monaco 0.57.0 served from `/monaco/vs/` and the BL-P4 Try It fixes, CI green; on the Vercel preview the editor and workers load from the app's origin and `loader.js` has `Cache-Control: public, max-age=0, must-revalidate` (PR 49, `1bc9802`).
- 2026-11-02 DM-U5 r5 approved after the Codex plan gate PASS in round 7: Node 26 for Vercel, CI (through `.node-version`) and `@types/node`, and the shared fnm rule (6580ebf).
- 2026-11-02 DM-U5 r6 approved after the implementor stopped before any edit: `fnm exec -- npm` cannot start the Windows `.cmd` shim, so AC8 and G1 use `npm.cmd` and `npx.cmd`; Codex plan gate PASS in round 8 (d685fdb).
- 2026-11-02 DM-U5 CP1: `@types/node` 26.6.6 (lockfile: `undici-types` 8.9.0, `peer` flags only otherwise), `.node-version` (`26`) read by all seven CI jobs through `node-version-file`, and the AC8 fnm rule in `AGENTS.md`; tsc, lint (0 problems), build, `npm run test:unit` (316) and `docs:check` pass on Node 26.13.0; the package, `.node-version` and CI change is 679b67a (76a5dd6).
- 2026-11-02 DM-U5 CP2: `npm test` (407) and `npm run test:e2e` (76, run twice) pass on Node 26.13.0 with every run ending `clean`; the `dependency-updates` Node row names `.node-version` and the Node 26 install-script behavior, DM-F1 is `Fixed locally, awaiting delivery`; Gemini and the Gmail send are not verified (d670b9e).
- 2026-11-02 DM-U5 Codex diff gate PASS in round 2 after round 1 found a stale DM-F1 Direction and a wrong `unrs-resolver` install-script claim, both corrected (caf0701).
- 2026-11-02 DM-U5 merged: Node 26 for production, CI and `@types/node`, CI green with every job on `v26.13.0` (run 41478507353); the preview and the production deployment of the merge (`dpl_FBUnv2RqfqrJMgPerGNKZdEz9FWG`) built on Node 26.x, reached Ready and serve `/monaco/vs/loader.js` with 200 without cookies; CI on `main` green (run 41480632624); DM-F1 closed (PR 52, `84d3def`).
- 2026-11-05 Closing dependency check of app-foundation on Node 26.13.0: `npm audit --omit=dev` still reports only DM-P1 group B (`monaco-editor` 0.57.0 is the latest release and bundles a vulnerable DOMPurify); `npm audit` adds 16 dev-only moderate findings of `minimatch` below 11.0.1 under the `eslint` chain, which npm fixes only with `--force`; patches waiting as one small task: `next` with `eslint-config-next` 16.4.5, `tailwindcss` with `@tailwindcss/postcss` 4.3.4, `@hookform/resolvers` 7.0.2; minors recorded as DM-F3 to DM-F5; the Supabase CLI 3.0.0 major added to DM-F2; `@playwright/test`, `prettier` and Node 26 are current; nothing installed (318feca).
- 2026-11-24 DM-P2: `next` 16.4.3 is in the range of seven moderate advisories (`<=16.4.4`), so its upgrade nudge stopped `next build` under an agent with `SecurityFatalError`; `next` and `eslint-config-next` updated to 16.4.5 (lockfile: only `next`, `eslint-config-next` and `@next/*`), the smallest fixed version, by the security-fix procedure without `next upgrade`. On Node 26.13.0 `npm run build` passes without the error, tsc, lint (0 problems), `npm run test:unit` (1079), `npm test` (1406) and `npm run test:e2e` (183) pass; the first `npm test` needed the Owner's removal of a QE-P11 stale writer record (PID 23660) and then had one `docs-only.test.ts` timeout (5274 ms of 5000) that the rerun passed; `npm audit` no longer lists `next` (`513d889`).
- 2026-11-24 DM-P2 merged: `next` and `eslint-config-next` 16.4.5 on `main` (PR 92, `ee91948`).
