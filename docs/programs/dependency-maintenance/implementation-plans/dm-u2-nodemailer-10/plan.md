# DM-U2 detail plan — nodemailer 10

Revision: r2, 2026-11-01. Owner approval: 2026-11-01, after the Codex plan gate PASS. Master plan or charter: [charter](../../README.md) (Initiatives row DM-U2).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the production mail path (`lib/email.server.ts`, called by `approvePayment` in `app/action/payment.ts`) runs on `nodemailer` 10.3.1, the high `nodemailer` finding of DM-P1 is gone from `npm audit --omit=dev`, `@types/nodemailer` is removed because nodemailer 10 ships its own types, and the e2e mail record and network guard still stop every real send. No product behavior changes.

| ID | Observable result |
| --- | --- |
| AC1 | `package.json` lists `"nodemailer": "^10.3.1"` and no `@types/nodemailer`; `npm ls nodemailer` resolves 10.3.1; no other entry of `package.json` changes, and the lockfile changes only what npm needs for these two edits. |
| AC2 | `npm audit --omit=dev` and `npm audit` report no `nodemailer` finding; every other finding is one already recorded in DM-P1 (section 2), none new. |
| AC3 | `npx tsc --noEmit`, `npm run lint` (0 problems) and `npm run build` pass after the last edit. |
| AC4 | `npm test` and `npm run test:e2e` pass on the local stack after `npx supabase db reset`, with counts not lower than the baseline (263 and 60). The unit rows of `__tests__/unit/server-guard.test.ts` pass against the installed nodemailer 10, including the row where a `service: "gmail"` send is refused at name resolution. |
| AC5 | In `npm run test:e2e`, the existing mail assertions pass unchanged: one recorded mail in `[AP1]`, `[AP3]`, `[AP5]` and the first approval of `[K6]` and `[K7]` (`payment-admin.spec.ts`); none in `[AP2]`, `[AP4]`, `[AP6]`, `[H5]` and the `payment-learner.spec.ts` file-level check. In every row the `serverRecords` fixture records no refused name resolution or connection. Known limits kept as they are: the second `[K6]` mail count runs under known bug P25, and `[K8]` approves without a mail assertion, so only the network refusal check covers it. |
| AC6 | On the PR, all CI jobs run and pass. |
| AC7 | Records: DM-P1 says the `nodemailer` finding is fixed (by this PR once merged), State and the DM-U2 row in this program, and the changelog notes (breaking changes of 8, 9 and 10 and their effect, section 2) in the report and the PR body. |

### 1.2 Scope and non-goals

- In scope: `nodemailer` 7.0.13 to 10.3.1; removing `@types/nodemailer` (D2); the lockfile change npm makes for them; the AC7 records.
- Non-goals:
  - any edit of `lib/email.server.ts`, `app/action/payment.ts`, `__tests__/e2e/server-mail.cjs`, `__tests__/e2e/server-guard.cjs` or other code or tests, type-only edits included: the trial needed none (section 2), so a needed edit is new evidence and stops the work (G2);
  - a real Gmail send before merge: `npm run dev` replaces the mail credentials with placeholders (`buildDevEnv`, `__tests__/helpers/dev-env.ts`), and changing that launcher is out of scope;
  - the other DM-P1 findings (Monaco, `dompurify`, `@tailwindcss/typography`, the `eslint-config-next` chain) and the in-range findings first seen today (section 2): they stay in DM-P1;
  - the Node version (DM-F1), `npm audit fix`, `npm update`, any other package.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Install with `npm install nodemailer@10.3.1` and remove with `npm uninstall @types/nodemailer`; never `npm update`, `npm audit fix` or `--force`. Confirm with `npm ls nodemailer` and `git diff package.json`. | Unlisted packages move, or a range other than `^10.3.1` lands. |
