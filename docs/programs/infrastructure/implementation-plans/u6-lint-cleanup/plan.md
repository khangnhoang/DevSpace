# U6 detail plan — Lint cleanup

Revision: r3, 2026-10-25 (r2 and r3 answer Codex plan rounds 1 and 2). Owner approval: pending. Master plan: [plan.md](../../plan.md) (unit U6, outcomes 6 and 8, decision D4; invariant "identical behavior"; rollout order step 5; risk "Fixing lint problems changes behavior").

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: `npm run lint` reports 0 problems, errors and warnings alike, and the CI `lint` job fails on any lint problem. The app behaves exactly as before: every fix is a type-only change, a removal of a binding nothing reads, or a restructure proven equivalent, and the few problems whose only fix changes behavior are suppressed on their own line with a reason and tracked in the backlog (D28). The docs and skills describe the blocking lint job in the same PR.

| ID | Observable result |
| --- | --- |
| AC1 | On the branch head, `npm run lint` exits 0 and prints no problem, and `npx eslint .` reports 0 errors and 0 warnings. |
| AC2 | The emitted-JS check (Appendix C) run against base `b8e3e0f` over every changed `.ts` and `.tsx` file under `app/` and `lib/` prints `SAME` for every file outside the Appendix A `DIFF` list. For each `DIFF` file, the emitted-JS diff holds only the changes Appendix A lists for it. |
| AC3 | The full suite is green before CP1 (on `b8e3e0f`) and after CP3, with the same counts: `npx tsc --noEmit` 0 errors, `npm test` 152 passed with the `known bug P3`, `P4` and `P28` lines, `npm run test:e2e` 46 passed with the `P5`, `P6` and `P25` lines, and `npm run build` succeeds. No test file changes. |
| AC4 | Every `eslint-disable` in `app/` and `lib/` is an `eslint-disable-next-line` (or its JSX comment form) that names one rule and carries `-- <reason>`. `grep -rn "eslint-disable" app lib` lists exactly the lines in backlog entry BL-003. `eslint.config.mjs` turns no rule off, and no `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` is added. |
| AC5 | `.github/workflows/ci.yml` runs `npm run lint` in the `lint` job without `continue-on-error`. Locally, adding one unused variable makes `npm run lint` exit non-zero (then reverted). On the PR, the `lint` job passes. |
| AC6 | `CLAUDE.md`, `git-pr-workflow` (`SKILL.md`, `references/pr-and-ci.md`), `code-review`, `frontend-workflow`, `planning` and `server-actions` `SKILL.md`, and `.github/pull_request_template.md` describe a blocking lint with 0 problems. `grep -rnE "82 |new problems|continue-on-error|lint cleanup|N problems|never turns red|lint step log|lint count|until U6" CLAUDE.md .claude docs/agent-loops.md .github` finds nothing outside `.claude/skills/playwright-cli/`. |
| AC7 | Main's manual browser pass on the local build (Appendix B) passes every row, as the seed users. |
| AC8 | `docs/backlog/problems.md` has BL-003 (each suppressed line, its rule and the change a real fix needs). Adjacent defects found during U6 are recorded, not fixed: the Quiz completion branch in the backlog, and the seed's uppercase `correct_answer` in `infrastructure/problems.md` (section 2). |

### 1.2 Scope and non-goals

