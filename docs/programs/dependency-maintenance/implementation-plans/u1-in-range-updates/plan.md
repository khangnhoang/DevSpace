# U1 detail plan — In-range patch and minor updates

Revision: r2, 2026-10-27 (r1 approved 2026-10-27; r2 adds D4). Owner approval: 2026-10-27. Master plan or charter: [charter](../../README.md) (Initiatives row U1).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: every package that the first dependency check (2026-10-27) found behind within its current major is updated to the version in section 2, except the Supabase CLI (D2), with the full suite, CI and a manual pass green, and no product behavior change.

| ID | Observable result |
| --- | --- |
| AC1 | `package.json` and `package-lock.json` resolve exactly the target versions of section 2 for the 16 packages listed there, each range written as `^<target>` (the style of the neighbouring entries); no other entry of `package.json` changes. |
| AC2 | After the change, `npm outdated` lists only: the Supabase CLI (`supabase` 2.121.0, D2), `@supabase/ssr` (auth helper, ADR 0001), `@types/node` (FEAT-019) and the majors of FEAT-020 and BL-009 (`typescript`, `eslint` 10, `lucide-react`, `@google/genai` 2, `nodemailer`, `@types/nodemailer` 8). |
| AC3 | `npm audit` and `npm audit --omit=dev` report no finding that is not already in BL-009. |
| AC4 | `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`, `npm test` and `npm run test:e2e` pass on the local stack after `npx supabase db reset`, after the last edit; the counts are not lower than before U1 (192 and 46). |
| AC5 | Every row of the manual QA matrix (Appendix A) gives its expected result on `npm run dev`, and the anonymous pages match the screenshots taken on the baseline before CP1 except for differences the report names and the Owner accepts. |
| AC6 | On the PR, all six CI jobs run and pass. |
| AC7 | Records: the U1 row and State in this program; the per-package changelog notes (breaking changes, deprecations, or "none") in the implementation report and the PR body. |

### 1.2 Scope and non-goals

- In scope: the 16 packages of section 2; the lockfile changes npm makes to resolve them; the records in AC7.
- Non-goals:
  - majors (FEAT-020, BL-009 `nodemailer` 10), the Node version (FEAT-019), the Supabase CLI (D2), `@supabase/ssr`;
  - `npm update` of the whole tree or `npm audit fix` (only the listed packages are installed);
  - removing unused packages (DM-001);
  - any edit of product code, config or tests: a breaking change or a needed code edit stops U1 for that package (G2), and the fix is planned as its own task (`dependency-updates`, Minor and Major). The one exception is the type-only test edit of D4;
  - the Monaco CDN version (BL-009).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Before each package group, read its changelog or release notes from the current to the target version, and list breaking changes and deprecations in the report. | A behavior change ships unnoticed because the suite does not cover it. |