| G2. Any failing check, the e2e mail record failing to patch the bundled `Mailer#sendMail` (`server-mail.cjs` throws "N nodemailer sendMail definitions"), or a needed edit of any file outside `package.json`, `package-lock.json` and the AC7 records stops the implementor; it reports to Main and edits nothing else. | The mail guard is weakened or rewritten inside a version bump, and a test run could reach Gmail. |
| G3. Nothing reaches hosted or Gmail: local stack only. | An update test sends a real mail or writes to production. |
| G4. If 10.3.1 is no longer the latest 10.x when work starts, stop and report the new version to Main instead of choosing. | The plan's trial no longer covers the installed code. |

### 1.4 Owner decisions that bind this initiative

- Charter decisions 1 to 3: this program owns the work; `nodemailer` is a runtime library on the payment path (`approvePayment` sends the mail), so DM-U2 gets a detail plan and the Codex gate on its plan and on its diff.
- D1 (2026-11-01) The Owner chose `nodemailer` 10 as the DM-P1 work on a new branch (`chore/dm-u2-nodemailer-10`); the Monaco review stays a later task. The same branch carries the QE-P1 docs catch-up from PR #46 (committed `8b54616`).
- D2 (2026-11-01) The Owner chose to remove `@types/nodemailer` instead of moving it to 8.0.2: nodemailer 10 ships its own declarations, `tsc` resolves them (section 2), and two type sources for one package can disagree.

## 2. Repository facts

Baseline: `3e4b941`, checked 2026-11-01 (`npm audit`, `npm view`, trial install).

- `nodemailer` is used only by `lib/email.server.ts`: `createTransport({ service: "gmail", auth })` at module scope and `transporter.sendMail({ from, to, subject, html })` in `sendSuccessEmail`, which catches every error. Its one caller is `approvePayment` (`app/action/payment.ts:293`) — bounds the scope and the failure mode in section 5.
- `npm run dev` starts `next dev` with `buildDevProcessEnv`, which overrides `GMAIL_USER` and `GMAIL_PASS` with placeholders (`__tests__/helpers/dev-env.ts:24-25`), and the e2e server stops `sendMail` before the transport — so no local path sends through Gmail; justifies the Gmail non-goal and the section 5 risk.
- Mail assertions in the e2e rows at `3e4b941`: `payment-admin.spec.ts` lines 48, 86, 146, 188, 203 (one mail), 68, 108, 171 (none), 196 (`[K6]`, inside `bug(...)` for P25), `[K8]` at line 213 with none; `payment-learner.spec.ts` lines 45 and 190 (none). `server-mail.cjs` returns a chunk without the nodemailer marker unchanged and throws for a marked chunk without exactly one definition (lines 27, 46-50) — justifies AC5 and G2.
- `npm audit --omit=dev` on the baseline: 9 findings (1 low, 6 moderate, 1 high, 1 critical). The high one is `nodemailer` `<=10.1.3` (20 advisories, among them GHSA-c7w3-x93f-qmm8 SMTP command injection); npm's fix installs 10.3.1, the latest release. The others: `dompurify` critical and `monaco-editor` low (DM-P1); `@tailwindcss/typography` and `postcss-selector-parser` moderate (DM-P1); `glob`, `minimatch`, `rimraf`, `gaxios` moderate through `@google/genai` 1.52.0 → `google-auth-library` → `gaxios` → `rimraf` → `glob` → `minimatch`, new since the 2026-10-27 check and fixable in range. `npm audit` (with dev): 24 findings — justifies AC2 and the DM-P1 record update.
- Changelog breaking changes from 7.0.13 to 10.3.1: 8.0.0 renames the error code `NoAuth` to `ENOAUTH`; 9.0.0 validates TLS certificates by default when fetching remote content (attachment URLs, OAuth2 token endpoints, proxy CONNECT); 10.0.0 requires Node 20 or newer and moves to a TypeScript build with ESM and CommonJS outputs (`dist/`), keeping the `@types/nodemailer` type layout. The app reads no error code, sends no attachment, uses no OAuth2 or proxy; production runs Node 22.x (Vercel, DM-F1), CI and the Owner's machine Node 24 — justifies "no product behavior change" and the non-goals.
- Trial install (`git worktree add --detach` at `8b54616`, which differs from the baseline only in QE docs; `npm ci`; `npm install nodemailer@10.3.1 @types/nodemailer@8.0.2`; removed afterwards): `npx tsc --noEmit`, `npm run lint` and `npm run build` (CI placeholder env) passed with no edit. After `npm uninstall @types/nodemailer`, `tsc` and lint still passed; `tsc --explainFiles` resolves `node_modules/nodemailer/dist/**/*.d.ts` — justifies D2 and AC3.
- In the trial build, exactly one server chunk carries nodemailer's `Sending mail using %s/%s` marker, and it is the nodemailer 10 code (it holds `releaseStreams`, absent from 7.0.13). `patchMailerSource` from `server-mail.cjs` found exactly one `sendMail(data, callback = null)` definition in it and inserted the mail-record call. nodemailer 10 keeps that signature and the `this.transporter.getSocket` marker in both `dist/esm` and `dist/cjs` — justifies AC5 and G2.
- In the trial, `npx vitest run --project unit __tests__/unit/server-guard.test.ts` passed 23/23 against nodemailer 10, including the row that refuses a `service: "gmail"` send at name resolution; `npm audit --omit=dev` reported 8 findings with no `nodemailer` — justifies AC2 and AC4.
- Baseline counts: `npm test` 263 and `npm run test:e2e` 60 (quality-engineering QE-U2, 2026-11-01) — justifies AC4.