- In scope: the 82 problems `npx eslint .` reports on `b8e3e0f`, in the 25 product files that hold them; `--max-warnings 0` in the `lint` script; the `lint` CI step; the docs and skill lines in AC6; backlog entries BL-003 and any adjacent defect entry.
- Non-goals: converting `<img>` to `next/image` (BL-003, later UI task); narrowing `images.remotePatterns` (BL-002); fixing the Quiz completion defect or any other behavior; generated Supabase `Database` types; new lint rules or a stricter config; formatting runs (Prettier or ESLint `--fix` over whole files); test changes; the frozen "81" in master plan D4 (the 82 baseline is an accepted deviation in `progress.md`).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. An `any` is replaced only by a type: a local interface or type alias, an existing `@/lib/types` type, a library type, `unknown` plus a type assertion, or `Record<string, unknown>`. No runtime guard, `instanceof` narrowing, default value or changed expression. | `catch (e: unknown)` rewritten as `e instanceof Error ? e.message : "..."` changes the message a non-`Error` throw shows. |
| G2. A hook call is never removed or reordered. An unused state value becomes a destructuring hole (`const [, setX] = useState(...)`), an unused setter is dropped from the pattern, and the `useState` call stays. | React state is lost or hook order changes between renders. |
| G3. Only the reported lines change, plus the disable comments D28 allows and, where a replaced `any` needs it, type annotations or assertions on the lines that read that value in the same function (for example `(error as { message?: string }).message` after `catch (error: unknown)` in `gemini.ts:78` and `reset-password/page.tsx:60`). Those files must still print `SAME`. No formatter over whole files, no renames, no moved code. | The emitted-JS check drowns in noise and a real change slips through review. |
| G4. A `react-hooks/set-state-in-effect` fix is accepted only when the reviewer can show, from the code, the same observable result: the same DOM states (loading, list, empty, "Xem thêm" shown or hidden), the same requests in the same order, and the same final state when a response arrives late or after a newer request, for mount, `courseId` change and `hasEnrolled` change (course page), and for mount and the refetch after approve or reject (transactions; that refetch keeps its `setIsLoading(true)`). Render count and React batching are not part of the contract. When this cannot be shown, the line is suppressed under D28. | The review list flickers, resets late, or "Xem thêm" loads the wrong page. |
| G5. A suppression is one rule on one line with a reason a reader can check; never a file, block or config-level disable. | Future problems in the same file or rule are hidden. |
| G6. No test, fixture, seed or helper under `__tests__/`, `scripts/` or `supabase/` changes. | A regression is masked by an edited test. |

### 1.4 Owner decisions that bind this unit

- D4: all existing lint problems are fixed (no ratchet, no permanently non-blocking job); the lint job blocks afterwards. The count is 82 since INF-001 (accepted deviation).
- D28 (2026-10-25, new, binds this unit only): a lint problem whose only fix changes behavior (the four `@next/next/no-img-element` lines, and a `react-hooks/set-state-in-effect` line when G4 cannot hold) gets an `eslint-disable-next-line <rule> -- <reason>` on that line, and is listed in a backlog problem entry so a later UI task can make the real fix with manual QA. No rule is turned off in `eslint.config.mjs`.

## 2. Repository facts

Baseline: `b8e3e0f`, checked 2026-10-25.

