---
name: frontend-design
description: "Product-aware UI and UX design for DevSpace screens: learner pages, public pages and admin pages. Covers product grounding, a plan then a critique, action hierarchy, states, confirm dialogs, responsive layout, accessibility and natural Vietnamese copy within the current stack. Use when building or reshaping pages, components, dialogs, forms, tables or other product-facing UI."
---

# Frontend design

## Use when / do not use when

Use for product-facing UI work: pages, components, learning screens, admin workflows, dialogs, forms, tables, responsive behavior, accessibility and feedback.

Do not use for logic with no visible change, or for data and state mechanics (`frontend-workflow`). If the task also touches a server action or the database, use `server-actions` and `supabase-migration`.

## Current stack (only what exists)

Next.js App Router, React 19, Tailwind CSS 4 (`app/globals.css`), `lucide-react` icons, `sonner` toasts (`<Toaster richColors position="top-right" />` in `app/layout.tsx`), and feature components in `app/components/`. shadcn primitives sit in `components/ui/` (`button`, `alert-dialog`; `components.json`) on `radix-ui` and `class-variance-authority`. There is **no form library and no Zod yet**: they arrive with the later units of the app-foundation program ([ADR 0003](../../../docs/adr/0003-app-foundation-program.md)), which updates this skill. Packages, fonts and an animation library are outside a design task unless the Owner asked for them (`AGENTS.md` section 4).

Adding a primitive: `npx shadcn add <name>`, never `npx shadcn init` (it rewrites `app/globals.css` and `lib/utils.ts` and installs `cn`, `shadcn` and `tw-animate-css`). Then edit the generated file as `button.tsx` and `alert-dialog.tsx` were edited, and no further:

- import `cn` from `@/lib/utils` (the generator writes `from "cn"`); `shadcn add` also installs the `cn` package into `package.json` and the lockfile, so run `npm uninstall cn` and check the `package.json` and `package-lock.json` diff for anything beyond the packages the plan names;
- delete every `dark:` class: the repo has no class-based dark mode, so a `dark:` class would follow the OS scheme;
- animation classes stay those of `tailwindcss-animate` (`animate-in`, `fade-in-0`, `zoom-in-95`); a `tw-animate-css` class does not exist here;
- overlay and content of a dialog sit at `z-80`, above `LessonComments` (`z-70`).

`app/globals.css` holds an add-only block of shadcn colour tokens (`--primary` to `--ring`) mapped to the palette the pages use, and no radius tokens, base layer or `.dark` block: the pages rely on bare `border` and `rounded-*` classes. `--background` and `--foreground` flip with the OS colour scheme while the admin pages are always dark and the learner pages light, so a shadcn component on those screens sets its own surface and text colours (see `ConfirmDialog`) instead of using them.

## Classify the screen first

| Type | Where | Latitude | Reference |
| --- | --- | --- | --- |
| Public / marketing | home, course discovery, `try_it`, `login` | high | [client-marketing.md](references/client-marketing.md) |
| Learning experience | `learn`, `quiz`, lesson pages, `profile` progress | medium-high | [learning-experience.md](references/learning-experience.md) |
| Admin / operations | `app/admin/*` (courses, chapters, lessons, users, transactions) | medium | [admin-operations.md](references/admin-operations.md) |

Read every reference whose row matches before designing; skip the others. A shared component such as `Header` or `Sidebar` is not changed for one screen: use `className` or composition at the usage site, and inspect all usages before touching it. Change a shared component only when the change is truly global, usage-site customization is insufficient, and the change is backward-compatible or the Owner approved it. Never change dialog width, button radius, card padding or table density globally for one screen.

Scale the process to the change:

- **Local cosmetic fix:** state the screen type, the user goal and why the fix fits the existing look. No new palette or signature.
- **New component or a substantial reshape:** a compact design plan and a short critique before building.
- **New page or redesign:** the full plan, two layout concepts and the critique below.

## Plan, then critique

1. **Ground in the real screen:** the feature, the audience (learner, visitor, admin), the screen's single job, the vocabulary of programming courses, and the identity already in the repo.
2. **Plan:** reuse the existing colors and Tailwind patterns; say which tokens stay. Define type roles by scale and weight with the current font stack. Describe one or two layout concepts (prose or a small ASCII sketch). Name one structural or state-language element the screen should be remembered by, taken from the subject (recall, progress, correction, completion), not a random gradient or decoration.
3. **Critique before building:** could this direction fit any SaaS landing page unchanged? Does it lean on generic purple gradients, glassmorphism, bento cards, pill buttons everywhere or floating icons? If it is generic, revise and say what changed.

