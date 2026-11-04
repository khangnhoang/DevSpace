# Progress — app-foundation

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | Master `plan.md` r2 (2026-10-28), Codex plan gate PASS in round 2 (`gpt-6.1-sol`, high, read-only); approved by the Owner on 2026-10-28. [AF-U3](implementation-plans/af-u3-learner-forms/plan.md) r1 (2026-11-02), self-reviewed, no Codex gate (no server action, auth or permission change); approved by the Owner on 2026-11-02. [AF-U4](implementation-plans/af-u4-auth-forms/plan.md) r4 (2026-11-03), Codex plan gate PASS in round 4 (`gpt-6.1-sol`, high, read-only); approved by the Owner on 2026-11-03. [AF-U5](implementation-plans/af-u5-admin-content-forms/plan.md) r1 (2026-11-04), self-reviewed, no Codex gate (no server action, auth or permission change); approved by the Owner on 2026-11-04. [AF-U6](implementation-plans/af-u6-admin-user-forms/plan.md) r3 (2026-11-04), Codex plan gate PASS in round 4 (`gpt-6.1-sol`, high, read-only); approved by the Owner on 2026-11-04. |
| Current unit / checkpoint | none; U1 and AF-U2 to AF-U6 merged, every unit plan is closed. |
| Status | Completed (2026-11-05): every unit merged (AF-U6 last, PR 63, `c300dbf`), no open problem (AF-P7 resolved, AF-P3 moved to the backlog), AF-F1 done and AF-F2 moved to `ui-ux`; the backlog reviewed with the Owner and the closing dependency check recorded in `dependency-maintenance`. |
| Completed evidence | Delivered units, see milestones: U1 PR 38 (`572da83`), AF-U2 PR 51 (`d21f4fb`), AF-U3 PR 53 (`33db042`), AF-U4 PR 58 (`ab9a6a8`), AF-U5 PR 60 (`8384545`), AF-U6 PR 63 (`c300dbf`, CI run 41854027451 green). |
| Accepted deviations | none open. The per-unit deviations and Owner decisions of U1 to AF-U6, among them the Owner-accepted unverified Gemini path of U1 and the read-only email of the AF-U6 edit dialog, are recorded in this file at `c300dbf`. |
| Blockers / Owner decisions | none. Owner decisions 2026-11-05 (program close): AF-P3 moves to the backlog as BL-P17, AF-F2 moves to `ui-ux` as UX-F3, and every other backlog entry stays. |
| Next action | none; the program is closed. |
| Current authority | none. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-28 Program opened (ADR 0003): master plan r2 with Owner decisions 1 to 4, FEAT-005, FEAT-006 and BL-005 moved in, AF-001 recorded, opening dependency check run; Codex plan gate PASS in round 2, approved by the Owner (PR 36, 46f70bf).
- 2026-10-29 U1 detail plan r3 approved after the trial install and an independent plan review PASS (`eb6073c`).
- 2026-10-29 U1 test review: Auth lookups distinguish missing users from failures, cleanup checks Auth errors and verifies removal; 10 regression cases, 208 unit/RLS tests and two 60-row E2E runs passed with no E2E fixture residue; broader ownership deferred to FEAT-022, real Gemini verification blocked by expired key (`a4db804`).
- 2026-10-29 Owner accepted U1 closure with real Gemini execution unverified due to an expired key; FEAT-006 and P21 close, FEAT-005 retains its later-unit work, delivery conditional on green CI (PR 38).
- 2026-10-29 U1 merged after all required CI checks and Vercel passed; FEAT-006/P21 delivered with the Owner-accepted unverified Gemini limit, no next unit started (PR 38, 572da83).
- 2026-11-02 AF-U2 detail plan r2 approved after the trial install and the Codex plan gate PASS in round 3 (607b50f).
- 2026-11-02 AF-U2 CP1: `zod` ^4.6.7, the five actions parse their arguments with shared schemas in `lib/schemas/`, unit tests for schemas and action-level cases (50fd033).
- 2026-11-02 AF-U2 CP2: e2e rows `[V1]` to `[V7]` for the malformed-argument refusals and the admin user form, and the action caller's worker map extended to the users and lessons pages (0b8538e).
- 2026-11-02 AF-U2 CP3: `server-actions` describes the Zod rules, `test-quality-strategy` and `frontend-design` match the code, AF-F1 records the AF-U2 part (600cfcd).
- 2026-11-02 AF-U2 merged: the five actions parse their arguments with shared Zod schemas, Codex diff gate PASS in round 2 after `a97dc67`, CI green; AF-F1's AF-U2 part delivered (PR 51, `d21f4fb`).
- 2026-11-02 AF-U3 r1 approved by the Owner: React Hook Form, Zod resolver and shadcn controls for the four learner forms, AF-P4, no new length limits, BL-P7 kept separate (`fff1b13`).
- 2026-11-03 AF-U3 CP1: React Hook Form, the Zod resolver and six shadcn primitives added, schemas for the four learner forms with unit tests, the profile form on them, e2e rows F1, F9 and F10; AF-P4 fixed locally (`74f31a9`).
- 2026-11-03 AF-U3 CP2: the course review, lesson comment add and edit, and lesson note forms on React Hook Form, Zod and shadcn controls with field errors and a pre-await submit guard, e2e rows F2 to F8 and F11 (`8cbc40a`).
- 2026-11-03 AF-U3 CP3: the skills, the code map and AF-F1 describe React Hook Form, the Zod resolver, the field error pattern and the duplicate-submit guard (`cfe37a5`).
- 2026-11-03 AF-U3 M2 correction: `next/image` renders an avatar stored on a local Supabase Storage URL (local-only remote pattern and `dangerouslyAllowLocalIP` in `next.config.ts`), unit tests and e2e row F12 (`54d5196`).
- 2026-11-03 AF-U3 M2 correction 2: F12 removes only the exact object it uploaded, recorded from its upload request, and the skills state that one row uploads for real (`9391e26`).
- 2026-11-03 AF-U3 manual QA: the Owner passed M1 (the four forms at desktop and 375px, light and dark OS scheme) and M2 (a real avatar upload renders on the dev stack) after `9391e26`; Main reran `tsc`, lint, `test:unit` (372) and `test:e2e` (88) on Node 26.13.0 (`3ba0256`).
- 2026-11-03 AF-U3 merged after green CI (run 41508814576): the four learner forms on React Hook Form, the Zod resolver and shadcn controls; AF-P4 resolved and AF-F1's AF-U3 part delivered (PR 53, `33db042`).
- 2026-11-03 Small-task batch merged after green CI (run 41522963123): AF-P1 (fixed action error messages) and AF-P5 (profile transaction header and shadcn `Select`) resolved (PR 55, `9d6198c`).
- 2026-11-03 AF-U4 r4 approved by the Owner after the Codex plan gate PASS in round 4: the four auth forms on React Hook Form, Zod and shadcn, the phone rule tightened, sign-up errors in Vietnamese, per-flow outcome helpers without an auth layer (`dd927cd`).
- 2026-11-03 AF-U4 CP1: auth schemas with unit tests, the login page split into view components, sign in and forgot password on React Hook Form with per-flow result functions and submit helpers, e2e rows AU1, AU2, AU6 and AU9 for those views (`203d189`).
- 2026-11-03 AF-U4 CP2: sign up and reset password on React Hook Form with per-flow result functions and submit helpers, the phone rule tightened and unknown sign-up errors in Vietnamese, e2e rows AU3, AU4, AU5, AU7, AU8, AU10 and AU9 for sign up and reset (`afc4837`).
- 2026-11-03 AF-U4 CP3: the skills, the code map and BL-F2 describe the auth forms on React Hook Form and the automated M2 and M12 (`b8a7be3`).
- 2026-11-03 AF-U4 layout: route-private auth files moved into `_components/` and `_lib/` per the Owner's decision, and `frontend-workflow` states the convention (`dbf7666`).
- 2026-11-03 AF-U4 correction round 1 after the Codex diff gate: the view and step switch controls are disabled while a request is pending, AU9 proves the repeated Enter and the repeated `submit` in two phases from an idle form, State shows only the current unit, the reset route declares its own outcome types (`0ac7b18`).
- 2026-11-03 AF-U4 correction round 2 after the Owner's M1: the sign-up and forgot-password email rule is Zod's default email regex, and the reset page's expired-link toast has a fixed id so React StrictMode shows it once in dev (`250d0a0`).
- 2026-11-03 AF-U4 review: the Codex diff gate round 2 passed on `0ac7b18` and the Owner passed M1 (the look of the four forms) apart from the email rule, the double toast and two pre-existing issues (BL-P9, BL-P10) (`12940bc`).
- 2026-11-03 AF-U4 correction round 3: State matches the review outcome and the email unit test title says what it checks (`8323572`).
- 2026-11-03 AF-U4 review closed: Codex diff gate PASS in round 4 on `dfaf7a6`; the Owner re-checked the stricter email rule and the single expired-link toast on the dev stack (`1d9c1df`).
- 2026-11-03 AF-U4 merged after green CI (run 41651413110): the four auth forms on React Hook Form, the Zod resolver and shadcn controls, the phone rule tightened, sign-up errors in Vietnamese (PR 58, `ab9a6a8`).
- 2026-11-04 AF-U5 r1 approved by the Owner: the four admin content forms on React Hook Form, Zod and shadcn, the AI bulk create checked before saving (AF-P2), no slug rule (BL-P12) (`1cab557`).
- 2026-11-04 AF-U5 CP1: schemas for the course, chapter, lesson and exercise forms with unit tests, the course and chapter forms on React Hook Form, Zod and shadcn controls, e2e rows C1 to C4, H1 to H4 and D1 (`8d81a51`).
- 2026-11-04 AF-U5 CP2: the lesson and exercise forms on React Hook Form, Zod and shadcn controls, the AI fill and bulk-create handlers checked and awaited (AF-P2 fixed locally), e2e rows L1 to L4, E1 to E4 and D1 (`cde5407`).
- 2026-11-04 AF-U5 CP3: `frontend-workflow`, `frontend-design`, `test-quality-strategy` and the `AGENTS.md` code map say the admin content forms use React Hook Form (`0028243`).
- 2026-11-04 AF-U5 correction after Main review: the courses client page moved into the route's `_components/` as `CoursesClient.tsx`, no behavior change (`92f47fc`).
- 2026-11-04 AF-U5 correction after the Owner's QA: opening or closing the lesson panel resets the exercise form to a blank add form on the "Thông tin" tab (a question being edited no longer follows the Owner to another lesson), the course dialog's title bar sticks flush to the top, and the three dialog close controls are named 40px buttons; e2e rows C5, H5 and E5 (`d608e7a`).
- 2026-11-04 AF-U5 correction after the Owner's QA: filling the exercise form with an AI question switches it to add mode, so it no longer overwrites the question that was being edited; e2e row E6 fakes the action's answer in the browser (`711e210`).
- 2026-11-04 AF-U5 merged after green CI (run 41720595909): the four admin content forms on React Hook Form, the Zod resolver and shadcn controls, the AI bulk create awaited; AF-P2 resolved and BL-P11 closed (PR 60, `8384545`).
- 2026-11-04 Quality-engineering QE-U4 replaces the "one rejected field" e2e row per form with the integration-boundary rule (decision 5) and moves e2e row C2 of the course form to component tests (`35cc3c4`).
- 2026-11-04 Quality-engineering QE-U4 merged: client-only form rules are tested by component tests, AF-P6 resolved (PR 61, `78c80ba`).
- 2026-11-04 AF-U6 r3 approved after the Codex plan gate PASS in round 4: the admin user forms on React Hook Form with a form schema derived from `createUserSchema`, a role limited to `user` or `admin` (AF-P7), and e2e rows only for integration boundaries (c78b8ff).
- 2026-11-04 AF-U6 CP1: `createUserFormSchema` and `editUserFormSchema` derive from `createUserSchema`, `UserFormDialog` replaces the users page's controlled modal, and 26 component tests cover AC2 to AC6. AC9 mutations, each failing the named tests and reverted: email `aria-invalid` removed (3 fail), password `min(8)` to `min(1)` (1), validation resolver removed (11); stored bad role loaded as is (1), the role enum accepting `""` (2), the role `aria-invalid` removed (2); in-flight guard removed (3), close buttons not disabled while pending (2), submit button not disabled while pending (2) (dd4b33e).
- 2026-11-04 AF-U6 correction after Main review of CP1: the dialog role moved from the `<form>` to the card `div`, since ARIA in HTML allows no dialog role on a form (e3ade8e).
- 2026-11-04 AF-U6 CP2: e2e rows U1 to U6 in `admin-user-forms.spec.ts` cover the edit write with a faked upload, the action's refusal of an email in use, a failed upload, a create request and an edit `PATCH` that fail in transit, and an admin create with a faked upload; `npm run test:e2e` passed twice (143 of 143) and `npm test` once (716 of 716) (6d98fdc).
- 2026-11-04 AF-U6 CP3: `server-actions` states the rule that a form posting to a server action derives its schema from the action's and sends the action's input shape; AF-P7 is `Fixed locally, awaiting delivery` and AF-F1 records its last part as done locally, awaiting the PR (4c50e0f).
- 2026-11-04 AF-U6 corrections after the Codex diff gate: the user dialog is keyed by its user, takes focus on open, keeps Tab inside, returns focus to its opener and leaves the page behind it `inert`; the avatar picker is a named button reachable by keyboard; U1 asserts the Tab containment in Chromium (ff9fbc8).
- 2026-11-04 AF-U6 correction after Main's review of ff9fbc8: U2 and U5 assert in Chromium that cancelling returns focus to the button that opened the dialog, since jsdom does not implement `inert`; removing the restore call fails both rows (d78cdbb).
- 2026-11-04 AF-U6 correction after the Codex diff round 2: the dialog card sets `text-white font-sans` again, because the dialog now sits outside the page `div` that carried them and its title and `Hủy Bỏ` took the dark foreground of a light OS scheme; U2 asserts both are white under `colorScheme: light` (bd049c2).
- 2026-11-04 AF-U6 correction after Main's dev-stack pass: the dialog keeps its opener in a ref read once, so React StrictMode's second mount in `next dev` no longer takes the focused name field as the opener and focus returns to the opener on close; a component test renders it under `StrictMode` with a disabled opener (e5e026b).
- 2026-11-04 AF-U6 Owner decision during QA: in the edit dialog the email is read-only text with the caption `EMAIL` instead of a disabled input, so it keeps normal contrast and takes no focus; create is unchanged and the save still never sends the email (`363aba2`).
- 2026-11-04 AF-U6 merged after green CI (run 41854027451): the admin user forms on React Hook Form with a schema derived from `createUserSchema` and a role limited to `user` or `admin`; AF-P7 resolved and AF-F1 done (PR 63, `c300dbf`).
- 2026-11-05 Program closed: AF-P3 moved to the backlog as BL-P17, AF-F2 moved to `ui-ux` as UX-F3, the backlog reviewed with the Owner (every other entry stays), the closing dependency check recorded in `dependency-maintenance` (this commit).