- `npx eslint .` reports 82 problems in 25 files: 55 `@typescript-eslint/no-explicit-any` errors, 2 `react-hooks/set-state-in-effect` errors, 21 `@typescript-eslint/no-unused-vars` warnings, 4 `@next/next/no-img-element` warnings — justifies AC1 and Appendix A.
- Every `no-explicit-any` site is a type annotation, a generic argument or an `as any` assertion; none is a value — justifies G1 and the `SAME` class.
- The 21 unused vars are 9 unused imports or type imports, 10 unused `catch` bindings and 2 unused state elements (`Quiz.tsx:33` setter, `SidebarContent.tsx:50` value; its setter is called at line 90) — justifies G2 and Appendix A.
- `ts.transpileModule` drops type annotations, assertions and imports nothing reads as a value, so those edits emit identical JS; removing a `catch` binding or adding a JSX comment changes the emitted text (prototype on `b8e3e0f`, 2026-10-25) — justifies AC2 and the two classes in Appendix A.
- `package.json` runs `"lint": "eslint"`; ESLint exits 0 when only warnings are reported — justifies `--max-warnings 0`.
- `.github/workflows/ci.yml:119-122` runs `npm run lint` with `continue-on-error: true` and a comment naming U6 — justifies AC5.
- The four `<img>` sites: a review avatar (`course/[slug]/page.tsx:289`), a `blob:` preview (`admin/users/page.tsx:503`), the payment QR from an external URL (`CoursePaymentModal.tsx:168`) and a course image with an `onError` fallback (`Header.tsx:224`). `next/image` routes the remote sources through `/_next/image`, serves `blob:` unoptimized, and needs a size or `fill`; BL-002 already questions the open `remotePatterns` — justifies D28.
- `admin/transactions/page.tsx:14` starts `isLoading` at `true`; the mount effect calls `fetchPayments`, whose first statement is `setIsLoading(true)`, and the handlers reuse it. The course review effect (`course/[slug]/page.tsx:116-123`) resets `page` and `hasMore` before fetching and reruns when `courseId` or `hasEnrolled` change — justifies G4.
- `Quiz.tsx` never calls `setIsCompleted`, so the `isCompleted` branch at line 92 never renders: an adjacent defect, recorded, not fixed — justifies AC8.
- `supabase/seed.sql` stores `correct_answer` `A` and `B` for exercises 1 and 2, while the admin form writes `a` to `d` and `Quiz.tsx:83` compares with the lowercase option value, so no seeded quiz answer is accepted: an infrastructure seed defect, recorded, not fixed (G6) — justifies AC8 and the Appendix B fixture.
- Stale lint text: `CLAUDE.md:10` and `:13`; `git-pr-workflow` `SKILL.md:32` and `:44`, `references/pr-and-ci.md:33`, `:42`, `:43` and `:52`; `.github/pull_request_template.md:24`; the `ci.yml:119-120` comment; "without new problems" or "no new problems" in `code-review` `SKILL.md:47`, `frontend-workflow` `SKILL.md:14` and `:51`, `planning` `SKILL.md:29`, `server-actions` `SKILL.md:54` — justifies AC6.
- Suite on the U5 head `71fbf06`, whose tree differs from `b8e3e0f` only in docs: unit 87, `npm test` 152, e2e 46 (`progress.md` milestone) — justifies the AC3 counts.

## 3. Bounded implementation hypotheses

- Types for Supabase rows: small local interfaces next to their use, or existing types in `lib/types.ts` — may change if G1 holds and `tsc` passes; a new shared type goes to `lib/types.ts`.
- `catch (e) {` becomes `catch {` (optional catch binding) — may change to another form if the emitted diff stays limited to the binding.
- Transactions: the mount effect calls `getAllPayments().then(...)`, setting state only in the callback, since `isLoading` already starts `true`; the handlers keep calling `fetchPayments` — may change if G4 holds; otherwise D28.
- Course reviews: moving the reset into the async callback changes when it happens, so it fails G4; the likely result is D28 on line 117 unless a restructure keeps the reset before the fetch.
- `package.json`: `"lint": "eslint --max-warnings 0"`, so local runs and CI fail the same way — may move to the CI step only if AC1 and AC5 still hold.

## 4. Checkpoints

The implementor runs the full suite on `b8e3e0f` (AC3) before CP1 and reports the counts.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Type-only fixes: the 55 `no-explicit-any` and the 9 unused imports or type imports. Lint 82 to 18. | `npx tsc --noEmit`; `npm run lint` count; Appendix C prints `SAME` for every CP1 file outside Appendix A's `DIFF` list; `npm run test:unit`. |
| CP2 | The 10 `catch` bindings, the 2 state elements, the 2 effects (G4 or D28) and the 4 `<img>` suppressions. Lint 0. | `npm run lint` exits 0; Appendix C over all changed files matches Appendix A; the emitted diff of each `DIFF` file read by hand; `npx tsc --noEmit`. |
| CP3 | `--max-warnings 0`, the blocking CI step, the AC6 docs. | AC5 local probe; AC6 grep; `npm run docs:check`; then `npx supabase db reset`, `npm test -- --reporter=default`, `npm run test:e2e` and `npm run build` (AC3). |
| CP4 (Main) | Review of the whole diff, manual browser pass, BL-003 and adjacent-defect entries, Codex diff gate, State update. | Appendix B; Appendix C rerun; Codex PASS; `npm run docs:check`. |
| CP5 (Main, grants) | Push, PR, CI result in the body. | `gh pr checks --watch`: all six jobs and Vercel pass, `lint` included. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A type change hides a runtime change (an assertion that changed an expression, a narrowing added). | AC2: type-only files must emit identical JS; G1 bans narrowing. |
| A replaced `any` makes `tsc` fail elsewhere and invites a wider refactor. | Use `unknown` plus an assertion at that site instead of rippling types (G1, G3); stop and report if a type needs a change outside what G3 permits. |
| An effect restructure changes render timing that no test covers. | G4 lists the transitions; anything uncertain falls to D28; Appendix B covers both pages. |
| `--max-warnings 0` blocks an unrelated PR that adds a warning. | That is the intended gate (D4); `CLAUDE.md` says so. |
| Gemini quiz generation (`gemini.ts`) cannot be exercised locally (D7). | Its edits are type-only and must print `SAME`; the gap is reported. |

