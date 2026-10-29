# U1 detail plan — shadcn base and confirm dialog

Revision: r3, 2026-10-29. Owner approval: 2026-10-29. Master plan or charter: [plan.md](../../plan.md) (r2), unit U1, branch `feat/af-confirm-dialog`.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the repo holds the shadcn setup (`components.json`, the `button` and `alert-dialog` primitives) with tokens that change no existing screen, one named confirm dialog with a pending state replaces all 9 `window.confirm` call sites of master plan Appendix A, and `frontend-design` and `dependency-updates` describe what exists.

| ID | Observable result |
| --- | --- |
| AC1 | An admin who presses a delete control on `/admin/courses`, `/admin/chapters`, `/admin/lessons` (lesson or exercise) or `/admin/users` sees a dialog that names the object (course, chapter, lesson or user name, or the exercise question) and the consequence; cancel or Escape closes it and nothing is deleted; confirm deletes and shows the existing success or error toast. |
| AC2 | An admin who presses `Duyệt` or `Hủy đơn này` on `/admin/transactions` sees a dialog naming the learner as the row shows it (`Ẩn danh` while P15 is open), the course and the amount; cancel leaves the order pending with no request sent; confirm approves or rejects with today's toasts, mails and enrollment. |
| AC3 | An admin who presses the AI bulk-create action on `/admin/lessons` with a saved lesson and content sees a dialog saying that AI saves 3 questions into this lesson; cancel calls nothing. The existing guards (no saved lesson, empty content) still show their toast without opening the dialog. |
| AC4 | A signed-in learner who deletes their own comment in the `LessonComments` panel sees the dialog fully above the panel, at 375px and on desktop; cancel keeps the comment; confirm deletes it as today. |
| AC5 | While the confirmed action runs, the confirm button shows a pending state and both buttons are disabled, so a second click, Escape or an overlay click cannot send it twice or close the dialog; the dialog closes when the action settles, success or error, and a failed action leaves no unhandled rejection. |
| AC6 | `grep -rnE "window\.confirm\|[^.[:alnum:]_]confirm\(" app` finds no call (a local function or hook named otherwise is fine). |
| AC7 | Every page renders as before outside the dialog: the compiled CSS of the CP1 build differs from the baseline build only by added custom properties and the classes the new components use, with no existing rule changed or removed; and screenshots before and after CP1, in a light and a dark OS color scheme, match for `/`, `/course/lam-quen-voi-html`, `/login`, a lesson page as the student and `/admin/transactions` as the admin. |
| AC8 | The dialog is keyboard-usable: it opens with focus inside it, Tab stays inside, Escape cancels when not pending, focus returns to the trigger after cancel or Escape, and it has an accessible title and description. After a confirmed delete the trigger is gone; focus placement then is not an acceptance item. |
| AC9 | `frontend-design` (and its `admin-operations.md`) describes the shadcn primitives and the confirm dialog that exist on `main` after this unit; `dependency-updates` has a row for `radix-ui` and for `class-variance-authority`; `CLAUDE.md` Code map names `components/ui/`; FEAT-006 is `Done`, FEAT-005 records its U1 part, P21 is resolved with a milestone in security-hotfix. |

### 1.2 Scope and non-goals