## 3. Bounded implementation hypotheses

- One local commit for the update and removal, `chore(deps): update nodemailer to 10 and drop @types/nodemailer`, and one `docs(dependency-maintenance): ...` commit for the records — may change if each commit still holds the package change with its lockfile.
## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | `nodemailer` 10.3.1 installed and `@types/nodemailer` removed (AC1). | `npm ls nodemailer`; `npx tsc --noEmit`, `npm run lint`, `npm run build`; `npm run test:unit`. |
| CP2 | Full verification and records (AC2 to AC5, AC7). | `npx supabase db reset`, `npm test`, `npm run test:e2e` with the AC5 rows named in the report; `npm audit` and `npm audit --omit=dev`; DM-P1, State and the DM-U2 row; the report states the Gmail SMTP send as not verified. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The ESM/CJS rebuild in 10.0.0 changes how Turbopack bundles nodemailer, so the e2e mail record no longer finds `sendMail` and a test could reach Gmail. | Three independent layers: the rewrite throws for a marked chunk without exactly one definition; the positive AC5 assertions fail if no mail is recorded (an unmarked or unpatched chunk records nothing); the network guard refuses the Gmail lookup and connection and fails the row. The trial build patched exactly one definition, and G2 stops the work if that changes. |
| The Gmail SMTP path (service lookup, TLS, auth) behaves differently under nodemailer 10. No planned check exercises it: every local path uses placeholder credentials or stops before the transport. | Not verified before merge, and the report says so. The unit guard row proves `service: "gmail"` still resolves to an SMTP host lookup. The first real send is the first production approval after deploy; a failure there is logged as `Lỗi gửi email` with the payment still approved (`sendSuccessEmail` catches), and the fix is a revert of the PR. |
| Removing `@types/nodemailer` changes types the app relies on. | Trial `tsc` passed without it; the bundled declarations keep the `@types` layout (10.0.0 changelog). |
| Production Node 22 is older than CI Node 24. | nodemailer 10 needs Node 20 or newer; both qualify. |

- Rollout runbook: none; no hosted step. Vercel deploys the new version when the PR merges.
- Stop when: G2 or G4 triggers; a check fails twice after an in-scope fix.
- Rollback: revert the PR; nothing hosted changes.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
