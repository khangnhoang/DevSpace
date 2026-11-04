# QE-U4 detail plan — Component tests for client components

Revision: r2, 2026-11-04 (r1: tooling and tests only, every e2e row kept). Owner approval: 2026-11-04. Charter: [quality-engineering](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the first step of QE-F8. Vitest has a `components` project that renders client components in jsdom with Testing Library, `npm run test:unit` runs it with the `unit` project and no Docker, and `CourseFormDialog` has component tests for its client logic. `test-quality-strategy` lists component tests as a layer to choose and states the rule that an e2e row stays only for an integration boundary that needs real verification. e2e row C2 moves to a component test when the component tests cover each of its assertions; no other e2e row moves. QE-F8 stays open, holding the audit of the whole e2e suite until it is done.

| ID | Observable result |
| --- | --- |
| AC1 | `npm run test:unit` runs the `unit` and `components` projects without Docker and passes; `npm test` runs `components` too (it runs every project), so CI covers it through the existing `test` job with no workflow change. |
| AC2 | An admin who submits the course form with a blank name and a blank slug sees "Vui lòng nhập tên khóa học" and "Vui lòng nhập slug", both inputs have `aria-invalid="true"`, and no save is called; a name of only spaces counts as blank; a field that is valid shows no error (the client part of e2e C2). |
| AC3 | A price that is not a whole number (`1.5`), or is negative (`-5`), shows "Giá phải là số nguyên từ 0 trở lên" and no save is called; typing a valid value into a field in error clears its error and its `aria-invalid`, and emptying the price after its error clears the price error (the AF-P6 question). |
| AC4 | A valid new course calls `addCourse` once with the schema's output (a blank price as `0`, a blank instructor as `null`), `image_url: ""` and no file, then toasts success, calls `onClose` and refreshes the router (the client part of C1). |
| AC5 | Editing a course whose price is 0 shows its stored values, the price as `0`, and a save calls `updateCourse` with the course id, the values unchanged (price `0`) and the stored `image_url` (the client part of C3). |
| AC6 | A save that returns an error, or throws, keeps the dialog open (`onClose` not called) with what was typed, toasts "Lỗi cập nhật: …", re-enables the submit button, and a retry calls the save again (the client part of C4). |
| AC7 | Two submits while the first save is pending call the save once, and the submit button is disabled while it is pending (the client part of D1). |
| AC8 | Each new test fails when the logic it covers is broken: at least removing the `savingRef` guard fails AC7, and removing a schema rule or the `aria-invalid` binding fails AC2 or AC3; the mutations and their results are recorded in State. |
| AC12 | C2 moves only on equivalent coverage. Each C2 assertion maps to a component assertion: the slug, price and name errors and their absence (AC2, AC3), the slug's `aria-invalid` (AC2), the cleared price error on a blank price (AC3), and "nothing was sent" and "no course row" as no `addCourse` or `updateCourse` call (the dialog's only write path, section 2). Before C2 is deleted, a mutation of the slug rule, the price rule and the price-error clearing each fails a component test. The mapping `C2 -> __tests__/unit/components/CourseFormDialog.test.tsx` is recorded in `test-quality-strategy` and State. If an assertion has no equivalent, C2 stays and the gap is recorded in State. When C2 is deleted, AF-P6 is resolved as one line: the price-error clearing it doubted is proven by a component test, and the e2e timing cause stays unnamed. |
| AC13 | `test-quality-strategy` and the app-foundation master plan state the e2e rule: a form keeps a successful e2e row and an e2e row for each integration boundary it has (persistence, a refusal by the server, the database or Auth, a failed real request, permission, upload, redirect); an assertion that is only client logic goes to a component test; a row is deleted only after its replacement fails under a mutation and the mapping is recorded. The master plan invariant asking for a "rejected field" e2e row per form is replaced by this rule, with a dated Owner decision. Every other existing row is unchanged. |
| AC14 | QE-F8 is not closed by QE-U4. Its Status names QE-U4 as the first step, and its Direction is the open follow-up: audit every spec in `__tests__/e2e/`, classify each row as an integration boundary or client-only, move client-only assertions to component tests form by form under AC13, delete redundant rows, keep a mapping per moved row, and measure the e2e time under QE-F3. It closes only when every e2e spec is audited and every client-only row is moved or kept with a recorded reason. |
| AC9 | `test-quality-strategy` describes the component layer (What exists, Select checks from the contract, Mocking, the command table): where the files go, what belongs there and what stays in e2e or `rls`, and the boundary mocking rule. |
| AC10 | Each added package has its row in `dependency-updates`; `AGENTS.md` (Commands) says `npm run test:unit` runs the unit and component tests. |
| AC11 | Existing checks stay green (after C2 is removed): `npx tsc --noEmit`, `npm run lint` with 0 problems, `npm run build`, `npm test`, `npm run test:e2e`, `npm run docs:check`; `npm audit` reports no advisory beyond the baseline (18 at `8384545`). |

