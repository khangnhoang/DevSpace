# Problems, risks and follow-ups — dependency-maintenance

Charter: [README.md](README.md). Progress: [progress.md](progress.md).

## Open

### DM-P1: security findings with no in-range fix

- Status: Open (2026-10-27, recorded by infrastructure U7; moved from `docs/backlog/` on 2026-10-27, charter decision 2).
- Problem: `npm audit` (2026-10-27) reports 5 findings that `npm audit fix` cannot fix in range: `nodemailer` 7.0.13 high, fixed only in 10.2.1 (with `@types/nodemailer`, which moves with it); `dompurify` critical, pinned exactly by the latest `monaco-editor` 0.57.0, and `monaco-editor` low through it; `@tailwindcss/typography` and `postcss-selector-parser` moderate, where npm offers only a downgrade. Dev-only: the `eslint-config-next` chain (`fast-glob`, `micromatch`, `braces`) is fixed only by a downgrade.
- Evidence: `npm audit` and `npm audit --omit=dev` on 2026-10-27, unchanged at the first dependency check on `3ea4a09`; infrastructure INF-001 left the same findings. The app never loads the npm `monaco-editor`: `@monaco-editor/loader` 1.7.0 loads 0.55.1 from the CDN, which `npm audit` cannot see, while the latest release is 0.57.0 (`dependency-updates`, Monaco row). The e2e mail guard (`__tests__/e2e/server-mail.cjs`, `patchMailerSource`) matches nodemailer 7's `sendMail` source and fails closed when it no longer finds it (found by the U7 AC8 planning session, PR 29 body).
- Evidence (2026-11-01, on `3e4b941`): `npm audit --omit=dev` 9 findings (1 low, 6 moderate, 1 high, 1 critical), `npm audit` 24; `nodemailer` now has 20 advisories over `<=10.1.3`, and npm's fix is 10.3.1. New since 2026-10-27, moderate and fixable in range: `glob`, `minimatch`, `rimraf` and `gaxios` through `@google/genai` → `google-auth-library` on the production tree, plus a `minimatch` chain in the eslint dev tree; npm now also marks the `dompurify`/`monaco-editor` findings fixable in range. None of these was acted on.
- Evidence (2026-11-01, on the DM-U2 branch `chore/dm-u2-nodemailer-10`): with `nodemailer` 10.3.1 and without `@types/nodemailer`, the `nodemailer` finding is fixed locally and awaits delivery: `npm audit --omit=dev` reports 8 findings (1 low, 6 moderate, 1 critical) and `npm audit` 23 (1 low, 21 moderate, 1 critical), none for `nodemailer`. The remaining findings are the ones above; the Gmail SMTP send under nodemailer 10 is not verified before merge (DM-U2 plan, section 5). DM-P1 stays open for them.
- Direction: `nodemailer` 10 is [DM-U2](implementation-plans/dm-u2-nodemailer-10/plan.md), its own major initiative (mail is a server path: the mail guard and the e2e mail record must keep stopping real sends); fixed by that PR once merged; review the Monaco advisories against the CDN version 0.55.1 and decide whether to pin 0.57.0 through `loader.config`; wait for upstream fixes for the rest, re-checking at each dependency check. Never `npm audit fix --force`.
- Exit condition: `npm audit --omit=dev` reports no critical or high finding, and every remaining finding is accepted by the Owner in this entry.


## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- DM-003 — Resolved 2026-10-27: each sidebar realtime effect run cancels before it creates a channel and subscribes on its own topic, so no channel leaks and no `/learn` page logs the sidebar error (PR 31, `c7c8da4`, `e753175`).
- DM-001 — Resolved 2026-10-28: six unused runtime packages removed at PR #32; later feature work may add packages again (PR 32, `1c99b77`).
- DM-002 — Resolved 2026-10-28: dependency-updates requires a trial install and bounds type-only fallout edits (PR 32, `1c99b77`).