| G2. A changelog breaking change, a failing check, or a needed edit of any file other than `package.json`, `package-lock.json`, the AC7 records (this program's `progress.md` and the U1 row of its charter) and the D4 edit stops the implementor; it reports to Main and edits nothing else. Main takes the package out of U1 through `planning` with the Owner. The three `tsc` errors that D4 names are repaired under D4 and do not trigger this stop; any other failure does. | A version bump quietly turns into a code change nobody planned or reviewed. |
| G3. Install with `npm install <pkg>@<target>` (several packages of one group in one command), never `npm update`, `npm audit fix` or `--force`, and confirm with `npm ls <pkg>` that the resolved version is the target. | Unlisted packages move, or a major or downgrade slips in. |
| G4. `@supabase/supabase-js` is its own checkpoint, followed by `npm test` (the rls project signs in and checks RLS) and `npm run test:e2e` (sign-in and the payment flow). | An auth or session change from 35 minor versions hides among other updates. |
| G5. Baseline screenshots of the anonymous pages in Appendix A are taken on `npm run dev` before CP1, at the same viewport as the comparison after CP5. | A Tailwind 4.3 styling change has nothing to be compared against. |
| G6. Nothing reaches hosted; the local stack only (`.claude/rules.md` section 4). | An update test writes to production. |

### 1.4 Owner decisions that bind this initiative

- Charter decisions 1 to 3: this program owns the work; U1 gets a detail plan and the Codex gate on its plan and on its diff.
- D1 (2026-10-27) Scope: every patch and minor within the current major, nothing else (the Owner chose "Patch và minor").
- D2 (2026-10-27) The Supabase CLI stays at 2.121.0: it was installed recently; the next dependency check reviews it again.
- D3 (2026-10-27) U1 ships in its own PR, after the PR that opens this program and closes infrastructure.
- D4 (2026-10-27) `@supabase/supabase-js` 2.118.0 stays in U1. Its stricter `insert` types make `npx tsc --noEmit` fail in `__tests__/rls/content.test.ts` (the `[C7] cannot insert` and the update and delete target inserts pass a union of three row shapes, `newRows[table]` and `targetRows[table]`). The Owner allowed a type-only edit of that file to compile again: no change to test names, rows, values, assertions, the tables covered or the number of tests, and no `@ts-` directive or `any`; nothing else in the file or in other tests changes. Verification: `npx tsc --noEmit` passes, `npm test` still reports 192 passed with the three known bugs, and the nine C7 rows of that file pass.

## 2. Repository facts

Baseline: `3ea4a09`, checked 2026-10-27 (`npm outdated`, `npm audit`, `npm view`).

| Group | Package | Current | Target | Used in |
| --- | --- | --- | --- | --- |
| React | `react`, `react-dom` | 19.2.3 | 19.3.1 | the whole app |
| React | `@types/react`, `@types/react-dom` | 19.2.6, 19.2.3 | 19.3.0 | type check |
| Tailwind | `tailwindcss`, `@tailwindcss/postcss` | 4.1.17 | 4.3.3 | all styles (`app/globals.css`, `postcss.config.mjs`) |
| Tailwind | `tailwind-merge` | 3.4.0 | 3.7.0 | `lib/utils.ts` |
| Supabase | `@supabase/supabase-js` | 2.83.0 | 2.118.0 | every Supabase client (`lib/supabase.*.ts`), auth, RLS tests |
| Other | `@google/genai` | 1.34.0 | 1.52.0 | `app/action/gemini.ts` (admin AI Magic) |
| Other | `@radix-ui/react-slot` | 1.2.4 | 1.5.0 | no import (DM-001) |
| Other | `@uiw/react-md-editor` | 4.0.11 | 4.1.6 | `app/components/MdxEditor.tsx` (admin lesson content) |
| Other | `date-fns` | 4.1.0 | 4.4.0 | `app/(main)/profile/page.tsx` (date of birth, unset in the seed), `app/components/LessonComments.tsx` |
| Other | `recharts` | 3.5.1 | 3.10.1 | `app/components/TransactionChart.tsx` (admin dashboard) |
| Other | `sonner` | 2.0.7 | 2.0.8 | toasts on course, profile, try-it, quiz and admin pages |
| Dev | `eslint` | 9.39.1 | 9.39.5 | `npm run lint` |
| Dev | `@types/nodemailer` | 7.0.5 | 7.0.12 | type check of `lib/email.server.ts` |

- `npm audit` on the baseline: 5 findings, all in BL-009; `npm test` 192 passed and `npm run test:e2e` 46 passed (PR 29 CI on `2cb2696`) — justifies AC3 and AC4.
- The e2e server-action fixture reads Next internals and the mail guard rewrites the bundled nodemailer chunk (`test-quality-strategy`, Server action rows); neither `next` nor `nodemailer` changes in U1 — bounds the risk of CP5.
- No test calls Gemini (infrastructure master plan decision 7) — justifies the manual row for `@google/genai`.

## 3. Bounded implementation hypotheses

- One local commit per checkpoint CP1 to CP4, message `chore(deps): ...` (`git-pr-workflow` types), and one `docs(dependency-maintenance): ...` commit for the CP5 records — may change if every commit still holds whole groups with their lockfile change.
- Appendix A screenshots at 1280x800 in the built-in browser pane — may change to another fixed viewport if G5 holds.
- The rows needing a sign-in are run by Main after the Owner signs in, as in infrastructure U7 — may change if the Owner runs them.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP0 | Baseline: Appendix A anonymous screenshots on the current versions. | Files in the session scratchpad, named per row; nothing committed. |
| CP1 | React group updated. | `npx tsc --noEmit`, `npm run lint`, `npm run build`; changelog notes. |
| CP2 | Tailwind group updated. | Same as CP1; Appendix A anonymous rows compared with CP0. |
| CP3 | `@supabase/supabase-js` updated (G4), with the D4 test type edit. | Same as CP1, plus `npx supabase db reset`, `npm test`, `npm run test:e2e`; the D4 verification. |
| CP4 | Other and Dev groups updated. | Same as CP1. |
| CP5 | Full verification and records. | `npx supabase db reset`, `npm test`, `npm run test:e2e`, `npm outdated` (AC2), `npm audit` and `npm audit --omit=dev` (AC3); Appendix A signed-in rows by Main with the Owner's sign-in; State and the U1 row. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| `supabase-js` 2.83 to 2.118 changes auth or session behavior. | G1 and G4: its own checkpoint with the rls and e2e suites, and the sign-in rows of Appendix A. |
| Tailwind 4.3 changes styles the suite does not see. | G5 screenshots before and after; Appendix A pages with the most layout. |
| `recharts`, `@uiw/react-md-editor` or `@google/genai` change behavior on admin-only paths the e2e smoke does not exercise. | Appendix A admin rows; changelog notes. |
| React 19.3 changes hydration or hook warnings. | `npm run build`, the e2e page-error guard, and the console check in Appendix A. |
| The lockfile moves transitive packages that npm needs to resolve the targets. | Accepted: AC3 audit and the full suite cover it; the report lists `git diff --stat` of the lockfile. |

- Rollout runbook: none; no hosted step. Vercel deploys the new versions when the PR merges.
- Stop when: G2 triggers; a check fails twice after an in-scope fix; a version in section 2 is no longer the latest in its major when work starts (report the new one to Main instead of choosing).
- Rollback: revert the PR; nothing hosted changes.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

## Appendix A. Manual QA matrix

On `npm run dev` after `npx supabase db reset`, browser console open. "As before" means the same layout and content as the CP0 screenshot; any difference goes in the report.

| ID | Account | Where | Action | Expected |
| --- | --- | --- | --- | --- |
| M1 | none | `/` | open | renders as before, no console error |
| M2 | none | `/course/javascript-can-ban` | open | renders as before |
| M3 | none | `/login` | open | renders as before |
| M4 | `student@devspace.test` | `/login` | sign in, then sign out | signed in to the home page; after sign-out the header shows "Đăng nhập" |
| M5 | `student@devspace.test` | `/learn/javascript-can-ban/bien-va-kieu-du-lieu/quiz` | answer exercise 1 with `let` | "Chính xác!" toast (`sonner`) |
| M6 | `student@devspace.test` | `/learn/javascript-can-ban/bien-va-kieu-du-lieu` | open "Thảo luận" | the seeded comment shows its relative time in Vietnamese (`formatDistanceToNow` in `LessonComments.tsx`, `date-fns`) |
| M7 | `student@devspace.test` | `/try_it` | open the editor | the Monaco editor loads |
| M8 | `admin@devspace.test` | `/admin` | open the dashboard | the transaction chart renders (`recharts`) |
| M9 | `admin@devspace.test` | `/admin/lessons`, edit a lesson | open the Info tab | the content editor renders and previews (`@uiw/react-md-editor`); close without saving |
| M10 | `admin@devspace.test` | `/admin/lessons`, edit a lesson | only if the Owner allows a Gemini call with their key: replace the content in the editor with a test text longer than 50 characters (seed contents are shorter and `app/action/gemini.ts` rejects them before the call), Quiz tab, AI Magic "Điền vào form" for one question, then close without saving | a question fills the form (`@google/genai`); otherwise recorded as not run |