- Rollout runbook: after the merge, the Owner adds `lint` to the required checks on `main`; Main confirms with `gh api repos/khangnhoang/DevSpace/branches/main/protection` (read-only) and records it as a milestone. No hosted database step.
- Stop when: a fix needs a change outside what G3 permits or a new Owner decision; a test fails or a count changes; a `DIFF` file shows an emitted change not in Appendix A; Appendix B shows any difference from `main`.
- Rollback: revert the PR, which restores the old code and the non-blocking lint step. If `lint` is already a required check, the Owner removes it from the branch protection of `main` (an Owner setting). The manual-pass fixture lives only in the local database and `npx supabase db reset` removes it.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

## Appendix A: files and expected emitted-JS class

`SAME`: emitted JS identical to `b8e3e0f`. `DIFF`: only the listed changes.

| File | Problems | Class | Allowed emitted change |
| --- | --- | --- | --- |
| `app/(main)/course/[slug]/page.tsx` | any, set-state, img, catch | DIFF | `catch` binding at 451; the line 117 effect restructure or its suppression; the JSX comment at 289 |
| `app/(main)/login/page.tsx` | catch | DIFF | `catch` binding |
| `app/(main)/try_it/page.tsx` | import, catch, any | DIFF | `catch` binding at 129 |
| `app/action/payment.ts` | 3 catch | DIFF | `catch` bindings at 67, 171, 325 |
| `app/admin/chapters/page.tsx` | catch | DIFF | `catch` binding |
| `app/admin/users/page.tsx` | import, catch, img | DIFF | `catch` binding at 156; the JSX comment at 503 |
| `app/admin/transactions/page.tsx` | any, set-state | DIFF | the mount effect restructure or its suppression |
| `app/components/CoursePaymentModal.tsx` | import, any, 2 catch, img | DIFF | `catch` bindings at 68, 90; the JSX comment at 168 |
| `app/components/Header.tsx` | any, img | DIFF | the JSX comment at 224 |
| `app/components/Quiz.tsx` | state | DIFF | `setIsCompleted` dropped from the pattern |
| `app/components/SidebarContent.tsx` | state | DIFF | `lastAccessLessonId` replaced by a hole |
| `app/(main)/layout.tsx`, `app/(main)/learn/[course]/[slug]/quiz/page.tsx`, `app/(main)/profile/page.tsx`, `app/action/admin-dashboard.ts`, `app/action/gemini.ts`, `app/admin/courses/coursesclient.tsx`, `app/admin/lessons/page.tsx`, `app/admin/page.tsx`, `app/auth/reset-password/page.tsx`, `app/components/CompleteLessonButton.tsx`, `app/components/HeaderAdmin.tsx`, `app/components/LessonComments.tsx`, `app/components/NoteManager.tsx`, `lib/supabase.ts` | any or imports only | SAME | none |

## Appendix B: manual browser pass

Server: Main runs the e2e server by hand so the pass has the same server isolation as `npm run test:e2e`. A launcher in the session scratch folder (not committed) sets `buildE2eEnv(readLocalStack(cwd))` from `__tests__/helpers/` on the process and runs `node scripts/e2e/serve.mjs`: the build and the server get every variable non-empty (nothing falls back to the local environment file, which points at hosted), the server listens on `127.0.0.1:3100`, the network guard refuses the server's non-loopback connections (SMTP, Gemini, remote `/_next/image` fetches) and `approvePayment`'s mail lands in the mail record. It overwrites `.next`. Only the server is guarded: the browser pane loads the QR image (M4) and the Monaco CDN (M7) directly, and the home page's `next/image` placeholders fail through the guard, which is expected. The Owner signs in to the browser pane with the seed users on the local host (`.claude/rules.md` section 4); Main runs the rows once the sessions exist.