## Hierarchy, dialogs and feedback

- One obvious primary action; secondary actions subordinate (outline or ghost); destructive actions separated and styled as destructive.
- **Confirm dialogs.** Destructive and payment actions confirm in `ConfirmDialog` (`app/components/ConfirmDialog.tsx`, on `components/ui/alert-dialog.tsx`); no `window.confirm` remains in `app`, so do not add one. It is a controlled component: `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `cancelLabel` (default "Hủy"; set it when that word clashes with the action, as "Giữ đơn hàng" on the reject dialog), `destructive`, `tone` (`admin` or `learner`, which picks the surface) and `onConfirm`, which returns a promise. The description names the object, the action and its consequence (read the foreign keys before claiming what a delete removes). While `onConfirm` runs both buttons are disabled and Escape is ignored; a rejection is swallowed, so the handler must catch its own failures (a resolved error and a rejected call) and toast them, and the dialog closes when it settles.
  - The site keeps the target object in state and mounts the dialog only while a target exists (`{target && <ConfirmDialog open onOpenChange={() => setTarget(null)} … />}`): focus returns to the element focused at mount, which is the control that opened it.
  - The handler that opened the old `window.confirm` keeps its guards before the dialog opens; `onConfirm` calls the existing action, toast and refresh. `app/admin/transactions/page.tsx` passes `toast.promise(...).unwrap()` so the dialog stays pending until the payment action ends.
  - The hand-written modals (`fixed inset-0` in admin pages, `CoursePaymentModal`) are not part of it.
- Follow the existing toast convention (`sonner`). Feedback says what succeeded or failed, what stays editable and what to do next. No route-specific toast theming.
- Do not fake success for behavior that is not integrated.

## States and edge cases

Design more than the happy path: loading, empty, error, success, pending, disabled, permission denied, stale or partial data. Also null values, long text, missing images, slow or failed requests, repeated actions and empty lists. An empty state says what happened and what to do next. Preserve user input after a recoverable failure and prevent double submission.

## Responsive and accessibility

Check about 375px, tablet and desktop; long content; table overflow; dialog width; wrapping buttons; tap targets. Note that `MobileBlocker` exists: find out where it applies before assuming mobile support. Accessibility floor (WCAG 2.2 AA): semantic controls (a `button`, not a clickable `div`), labels and dialog titles, visible focus, names on icon buttons, text contrast 4.5:1 (3:1 for large text), non-text contrast 3:1 (focus indicators, control boundaries, meaningful icons), pointer targets at least 24 x 24px or spaced equivalently, content usable at 200% zoom and 320px width without two-dimensional scrolling (tables excepted), focus never fully hidden behind sticky or overlay content, color never the only signal, errors that name the field and the fix, keyboard order that follows the task, reduced-motion respected. Compute contrast from real values and inspect rendered geometry; report any threshold you did not check as not verified.

## Copy

UI copy is natural Vietnamese, written from the user's side: active voice, plain verbs, consistent terms across a flow (an action called "Xuất bản" ends in "Đã xuất bản"). Errors say what happened and how to fix it; empty states point to the next step. No filler, no implementation jargon, no apologies.

## Motion

Only to clarify state or support learning: hover and focus transitions, dialog open and close, answer reveal, progress, completion feedback. Never delay repeated actions or ignore reduced motion. The completion `canvas-confetti` is allowed where it already fits.

## Boundaries and output

Prefer existing components and usage-site customization. Do not invent paths or APIs, rewrite a large module for a small UI task, refactor other screens or touch the database from a UI-only task. Summarize: screen type and latitude; grounding and direction for substantial work; files changed; shared components touched (yes/no); states handled; responsive and accessibility notes; what was inspected in the browser; what was left unchanged.

## Resources

| Resource | Read when | Skip when |
| --- | --- | --- |
| [client-marketing.md](references/client-marketing.md) | home, discovery, pricing, login or other public pages | learner or admin screens |
| [learning-experience.md](references/learning-experience.md) | lessons, quizzes, progress, profile learning views | public or admin screens |
| [admin-operations.md](references/admin-operations.md) | anything under `app/admin` or an operational table or confirmation | learner or public screens |

## Final check

- [ ] screen type, latitude and direction are right; substantial work has grounding, a plan and a critique
- [ ] primary, secondary and destructive actions are clear; destructive flows confirm in `ConfirmDialog` with context
- [ ] states, long and missing data, mobile and overflow are handled
- [ ] semantic controls, focus and contrast checked or marked not verified
- [ ] shared components untouched unless the change is global and inspected; no new library added
