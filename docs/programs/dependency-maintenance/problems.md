# Problems, risks and follow-ups — dependency-maintenance

Charter: [README.md](README.md). Progress: [progress.md](progress.md).

## Open

### DM-P1: security findings with no in-range fix

- Status: Open (2026-10-27, recorded by infrastructure U7; moved from `docs/backlog/` on 2026-10-27, charter decision 2).
- Problem: after `nodemailer` was fixed by DM-U2 (PR 47, `f900b18`), `npm audit --omit=dev` reports 8 findings (1 low, 6 moderate, 1 critical) and `npm audit` 23. Three groups: (A) `gaxios`, `rimraf`, `glob`, `minimatch` moderate through `@google/genai` → `google-auth-library` → `gaxios` 7.1.3, fixable in range; (B) `dompurify` critical and `monaco-editor` low; (C) `@tailwindcss/typography` and `postcss-selector-parser` 6.0.10 moderate, where npm offers only a downgrade. Dev-only: the `eslint-config-next` chain and a `minimatch` chain under `typescript-eslint`.
- Evidence: on `f900b18` (2026-11-01), `npm audit fix --dry-run` moves `gaxios` to 7.3.1, which drops `rimraf` and its `glob`/`minimatch` chain, and `typescript-eslint` to 8.72.1. `@tailwindcss/typography` 0.5.20 (latest) pins `postcss-selector-parser` 6.0.10 exactly; the fix is 6.1.5, the last 6.x. Group B is not fixable by npm although `npm audit` reports "fixAvailable": `monaco-editor` 0.57.0 (latest) vendors DOMPurify 3.4.15 inside its code (`esm/vs/base/browser/dompurify/dompurify.js`, inlined in `min` and `dev`) and never imports the `dompurify` package, so an npm `overrides` entry changes only an unused package and would hide the finding without patching the running code. Until DM-U4 the app ran Monaco 0.55.1 from the CDN, which `npm audit` could not see (vendored DOMPurify 3.2.7). Monaco 0.57.0's `domSanitize.js` uses hooks and `RETURN_DOM_FRAGMENT` but not `IN_PLACE`, `SAFE_FOR_TEMPLATES` or `PARSER_MEDIA_TYPE`, the modes the five advisories need; 0.55.1 was not inspected. A crafted `/try_it?code=...` link puts third-party text into the editor ([backlog BL-P4](../../backlog/problems.md)), so the sanitizer can see content the learner did not write.
- Direction: groups A and C were fixed by [DM-U3](implementation-plans/dm-u3-audit-cleanup/plan.md) (PR 48, `0666754`: `npm audit fix` without `--force`, and an `overrides` entry for `postcss-selector-parser`); `npm audit --omit=dev` now reports only group B (2 findings). The entry stays open for group B: no `dompurify` override; [DM-U4](implementation-plans/dm-u4-monaco-self-host/plan.md) serves Monaco from the npm package (0.57.0, DOMPurify 3.4.15) instead of the CDN (0.55.1, DOMPurify 3.2.7), together with the `/try_it` fixes of BL-P4; DM-U4 delivered this in PR 49 (`1bc9802`), so `npm audit` now sees the running version; then wait for a Monaco release that bundles DOMPurify 3.4.17 or later, re-checking at each dependency check. Never `npm audit fix --force`.
- Exit condition: `npm audit --omit=dev` reports no critical or high finding, and every remaining finding is accepted by the Owner in this entry.

### DM-P2: `next build` stops on a Next.js security advisory

- Status: Open (2026-11-24, found during the AW-U15 final regression).
- Problem: under an agent session, `npm run build` with the installed `next` 16.4.3 compiles and lists the routes, then exits 1 with `Error [SecurityFatalError]: Your version of Next.js is affected by a known security vulnerability.` The stop comes from the upgrade nudge in `node_modules/next/dist/lib/upgrade/nudge.js`, which branches on agent detection and on CI, so an agent's local final regression has no build evidence. Whether the CI `build` job or a build in the Owner's own shell stops too is not verified.
- Evidence: on `e73ed80` with Node v26.13.0, two agent runs of `npm run build` on 2026-11-24 ended the same way after `Compiled successfully`; the change under test touched no Next code or config.
- Direction: identify the advisory and the fixed `next` version with `npm audit` and the npm advisory, then update `next` with `eslint-config-next` under [dependency-updates](../../../.claude/skills/dependency-updates/SKILL.md) as its own task with the Owner's grant. Do not run an upgrade the build output suggests without that grant.
- Exit condition: `npm run build` passes on the updated `next`, or the Owner records a decision for this advisory.


## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- DM-003 — Resolved 2026-10-27: each sidebar realtime effect run cancels before it creates a channel and subscribes on its own topic, so no channel leaks and no `/learn` page logs the sidebar error (PR 31, `c7c8da4`, `e753175`).
- DM-001 — Resolved 2026-10-28: six unused runtime packages removed at PR #32; later feature work may add packages again (PR 32, `1c99b77`).
- DM-002 — Resolved 2026-10-28: dependency-updates requires a trial install and bounds type-only fallout edits (PR 32, `1c99b77`).