- In scope: `components.json`; `components/ui/button.tsx` and `components/ui/alert-dialog.tsx` from the shadcn registry; token additions in `app/globals.css`; one confirm dialog component; the 9 call sites; `payment-helpers.ts` and `payment-admin.spec.ts` for the new dialog; new e2e rows `[AP4]` and `[AP5]`; the skill and doc updates of AC9.
- Non-goals: any form (U3 to U6); restyling a page, table, button or modal outside the confirm dialog; the hand-written modals that exist today (`fixed inset-0` in admin pages, `CoursePaymentModal`); dark mode; `tailwindcss-animate` removal; the `cn` package or a rewrite of `lib/utils.ts`; P15 (`Ẩn danh` on `/admin/transactions`) and P25 (stale-tab approval), which stay known bugs; AF-002 (below); any server action, RLS or database change.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. `app/globals.css` only gains lines: no existing line changes, no `@layer base` rule (`* { border-border outline-ring/50 }`, `body { bg-background }`), no `.dark` block, no `@custom-variant dark`, and the appended blocks define no variable that Tailwind or `globals.css` already defines (`--radius-*`, `--font-*`, `--shadow-*`, default palette colours, `--background`, `--foreground`, `--color-background`, `--color-foreground`). The primitives use Tailwind's default radii. | The init's base layer recolours the 132 bare `border` classes in `app/` and the body; removing the `prefers-color-scheme` block turns the body white in a dark OS; a class-based `dark` variant changes `ProgressBar.tsx:22`; the init's `--radius-sm` to `--radius-xl` would change the 192 `rounded-sm/md/lg/xl` uses. |
| G2. Packages added: `radix-ui` and `class-variance-authority` only, as dependencies with a `^` range like their neighbours. Not `cn`, `shadcn`, `tw-animate-css`, nor the `shadcn/tailwind.css` import. | Three unused or overlapping packages; `cn` 0.5.0 is days old and would replace a working `cn` helper. |
| G3. The generated primitives import `cn` from `@/lib/utils`, keep no `dark:` class, and their animation classes stay those `tailwindcss-animate` provides (`animate-in`, `fade-in-0`, `zoom-in-95` and their `out` pair). | A `dark:` class switches by the OS scheme here (no class strategy), so the dialog would change colour on a dark OS; a `tw-animate-css` class would not exist. |
| G4. Every confirm site keeps its handler's existing guards before the dialog opens, and its action call, toasts, refresh and error text after confirm; only the gate between them changes. | A converted site drifts behaviour (master plan risk on large pages); the AI bulk guards would run only after the confirm. |
| G5. `ConfirmDialog` sets its own surface, text and border colours by tone, the cancel button (the generated `outline` variant uses `bg-background`) included, and never relies on `--background`/`--foreground`: `admin` matches the admin palette (`#191C24` surface, `gray-700` border, light text), `learner` the light lesson palette (white surface, `gray-200` border, `gray-900` text) in both OS schemes. Set through `className` or a prop, not by changing a shared token. | A white dialog on the dark admin pages, a black learner dialog on a dark OS (the dark block switches `--background` to `#0a0a0a`), or a global token change for one screen (`frontend-design`). |
| G6. The dialog's overlay and content sit above every fixed layer of the pages that open it, at least above `LessonComments`' `z-70` panel: both `z-50` values in `components/ui/alert-dialog.tsx` become `z-80`. | The generated `z-50` dialog opens behind the comments panel, fully hidden on mobile; a `className` on the content cannot reach the overlay, which the generated content renders without props. |
| G7. `payment-admin.spec.ts` rows keep every assertion they make today; only the way the dialog is accepted changes. | A silently weaker payment test (master plan invariant). |
| G8. Every shadcn component file stays as generated except the edits G3 and G6 name; tone (G5) is applied from `ConfirmDialog`. | Hidden custom behaviour in files later units regenerate or extend. |

### 1.4 Owner decisions that bind this unit

- Master plan decision 4: nothing outside forms and dialogs is restyled.
- Master plan decision 2: `approvePayment` and `rejectPayment` are not changed; only the confirm in front of them on `/admin/transactions` (Appendix A).
- (2026-10-29) The plan gate runs as an independent read-only Opus 5.5 review at medium effort instead of Codex, which refused its model. (2026-10-29) The implementation diff gate runs the same way: an independent read-only Opus 5.5 session at medium effort reviews the whole diff after CP3 until PASS.

## 2. Repository facts

Baseline: `4179bf5` (`main` after PR 36), checked 2026-10-29.

