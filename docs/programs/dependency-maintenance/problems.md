# Problems, risks and follow-ups — dependency-maintenance

Charter: [README.md](README.md). Progress: [progress.md](progress.md).

## Open

### BL-009: security findings with no in-range fix

- Status: Open (2026-10-27, recorded by infrastructure U7; moved from `docs/backlog/` on 2026-10-27, charter decision 2).
- Problem: `npm audit` (2026-10-27) reports 5 findings that `npm audit fix` cannot fix in range: `nodemailer` 7.0.13 high, fixed only in 10.2.1 (with `@types/nodemailer`, which moves with it); `dompurify` critical, pinned exactly by the latest `monaco-editor` 0.57.0, and `monaco-editor` low through it; `@tailwindcss/typography` and `postcss-selector-parser` moderate, where npm offers only a downgrade. Dev-only: the `eslint-config-next` chain (`fast-glob`, `micromatch`, `braces`) is fixed only by a downgrade.
- Evidence: `npm audit` and `npm audit --omit=dev` on 2026-10-27, unchanged at the first dependency check on `3ea4a09`; infrastructure INF-001 left the same findings. The app never loads the npm `monaco-editor`: `@monaco-editor/loader` 1.7.0 loads 0.55.1 from the CDN, which `npm audit` cannot see, while the latest release is 0.57.0 (`dependency-updates`, Monaco row). The e2e mail guard (`__tests__/e2e/server-mail.cjs`, `patchMailerSource`) matches nodemailer 7's `sendMail` source and fails closed when it no longer finds it (found by the U7 AC8 planning session, PR 29 body).
- Direction: `nodemailer` 10 as its own major initiative (mail is a server path: the mail guard and the e2e mail record must keep stopping real sends); review the Monaco advisories against the CDN version 0.55.1 and decide whether to pin 0.57.0 through `loader.config`; wait for upstream fixes for the rest, re-checking at each dependency check. Never `npm audit fix --force`.
- Exit condition: `npm audit --omit=dev` reports no critical or high finding, and every remaining finding is accepted by the Owner in this entry.

### DM-001: runtime dependencies with no import

- Status: Open (2026-10-27, first dependency check).
- Problem: six packages in `dependencies` have no import in `app/`, `lib/`, `proxy.ts` or the config files: `@google/generative-ai` (the app uses `@google/genai`), `@radix-ui/react-slot`, `class-variance-authority`, `next-themes`, `qrcode.react` and `resend`. They are installed, audited and updated for nothing.
- Evidence: a search for each `dependencies` name in `app`, `lib`, `proxy.ts`, `next.config.ts` and `postcss.config.mjs` on `3ea4a09` (2026-10-27); `react-dom` also has no import but Next needs it.
- Direction: confirm each one with a wider search (dynamic imports, CSS, scripts), then remove the unused ones with `dependency-updates` (Remove a package) in a small initiative. `@radix-ui/react-slot` and `class-variance-authority` are what shadcn components use, so ask `app-foundation` before removing them.
- Exit condition: every package in `dependencies` is imported or kept with a stated reason in this entry.

### DM-002: dependency plans are written without a trial install

- Status: Open (2026-10-27, found during U1).
- Problem: the `dependency-updates` procedure and the U1 plan discovery read changelogs but never install the targets before the plan is approved, so type fallout of newer type definitions shows up only during implementation and stops it for a plan revision.
- Evidence: U1 stopped twice under G2 for type-only errors: `@supabase/supabase-js` 2.118.0 in `__tests__/rls/content.test.ts` (plan r2, D4) and `recharts` 3.10.1 in `app/components/TransactionChart.tsx` (plan r3, D5).
- Direction: after U1, add a discovery step to `dependency-updates` (through `skill-authoring`): install the targets in a throwaway copy of the checkout, run `npx tsc --noEmit`, `npm run lint` and `npm run build`, and record the fallout in the plan's repository facts; and state the type-only edit rule (U1 G7) there, so a later plan does not need it.
- Exit condition: the skill holds the trial install and the type-only edit rule.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- DM-003 — Resolved 2026-10-27: each sidebar realtime effect run cancels before it creates a channel and subscribes on its own topic, so no channel leaks and no `/learn` page logs the sidebar error (PR 31, `c7c8da4`, `e753175`).