Fixture: after `npx supabase db reset`, Main adds with `psql` on `127.0.0.1:54322` only, in the seed's insert shape: six invented users with one review each on course 2; one notification for `admin@devspace.test`; one invented user with a pending order for course 2; `correct_answer` of exercises 1 and 2 set to lowercase, the form the app writes (`admin/lessons/page.tsx`) and `Quiz.tsx` compares, because the seed stores `A` and `B`. After the pass `npx supabase db reset` removes it. No seed, test or helper file changes (G6).

| # | Actor | Page and action | Expected |
| --- | --- | --- | --- |
| M1 | anon | `/`, the Header search for "java" | the course result shows its image, or the fallback image when the image fails |
| M2 | Owner as learner | `/login`, wrong then right password | the same error toast, then sign-in |
| M3 | student | `/course/javascript-can-ban`: the reviews list, "Xem thêm", then write and edit a review | five reviews, "Xem thêm" loads the sixth and hides; the student's review saves and the form switches to edit mode |
| M4 | learner | the same course: "Mua khóa học ngay", apply `LOCAL10`, "Hủy bỏ"; then "Mua khóa học ngay" again and "Tôi đã thanh toán" | the modal and QR image show, the price updates, "Đã hủy giao dịch"; the second order stays pending |
| M5 | student | `/learn/javascript-can-ban/bien-va-kieu-du-lieu` (lesson 3, two exercises): sidebar, a comment (add, edit), a note (save), the complete button; then the quiz | the sidebar shows progress; the comment and note save; the button shows "Bạn cần hoàn thành bài tập trước!" and opens the quiz; with the fixture answers the quiz runs through both questions |
| M5b | student | `/learn/javascript-can-ban/ham-va-vong-lap` (lesson 4, last, no exercise): the complete button | "Đã hoàn thành bài học!", confetti, then `/learn/javascript-can-ban/finish` |
| M6 | student | `/profile`: edit and save, transaction status filter | saves; the filter shows the paid order under its status |
| M7 | anon | `/try_it`: switch tabs, run code | tabs switch; the editor loads (the browser pane reaches the CDN) |
| M8 | admin | `/admin`: stat cards, top students, recent activity; the header bell | data renders; the fixture notification opens and is marked read |
| M9 | admin | `/admin/courses`, `/admin/chapters`, `/admin/lessons`: open edit and save one of each; edit and delete exercise 3 | forms fill and save as before; the exercise is deleted |
| M10 | admin | `/admin/transactions`: load, filter; approve the learner's pending order (M4), reject the fixture user's | loading, then the list; each action refreshes the list; the approve records one mail; the learner is enrolled |
| M11 | admin | `/admin/users`: open a user's edit, choose an avatar file | the `blob:` preview shows |
| M12 | learner | `/auth/reset-password` signed in, submit the current password as the new one | "Mật khẩu mới phải khác mật khẩu cũ" |

## Appendix C: emitted-JS check

Run from the repo root with `node <scratch>/emit.cjs b8e3e0f <files...>`; it is not committed.

```js
const ts = require(require.resolve("typescript", { paths: [process.cwd()] }));
const { execFileSync } = require("child_process");
const fs = require("fs");
const [base, ...files] = process.argv.slice(2);
const opts = { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve, removeComments: true, isolatedModules: true } };
const emit = (src, f) => ts.transpileModule(src.replace(/\r\n/g, "\n"), { ...opts, fileName: f }).outputText;
let diff = 0;
for (const f of files) {
  const same = emit(execFileSync("git", ["show", `${base}:${f}`], { encoding: "utf8" }), f) === emit(fs.readFileSync(f, "utf8"), f);
  if (!same) diff++;
  console.log(same ? "SAME" : "DIFF", f);
}
process.exit(diff ? 1 : 0);
```

For a `DIFF` file, write both emitted outputs to the scratch folder and `git diff --no-index` them to read the change.
