# DM-U3 detail plan — Audit cleanup of groups A and C

Revision: r1, 2026-11-01. Owner approval: 2026-11-01, after the Codex plan gate PASS. Master plan or charter: [charter](../../README.md) (Initiatives row DM-U3).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: DM-P1 groups A and C are fixed. `npm audit --omit=dev` reports only the group B findings (`dompurify` and `monaco-editor`), with no product behavior change, and the `dependency-updates` skill records the new override and the Monaco pitfall.

| ID | Observable result |
| --- | --- |
| AC1 | `package-lock.json` equals the result of `npm audit fix` (no `--force`) on the baseline plus the AC2 override: `gaxios` 7.3.1; `rimraf` and the `glob`/`minimatch`/`path-scurry` chain it pulled in are gone; `typescript-eslint` and `@typescript-eslint/*` 8.72.1 and the nested `ignore` 7.0.14 (dev); no other version changes (section 2 lists the trial diff). |
| AC2 | `package.json` gains exactly `"overrides": { "@tailwindcss/typography": { "postcss-selector-parser": "6.1.5" } }` and no other change; `npm ls postcss-selector-parser` shows 6.1.5 `overridden` under `@tailwindcss/typography` 0.5.20. |
| AC3 | `npm audit --omit=dev` reports 2 findings (1 low, 1 critical): `dompurify` and `monaco-editor`. `npm audit` reports no finding outside DM-P1. |
| AC4 | `npx tsc --noEmit`, `npm run lint` (0 problems) and `npm run build` pass; the CSS files of a clean build (`.next` removed first) are byte-identical to those of a clean build of the baseline. |
| AC5 | `npm test` and `npm run test:e2e` pass on the local stack after `npx supabase db reset`, with counts not lower than the baseline (263 and 60). |
| AC6 | On the PR, all CI jobs run and pass. |
| AC7 | Records: in `dependency-updates`, a row for the `postcss-selector-parser` override (where it is set, and that it is removed once `@tailwindcss/typography` no longer pins a version below 6.1.5) and a sentence in the Monaco row that Monaco vendors DOMPurify, so no `dompurify` override is added; DM-P1 says groups A and C are fixed by this PR once merged and stays open for group B; State and the DM-U3 row; the release notes of section 2 in the report and the PR body. |

### 1.2 Scope and non-goals

- In scope: `npm audit fix` without `--force` (group A and the dev `typescript-eslint` patch it brings); the `postcss-selector-parser` override (group C); the AC7 records and the two `dependency-updates` rows, edited under `skill-authoring` (Maintaining).
- Non-goals:
  - any edit of app code, config other than `package.json`, or tests;
  - group B: no `dompurify` override (Monaco vendors DOMPurify, DM-P1 evidence), no Monaco CDN change; both wait for the later PR with backlog BL-P4;
  - the dev-only `eslint-config-next` and `@typescript-eslint/typescript-estree` → `minimatch` chains, which npm fixes only by a downgrade;
  - `npm update`, `npm audit fix --force`, any other package.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Run `npm audit fix` without `--force` first, read its lockfile diff against AC1 before keeping it, then add the override with `npm pkg set "overrides.@tailwindcss/typography.postcss-selector-parser=6.1.5"` and `npm install`. Never `npm update` or `--force`. | A downgrade or an unlisted package slips in. |
| G2. Any failing check, a lockfile change outside AC1, a CSS difference under AC4, or a needed edit of any file other than `package.json`, `package-lock.json` and the AC7 records stops the implementor; it reports to Main and edits nothing else. | A styling or runtime change ships as an audit cleanup. |
| G3. Local stack only; nothing reaches hosted. | An update test writes to production. |
| G4. If `npm audit fix` resolves versions other than those in section 2 (a newer release appeared), stop and report the new versions to Main. | The plan's trial no longer covers the installed code. |

### 1.4 Owner decisions that bind this initiative

- Charter decisions 1 to 3: this program owns the work; DM-U3 updates several packages at once, so it gets a detail plan and the Codex gate on its plan and on its diff.
- D1 (2026-11-01) The Owner chose two PRs: this one for groups A and C, and a later one for the Monaco CDN pin with the `/try_it` fixes (backlog BL-P4). The same branch carries the docs catch-up from PR 47 and the BL-P4 record.
- D2 (2026-11-01) Group C is fixed by an override to 6.1.5, not by accepting the risk: the change is one `package.json` entry and the built CSS does not change (section 2).

## 2. Repository facts

Baseline: `f900b18`, checked 2026-11-01 (`npm audit`, `npm ls`, trial install).