### 1.2 Scope and non-goals

- In scope: the five dev packages (1.4); the `components` project and its setup file in `vitest.config.mts`; the `test:unit` script; `__tests__/unit/components/CourseFormDialog.test.tsx`; `test-quality-strategy`, `dependency-updates` and `AGENTS.md` updates; the AF-P6 evidence from AC3; moving C2 under AC12; the e2e rule in `test-quality-strategy` and the app-foundation master plan (AC13); QE-F8 (AC14) and quality-engineering State records.
- Non-goals: moving or deleting any e2e row other than C2 (the audit stays in QE-F8); component tests for other forms; any change to product code, including `CourseFormDialog`; the QE-F7 folder reshape; CI workflow changes; e2e speed claims (QE-F3).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Only modules outside the component are mocked: `@/lib/supabase` (`addCourse`, `updateCourse`), `next/navigation`, `next/image` when needed, and `sonner`. The schema, React Hook Form, the resolver and the component's own handlers run for real. | A test that passes because the logic under test was replaced. |
| G2. The `unit` project's include stays `__tests__/unit/**/*.test.ts` and the `components` include is `__tests__/unit/components/**/*.test.tsx`, so no file runs in both projects or in the wrong environment. | A component file run under `node` fails, or a unit file runs twice. |
| G3. The `components` project sets no env-file loading and reads no network, stack or `.env*` value (it inherits `envDir: false`). | A component test depends on the developer's hosted env file. |
| G4. Mocks do not render a raw `<img>` (the `@next/next/no-img-element` rule warns and lint allows 0 warnings). | `npm run lint` fails on the test file. |
| G5. Duplicate-submit tests hold the save pending with a promise the test resolves, and submit through `requestSubmit` or a repeated Enter, never a fixed sleep. | A test that passes because the first save finished before the second submit. |
| G6. C2 is deleted in its own commit, after the component tests and their mutation results exist and AC12's mapping is complete. | A deleted row whose guarantee no test holds any more. |

### 1.4 Owner decisions that bind this unit

- (2026-11-04) Open QE-F8 as QE-U4 on `test/qe-component-tests`, in the same PR as the docs catch-up of PR 60 (app-foundation AF-U5).
- (2026-11-04) Packages: `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event` and `@testing-library/jest-dom`, as dev dependencies.
- (2026-11-04) The component's data, router and toast calls are replaced with `vi.mock` of their modules; no product code changes for testability.
- (2026-11-04) Component tests are added to the test-selection matrix as a layer to choose. QE-U4 moves C2 if the coverage is equivalent and moves no other row.
- (2026-11-04) An e2e row stays only where an integration boundary needs real verification; client-only rows move to component tests and redundant e2e rows are removed. QE-F8 is not complete after QE-U4: it holds the audit of every existing e2e row as a tracked follow-up until it is done, with no bulk move in QE-U4.

## 2. Repository facts

Baseline: `8384545`, checked 2026-11-04. Trial install in a throwaway worktree at the baseline, Node 26.13.0, since removed.