- The 9 call sites: `coursesclient.tsx:126`, `chapters/page.tsx:98`, `lessons/page.tsx:171`, `:224`, `:271`, `transactions/page.tsx:50`, `:69`, `users/page.tsx:80`, `LessonComments.tsx:130` — AC1 to AC4, AC6. The AI bulk guards are at `lessons/page.tsx:268-269` — AC3, G4.
- `app/globals.css` (28 lines) has `--background`/`--foreground` on `:root`, a `prefers-color-scheme: dark` block that sets `--background: #0a0a0a`, and `body { font-family: Arial }`; `app/layout.tsx:28` puts `Inter` on `body` by class — G1, G5.
- No file in `app` imports `@/lib/utils`; `clsx` and `tailwind-merge` are used only there — G2 (keep the helper; the components become its first users).
- No class in `app` uses `primary`, `secondary`, `accent`, `muted`, `destructive`, `input`, `ring`, `popover` or `card` colour names, so the new colour tokens resolve no existing class — AC7. `app` has 132 bare `border` classes and 192 `rounded-sm/md/lg/xl` uses — G1.
- `app/(main)/profile/ProgressBar.tsx:22` uses `dark:bg-gray-700`, today driven by the OS scheme — G1, G3.
- `LessonComments.tsx:166` renders a `z-60` backdrop and `:171` a `fixed` panel, `w-full sm:w-[400px]`, `z-70` — G6, AC4.
- `__tests__/e2e/payment-helpers.ts:77` `acceptNextDialog` accepts a native dialog; `payment-admin.spec.ts` calls it in `[AP1]`, `[AP2]`, `[AP3]` and twice in `[K6]` — G7.
- `transactions/page.tsx:56` runs `approvePayment` inside `toast.promise`, whose `success` callback throws on `res.error` (`:59`); `:70` awaits `rejectPayment`. `sonner` 2.0.8 types `toast.promise(...).unwrap()` — AC5.
- Seed (`supabase/seed.sql`): courses 1 `Làm quen với HTML` (free) and 2 `JavaScript căn bản` (paid, holds the student's enrollment and payment) at `:40-41`; chapters 1 and 2 (`:44-45`); lessons 1 to 4 (`:48-51`); exercises 1 to 3 (`:90-92`); one comment by the student on lesson 3 (`:108`); users `learner`, `student`, `admin`. `npx supabase db reset` restores them — manual QA readiness.
- Trial install on `4179bf5` in a detached throwaway worktree (removed afterwards), `shadcn@4.23.0 init -t next -b radix` with `alert-dialog` and `button`:
  - the init adds `class-variance-authority` 0.7.1, `radix-ui` 1.8.1 (published 2026-10-14), `cn` 0.5.0, `tw-animate-css` 1.4.0 and `shadcn` 4.23.0 (dev), rewrites `lib/utils.ts` to `export { cn } from "cn"`, and rewrites `globals.css` (removes the `:root` hex values, the dark block and the `body` rule; adds `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`, `@custom-variant dark`, about 70 tokens including `--radius-sm` to `--radius-4xl`, `.dark` and a base layer) — G1, G2;
  - `button.tsx` holds 4 `dark:` classes; `alert-dialog.tsx` none; its overlay and content use `z-50` — G3, G6 (CP1 confirms that the content renders the overlay without passing props);
  - trimmed to G1 to G3 (original `globals.css` plus appended colour tokens only, no radius, original `lib/utils.ts`, only `radix-ui` and `class-variance-authority`, imports from `@/lib/utils`) with a throwaway page rendering the dialog: `npx tsc --noEmit` exit 0, `npm run lint` 0 problems, `npm run build` (CI placeholder env) exit 0, and the built CSS holds the `fade-in-0`/`zoom-in-95` classes from `tailwindcss-animate`. No type-only edit was needed. The trial did not diff the CSS or capture `npm audit` counts; CP1 does both.
  - Both added packages are MIT; `class-variance-authority` is the established shadcn dependency, `radix-ui` is maintained by the Radix team (`dependency-updates`, Add a package).

## 3. Bounded implementation hypotheses

- `components.json` as the trial wrote it (`style: new-york`, `baseColor: neutral`, aliases `@/components/ui`, `@/lib/utils`) — may change if later `shadcn add` still writes into `components/ui` and imports `@/lib/utils`.
- Tokens: a second `@theme inline` block mapping only the colour names the primitives use (`primary`, `secondary`, `accent`, `muted`, `destructive`, `border`, `input`, `ring` and their `-foreground`) and `:root` values from the light palette in use (`blue-600` primary, `gray-100` secondary and muted, `red-600` destructive, `gray-200` border) — may change if G1 and AC7 hold.
- `app/components/ConfirmDialog.tsx`: a controlled component (`open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `destructive`, `tone: "admin" | "learner"`, `onConfirm: () => Promise<unknown>`) built on `AlertDialog`; it keeps `pending` while `onConfirm` runs, calls `preventDefault` on the action click so it can await, blocks close while pending, catches a rejection of `onConfirm` (the site's toast already reports it) and closes in `finally`. Each site holds the target object in state (`useState<Course | null>`). A promise-based `useConfirm()` is an accepted alternative if AC5, AC6 and G4 hold.
- Transactions: the dialog names `profiles.full_name` or `Ẩn danh` (P15 unchanged), the course and the amount from the row; `onConfirm` awaits `approvePayment` through `toast.promise(...).unwrap()` or the action's own promise, keeping the same toasts.
- `payment-helpers.ts`: `acceptNextDialog` is replaced by `confirmDialog(page, name)` that clicks the named button inside `getByRole("alertdialog")`, called after the row button.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | shadcn base: `components.json`, the two primitives (G3, G8), tokens (G1), the two packages (G2), `ConfirmDialog` (G5, G6), the two `dependency-updates` rows. No call site changes yet. | `npx tsc --noEmit`; `npm run lint` 0 problems; `npm run build`; `npm audit` and `npm audit --omit=dev` compared with BL-009's 5 findings; `git diff app/globals.css` shows additions only; a diff of the compiled CSS (`.next/static/**/*.css`, formatted) of a baseline build and the CP1 build, both with the CI placeholder env, read rule by rule; the AC7 screenshots, taken on the local stack at the baseline before any edit and again after CP1: public pages by the implementor, the lesson page and `/admin/transactions` with the Owner signed in as the student and the admin in the implementor's browser pane. |
| CP2 | The 9 call sites use `ConfirmDialog` (AC1 to AC6, AC8); `payment-helpers.ts` and `payment-admin.spec.ts` click the dialog (G7); two new rows in `payment-admin.spec.ts` (below). | `npx tsc --noEmit`; `npm run lint`; `npx supabase db reset`, `npm run test:e2e` twice, `npm test`; the AC6 grep; the manual matrix below. |
| CP3 | Skills and docs (AC9): `frontend-design` Current stack, Confirm dialogs and final check, `admin-operations.md`; `CLAUDE.md` Code map; FEAT-006 `Done` and FEAT-005's U1 part; P21 resolved in `security-hotfix/problems.md` with a milestone in `security-hotfix/progress.md` citing the PR; State in `progress.md`. `test-quality-strategy` needs no change: it never mentions the native dialog, and the new helper lives in the spec files. | `npm run docs:check`; skill text read against the files after CP2 (each claim names a file that exists). |

E2e rows (`test-quality-strategy`, End-to-end; the payment fixtures already create and clean up an order):

- `[AP4] cancelling the reject dialog leaves the order pending and sends nothing`: open the dialog from `Hủy đơn này`, press cancel; assert no `POST` was seen (`page.on("request")`) from the open until the dialog is closed and the state is read back, `paymentById` still `pending`, `mailsSent()` equal to `[]`.
- `[AP5] the approve dialog stays open and disabled while the action runs`: after `page.goto`, hold the action `POST` with `page.route` until the test releases it, calling `route.fallback()` for every other request so the fixture's network guard still sees it; assert the confirm and cancel buttons are disabled and the dialog visible; release; assert `Duyệt đơn thành công!`, the dialog closed, `paymentById` `success`, and `mailsSent()` exactly one mail to `learner@devspace.test`. If the route cannot hold a server action request, CP2 reports it and M5 becomes the only check.

The other sites delete seed rows that a smoke row may not write (the data rule), so the manual matrix covers them, and `db reset` restores them.

Manual matrix (local stack, `frontend-workflow`; the Owner signs in, the agent drives). Readiness: the seeded data is enough; `npx supabase db reset` after the pass.

| # | Who | Action | Expected |
| --- | --- | --- | --- |
| M1 | admin | `/admin/courses`, delete course 1 `Làm quen với HTML`: cancel, then Escape, then confirm; light and dark OS scheme | dialog in the admin tone names the course and that its chapters and lessons are deleted; cancel and Escape keep it; confirm deletes with `Xoá thành công`. |
| M2 | admin | after `db reset`: `/admin/chapters` delete chapter 2; `/admin/lessons` delete lesson 4 `Hàm và vòng lặp`, then exercise 2 `Từ khóa nào khai báo hằng số?` | each dialog names its object; confirm deletes with the existing toast. |
| M3 | admin | `/admin/lessons`, AI bulk-create on lesson 3: cancel; and on an unsaved lesson | cancel sends no request to `generateQuizFromContent`; the unsaved case shows `Chưa lưu bài học` with no dialog. The confirm path calls Gemini and is the Owner's check on a deployment (`manual-ui-validation.md`). |
| M4 | admin | `/admin/users`, delete `learner@devspace.test` | dialog names the user and that it is permanent; confirm deletes. |
| M5 | admin | `/admin/transactions` with a learner order: double-click confirm on approve, press Escape while pending | one `POST`, dialog stays until done, then `Duyệt đơn thành công!`. The local mail send fails and is logged (`manual-ui-validation.md`); the toast is what counts here. |
| M6 | student | lesson 3, open the comments panel, delete the seed comment: cancel, confirm; at 375px and desktop, light and dark OS scheme | the dialog in the learner tone is fully visible above the panel; cancel keeps the comment; confirm removes it. |
| M7 | admin and student | keyboard only on M1 and M6 | focus enters the dialog, Tab is trapped, Escape cancels, focus returns to the trigger. |
| M8 | admin | M1 and M5 at 375px width | dialog fits with a margin, buttons stack, no horizontal scroll. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A token or CSS import still changes an existing screen. | G1, the compiled CSS diff and the AC7 screenshots at CP1, before any call site changes. |
| The dialog closes before the async action finishes, so a second submit is possible. | AC5, `preventDefault` on the action, `[AP5]`, M5. |
| A failed `onConfirm` rejects unhandled and fails an e2e row as a page error. | `ConfirmDialog` catches it (hypothesis), AC5. |
| The payment smoke breaks or stops asserting when the native dialog goes. | G7, the `confirmDialog` helper, `npm run test:e2e` twice in CP2, `[AP4]`, `[AP5]`. |
| `radix-ui` 1.8.1 is two weeks old and its portal or focus handling differs from older Radix. | AC8 and M7; a fault stops CP2 for a plan revision instead of a workaround. |
| Skill text describes something CP2 did not ship. | CP3 runs after CP2 and checks each claim against the files (master plan invariant). |

- Rollout runbook: none. No migration or hosted step; merging to `main` deploys to Vercel production, so CI is green and the manual matrix is done before the Owner merges.
- Stop when: a primitive needs a change beyond G3; a page changes in the CP1 comparison and G1 cannot prevent it; a payment row would have to drop an assertion; `npm audit` shows a new finding from the added packages.
- Rollback: a revert PR of the unit's merge commit. Nothing in the database changes, so nothing is left behind.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