- `npm audit --omit=dev` on the baseline: 8 findings (1 low, 6 moderate, 1 critical); `npm audit`: 23 — justifies AC3.
- Group A: `@google/genai` 1.52.0 → `google-auth-library` 10.5.0 → `gaxios` 7.1.3 → `rimraf` 5.0.10 → `glob` 10.5.0 → `minimatch` 9.0.9. `gaxios` 7.3.1 no longer depends on `rimraf`. Release notes 7.1.5 to 7.3.1 (googleapis/google-cloud-node): dependency bumps, repository URL fixes, "Prevent comma corruption when draining stream error responses" (7.1.6), regenerated sources; no breaking change named. 7.1.4 has no GitHub release. `app/action/gemini.ts` creates `GoogleGenAI({ apiKey })`; no test calls Gemini (infrastructure master plan decision 7) — justifies AC1 and the residual risk in section 5.
- Group C: `@tailwindcss/typography` 0.5.20 (latest) pins `postcss-selector-parser` 6.0.10 exactly. 6.1.5 is the security backport for the 6.x line (its CHANGELOG: linear-time parsing of flat selectors, GHSA-rj75-hqrm-r3gf; the 6.x line is security-only from 6.1.5). The CHANGELOG from 6.0.10 to 6.1.5 lists: 6.0.11 attribute case-insensitivity flag parsed; 6.0.12, 6.0.14 to 6.0.16 and 6.1.1 type-definition fixes; 6.0.13 throws on unexpected pipe symbols; 6.1.0 adds `sourceIndex` to `Selector` nodes; 6.1.2 fixes erroneous trailing combinators in pseudos; 6.1.3 another CVE backport (GHSA-w9m9-85wc-3x92); 6.1.4 tolerates non-node children when serializing. No release is marked breaking. The only behavior changes that could reach the plugin are 6.0.11, 6.0.13 and 6.1.2; the typography selectors use no pipe and the clean-build CSS comparison below shows no output change. The plugin is loaded only by `@plugin "@tailwindcss/typography"` in `app/globals.css` and used by `prose` classes in `app/components/LessonContent.tsx` — justifies AC2 and AC4.
- Trial install (`git worktree add --detach` at `f900b18`, `npm ci`, removed afterwards): `npm audit fix` changed only `package-lock.json` (79 insertions, 446 deletions): `gaxios` 7.1.3 → 7.3.1; `typescript-eslint` and `@typescript-eslint/*` 8.72.0 → 8.72.1 and their `ignore` 7.0.13 → 7.0.14 (dev); removed `rimraf`, `glob`, `minimatch` 9.0.9, `path-scurry`, `jackspeak`, `foreground-child`, `minipass`, `signal-exit`, `package-json-from-dist`, `@isaacs/cliui`, `@pkgjs/parseargs` and their `string-width`/`strip-ansi`/`wrap-ansi` helpers. Then `npm audit --omit=dev` reported 4 findings. After the override, 2 (`dompurify`, `monaco-editor`). `npx tsc --noEmit`, `npm run lint`, `npm run build` (CI placeholder env) and `npx vitest run --project unit` (173/173) passed; the CSS of a clean build with the override was byte-identical to the build before it (same four files, same MD5), and it holds 81 `.prose` rules — justifies AC1 to AC4.
- Monaco 0.57.0 vendors DOMPurify 3.4.15 in `esm/vs/base/browser/dompurify/dompurify.js` (inlined in `min` and `dev`) and imports no `dompurify` package — justifies the group B non-goal and the AC7 Monaco sentence.
- Baseline counts: `npm test` 263 and `npm run test:e2e` 60 (DM-U2, PR 47) — justifies AC5.

## 3. Bounded implementation hypotheses

- Two local commits: `chore(deps): apply in-range audit fixes and override postcss-selector-parser` with `package.json` and `package-lock.json`, then `docs(dependency-maintenance): ...` with the skill rows and records — may change to one commit per group if each still holds its own lockfile change.
- AC4 compares MD5 of the concatenated `.next/static/**/*.css` of two clean builds (baseline worktree and branch) — may change to another byte comparison if it covers every CSS file.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Groups A and C applied (AC1, AC2). | Lockfile diff read against AC1; `npm ls gaxios postcss-selector-parser`; `npx tsc --noEmit`, `npm run lint`, clean `npm run build` with the AC4 CSS comparison; `npm run test:unit`. |
| CP2 | Full verification and records (AC3, AC5, AC7). | `npx supabase db reset`, `npm test`, `npm run test:e2e`, then `npm run build`; `npm audit` and `npm audit --omit=dev`; skill rows, DM-P1, State and the DM-U3 row; `npm run docs:check`. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| `postcss-selector-parser` 6.1.5 changes the CSS the typography plugin emits. | AC4 byte comparison of clean builds; G2 stops on any difference. |
| `gaxios` 7.3.1 changes a Gemini call path (admin AI Magic) that no test exercises. | Release notes name no breaking change; with an API key the path through `google-auth-library` may not be used at all (not verified). AI Magic is checked by hand only if the Owner's Gemini key works; otherwise it stays not verified and production use reveals it. |
| The dev `typescript-eslint` patch changes lint results. | `npm run lint` must stay at 0 problems (AC4). |

- Rollout runbook: none; no hosted step. Vercel deploys when the PR merges.
- Stop when: G2 or G4 triggers; a check fails twice after an in-scope fix.
- Rollback: revert the PR; nothing hosted changes.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