- `vitest.config.mts` has two projects, `unit` (`node`, `__tests__/unit/**/*.test.ts`) and `rls`, with `envDir: false` at the root; `test:unit` is `vitest run --project unit`; `scripts/test-stack/test.mjs` runs `vitest run` with no project filter, and CI runs `npm test` — justifies AC1, G2, G3.
- `tsconfig.json` includes `**/*.tsx` with `jsx: react-jsx`, so a `.tsx` test is type-checked by `tsc` and `next build` — justifies AC11.
- `CourseFormDialog` (`app/admin/courses/_components/CourseFormDialog.tsx`) imports `addCourse` and `updateCourse` from `@/lib/supabase`, `useRouter` from `next/navigation`, `Image` from `next/image` and `toast` from `sonner`; it guards duplicate submits with `savingRef` set before the first await — justifies G1, AC7, AC8.
- Trial install of the five packages: `jsdom` 30.1.3, `@testing-library/react` 16.3.3 (peers React 18 or 19 and `@testing-library/dom` 10), `@testing-library/dom` 10.4.2, `@testing-library/user-event` 14.6.8, `@testing-library/jest-dom` 7.0.1, all MIT; one copy of `@testing-library/dom`; `package-lock.json` +759 lines. `npx tsc --noEmit` clean, `npm run build` ok with the CI placeholder env, `vitest run --project unit` 573 passed — justifies 1.4 and AC10. The trial's `npm audit` count was not recorded; AC11 checks it.
- Trial `components` project (jsdom, a setup file importing `@testing-library/jest-dom/vitest` and calling `cleanup` after each test) with three trial tests for AC2, AC3 (price emptied) and AC7: 3 passed in 2.7 s wall time; removing the `savingRef` guard failed the AC7 test. Emptying the price after its error cleared `aria-invalid` in jsdom — justifies AC3, AC8 and the AF-P6 evidence.
- Trial lint: 1 warning, `@next/next/no-img-element` on a `next/image` mock that rendered `<img>` — justifies G4.
- e2e rows C1 to C5 and D1 for the course form are in `__tests__/e2e/admin-content-forms.spec.ts:67-230`; AF-P6 (`docs/programs/app-foundation/problems.md`) records one C2 failure on the price error that should clear — justifies AC3 and AC12.
- C2 (`admin-content-forms.spec.ts:88-124`) asserts the slug, price and name errors, the slug's `aria-invalid`, the cleared price error on a blank price, no course row (`coursesNamed`) and no recorded mutation; it writes nothing. The dialog writes only through `addCourse` and `updateCourse` (the image upload runs inside them) — justifies AC12.
- The app-foundation master plan invariant (`docs/programs/app-foundation/plan.md:33`) asks each converted form for "an e2e row for a successful submit and one rejected field", and `test-quality-strategy` (Select checks from the contract) binds "successful/rejected E2E per form"; both conflict with moving C2, so AC13 changes them.

## 3. Bounded implementation hypotheses

- `vitest.config.mts` gains a `components` project after `unit`, with `environment: "jsdom"` and `setupFiles: ["__tests__/unit/components/setup.ts"]`; `test:unit` becomes `vitest run --project unit --project components` — may change if AC1 and G2 hold.
- One test file `__tests__/unit/components/CourseFormDialog.test.tsx` with one `it` per behavior, named by actor, condition and outcome; save mocks are `vi.fn()` reset in `beforeEach` — may change if G1 and G5 hold.
- `next/image` may stay unmocked if it renders in jsdom without the Next runtime for the edit case with a stored image; otherwise it is mocked without `<img>` — may change if G4 holds.
- `test-quality-strategy`: a `components` row in What exists, a short Component tests section (scope, limits from QE-F8: no `async` Server Components, no layout or focus geometry, no RLS, action or persistence guarantee), one line in Mocking, the command table row for a client component — may change if AC9 holds and the skill stays within its size.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Packages, the `components` project, setup file, `test:unit` script and the `CourseFormDialog` tests (AC1 to AC8), with the mutations of AC8 run and reverted. | `npm run test:unit` (counts per project and the `components` duration); `npx tsc --noEmit`; `npm run lint`; `npm run build`; `npm test`; `npm run test:e2e` once (no e2e row changed); `npm audit` count against 18. |
| CP2 | C2 moved under AC12 and G6: mutation results for the slug rule, the price rule and the price-error clearing, then C2 deleted from the spec. | `npm run test:unit`; `npx tsc --noEmit`; `npm run lint`; `npm run test:e2e` once (C2 wrote nothing). |
| CP3 | Docs: `test-quality-strategy` (AC9, AC13, the C2 mapping and the e2e inventory), the app-foundation master plan invariant and decision with one app-foundation milestone citing the PR, `dependency-updates` rows, `AGENTS.md` (AC10); the AF-P6 evidence line; QE-F8 (AC14) and State. | `npm run docs:check`; `npm run format:check` on the changed code files. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| jsdom differs from Chromium, so a component test passes where the browser fails. | Only C2 moves, and only on AC12's mapping; C1, C3, C4, C5 and D1 stay in e2e; component tests cover only client logic (AC9). |
| The e2e audit is forgotten once QE-U4 merges. | QE-F8 stays open with a closing condition (AC14), and State names it as the next quality-engineering item. |
| The `components` project slows `npm run test:unit` or `npm test`. | Record its duration at CP1; the trial took 2.7 s for one file. |
| A mock hides the behavior under test. | G1 and the mutations of AC8. |
| `npm test` on the test stack treats the new project's process differently (writer records). | `npm test` runs at CP1; a refusal or unclean run stops the work for Main. |

- Rollout runbook: none (dev dependencies and tests only; no hosted step).
- Stop when: a test needs a product code change to be testable (outside 1.4); the `components` project cannot run inside `npm test` without changing the test-stack tooling; a package adds an advisory beyond the baseline.
- Rollback: revert the commits; `package.json` and `package-lock.json` revert together.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
