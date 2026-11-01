# DM-U4 detail plan — Self-hosted Monaco and the Try It fixes

Revision: r1, 2026-11-01. Owner approval: 2026-11-01, after the Codex plan gate PASS. Master plan or charter: [charter](../../README.md) (Initiatives row DM-U4).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: `/try_it` loads Monaco from the app's own origin, at the version `package-lock.json` holds, so `npm audit` sees the code that runs (DM-P1 group B); and "Thử ngay" opens a lesson example in Try It in its own language with the exact code (backlog BL-P4).

| ID | Observable result |
| --- | --- |
| AC1 | `monaco-editor` is a direct dependency (`^0.57.0`, lockfile 0.57.0). Opening `/try_it` loads `loader.js`, the editor and its workers from `/monaco/vs/` on the app's origin, and makes no request to `cdn.jsdelivr.net` or any other host. |
| AC2 | `npm run monaco:copy` leaves an exact copy of `node_modules/monaco-editor/min/vs` in `public/monaco/vs`: an older copy and any stale file are removed first, and a missing source exits nonzero with a message naming the folder. `postinstall` runs it, so every `npm ci` and every `npm install` without a package argument (local, CI, Vercel) produces the copy; a package-specific `npm install <pkg>` does not run `postinstall` (npm 11), so the `dependency-updates` Monaco row requires `npm run monaco:copy` after one. `public/monaco/` is ignored by git and by ESLint. `npx tsc --noEmit`, `npm run lint` (0 problems) and `npm run build` pass. |
| AC3 | Try It shows the `code` parameter exactly as "Thử ngay" sent it: no second decode. Code holding `width: 50%;`, `a%20b` or `printf("%d", x);` opens without a page error and the editor value equals the lesson code character for character. |
| AC4 | "Thử ngay" reads the language of its code block: `language-html` opens the HTML tab, `language-js` and `language-javascript` the JavaScript tab, `language-cpp` and `language-c++` the C++ tab; a block with no language opens the HTML tab as today; a block with any other language shows no "Thử ngay" button (Copy stays). A missing or unknown `lang` parameter opens the HTML tab. |
| AC5 | Switching to the tab of the example's language shows the example again; any other tab shows its default code, as today. |
| AC6 | Unchanged: a crafted `/try_it?code=...` link still loads its text into the editor and runs nothing until "Chạy Code"; the iframe keeps `sandbox="allow-scripts allow-modals"`; C++ still posts to the Piston API. |
| AC7 | Verification allocation (section 4): unit rows for the copy script (AC2) and the language and parameter helpers (AC3, AC4 aliases, missing and unknown `lang`); e2e rows for the self-hosted editor and its workers (AC1), the lesson-page "Thử ngay" paths (AC3 to AC5) and the crafted link (AC6). `[S5]` loses `blockedMonacoLoader`, and the Monaco exception is removed from `__tests__/e2e/fixtures.ts` and `test-quality-strategy`. `npm run test:unit`, `npm test` (≥ 263) and `npm run test:e2e` (≥ 60 plus the new rows, run twice) pass. |
| AC8 | On the PR's Vercel preview, `/try_it` loads `loader.js`, the editor and a language worker from `/monaco/vs/` with status 200, invalid JavaScript in the editor gets a diagnostic marker (the worker runs), and the `Cache-Control` header of `/monaco/vs/loader.js` is recorded in the PR body (Main, or the Owner if the preview needs a sign-in). CI is green. |
| AC9 | Records: the `dependency-updates` Monaco row, description, Use when and Dependency check say the version comes from the npm package; the charter capability line likewise; DM-P1 says group B is served from npm 0.57.0 (DOMPurify 3.4.15) and stays open until a Monaco release bundles DOMPurify 3.4.17 or later; BL-P4 is `Fixed locally, awaiting delivery`; State and milestones. |

### 1.2 Scope and non-goals

- In scope: the `monaco-editor` dependency, the install copy script and its hook, `.gitignore`, `eslint.config.mjs`, `loader.config` in `app/(main)/try_it/page.tsx`, the Try It and `PreBlock` fixes with a pure helper and its unit tests, the e2e rows and the removal of the Monaco network exception, the AC9 records.
- Non-goals:
  - bundling Monaco through Next (ESM import, `loader.config({ monaco })`, worker setup);
  - any `dompurify` override (Monaco vendors DOMPurify);
  - filtering or sanitizing HTML or JavaScript in Try It, changing the iframe sandbox or the Piston call;
  - any other `@monaco-editor/*` version change, `npm update`, `npm audit fix`;
  - lesson content, schema, server actions.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The copy runs from the `postinstall` script, so every install path (Vercel's install, CI `npm ci`, a trial worktree) produces it; `npm run dev`, `npm run build` and `scripts/e2e/serve.mjs` stay unchanged. | One of the three paths serves no editor, found only on the deploy. |
| G2. The script copies `node_modules/monaco-editor/min/vs` as is, removes the old copy first, and throws when the source is missing. | A stale or partial copy serves a different Monaco than the lockfile names. |
| G3. Install `monaco-editor` with `npm install monaco-editor@^0.57.0`, then run `npm run monaco:copy` (the package-specific install does not run `postinstall`), and read the lockfile diff: the root entry gains the dependency and the install script metadata, `monaco-editor` stops being a peer-only entry, and no package version changes. Stop and report otherwise. | An unrelated package update rides along. |
| G4. Code stays text: no `eval`, `innerHTML` or `dangerouslySetInnerHTML` added; `lang` is matched against the three values only. | A crafted link gains a new execution path. |
| G5. Any failing check, a needed edit outside section 1.2, or a CI-only or Vercel-only difference stops the implementor; it reports to Main. Local stack only. | A deploy-path change ships unverified. |

### 1.4 Owner decisions that bind this initiative

- Charter decisions 1 to 3. This initiative changes the install step that Vercel and CI run, so it gets the Codex gate on its plan and on its diff (`AGENTS.md` section 2, CI or deploy).
- D1 (2026-11-01) Monaco is self-hosted from the npm package (copied to `public/` at install), not loaded from the CDN, and ships in one PR with the BL-P4 fixes. Bundling Monaco was not chosen.
- D2 (2026-11-01) A code block in another named language gets no "Thử ngay" button; a block with no language keeps opening the HTML tab.
- D3 (2026-11-01) The Owner allowed one read-only hosted query that counts code-fence languages in lesson content (section 2).

## 2. Repository facts

Baseline: `0666754`, checked 2026-11-01.

- `@monaco-editor/react` 4.7.0 uses `@monaco-editor/loader` 1.7.0, whose default `paths.vs` is `https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs`; the app sets no `loader.config` (`node_modules/@monaco-editor/loader/lib/es/config/index.js`). `monaco-editor` 0.57.0 is in the lockfile only as the peer of `@monaco-editor/react` (`package.json` has no entry). `npm audit --omit=dev` reports `dompurify` critical and `monaco-editor` low (range `>=0.57.0-rc.2`, via `dompurify`) — justifies AC1 and AC9.
- Vendored DOMPurify, read from the published tarballs (`esm/vs/base/browser/dompurify/dompurify.js` licence header): 0.55.1 has 3.2.7, 0.56.0 has 3.4.8, 0.57.0 has 3.4.15. The five advisories need 3.4.17. Monaco CHANGELOG 0.55.1 to 0.57.0: 0.56.0 breaks only the ESM entry points, renames `IOverlayWidgetPosition.stackOridinal` and removes the `IMirrorModel`/`IWorkerContext` types (none used here); 0.57.0 adds editor options and updates DOMPurify — justifies D1 and the non-goal on bundling.
- Trial (2026-11-01, throwaway worktree at `0666754`, `npm ci`, removed afterwards): a script copying `node_modules/monaco-editor/min/vs` to `public/monaco/vs` (25 MB, 151 files), `loader.config({ paths: { vs: "/monaco/vs" } })` in the Try It page, `public/monaco/**` added to the ESLint ignores: `npx tsc --noEmit`, `npm run lint` and `npm run build` (CI placeholder env) pass. On `next start`, `/try_it` loaded `loader.js`, `editor.main.js` and the html/css/json/ts workers from `/monaco/vs/` (23 requests, about 1.2 MB transferred), no request left the origin, and no Monaco error was logged. Resolving `monaco-editor/package.json` through `require.resolve` fails (the package's `exports`), so the script reads `node_modules/monaco-editor/min/vs` by path. The same run reproduced BL-P4: `/try_it?code=<p>50%</p>` logged `URIError: URI malformed` — justifies AC1, AC2, G1, G2 and AC3.
- Install paths: Vercel's project (`vercel project inspect devspace`) uses the Next.js preset with the default install command (`npm install`) and build command (`npm run build`); CI jobs run `npm ci` (`.github/workflows/ci.yml`); `scripts/e2e/serve.mjs` and `scripts/dev/local.mjs` call `next build`, `next start` and `next dev` directly, not `npm run build` — justifies G1 (`postinstall`, not `prebuild`).
- `tsconfig.json` includes only `.ts`, `.tsx`, `.mts`; `eslint.config.mjs` lints `.js` by default and ignores only `.next`, `out`, `build`, `next-env.d.ts`, `playwright-report`, `test-results` — justifies the ESLint ignore in AC2.
- `app/components/PreBlock.tsx:22-28` opens `/try_it?code=${encodeURIComponent(innerText)}`; `app/(main)/try_it/page.tsx:48-51` starts `language` at `"html"` and calls `decodeURIComponent` on the already decoded `searchParams.get("code")`; `page.tsx:56-60` replaces the code with the default on every tab switch; `LessonContent.tsx` renders lessons with `MDXRemote` and `pre: PreBlock`, so a fenced block arrives as `<pre><code class="language-…">` — justifies AC3 to AC5.
- Hosted lesson content (D3, 2026-11-01, `npx supabase db query --linked`, counts only): 80 lessons; fence openers `html` 130, `js` 116, `javascript` 62; about two fences without a language; no `cpp`, `c++` or other language — justifies the AC4 aliases.
- E2E: the network guard blocks every non-local host, and `[S5]` (`__tests__/e2e/public.spec.ts`) uses `blockedMonacoLoader`, which `fixtures.ts:18-22` and `test-quality-strategy` (End-to-end) describe as the only page-error exception; `service-role.ts:93` creates lesson fixtures in course 1, and the seed `student` is enrolled in course 2 (`/learn/javascript-can-ban/...`, `[T1]`) — justifies AC7.
- Baseline counts: `npm test` 263, `npm run test:e2e` 60 (DM-U3, PR 48) — justifies AC7.

## 3. Bounded implementation hypotheses

- `scripts/monaco/copy-vs.mjs` exporting a copy function that takes the source and destination (unit-tested on temporary folders: fresh copy, stale file removed, missing source throws with the path) and run by `"monaco:copy"` and `"postinstall": "npm run monaco:copy"` — may change name or place if G1, G2 and AC2 hold.
- `createLessonFixture` gains optional overrides (course, chapter, content) with its current defaults kept for existing callers — may change if the existing admin rows stay unchanged.
- `lib/try-it.ts` with a pure `tryItLanguage(className)` and the reading of `code` and `lang` from the search params, unit-tested in `__tests__/unit/try-it.test.ts`; `PreBlock` reads the class of its `code` child (or the DOM) and builds `/try_it?lang=<lang>&code=<encoded>` — may change if AC3 and AC4 hold.
- Try It keeps the initial example in state and `switchLanguage` restores it for the matching tab; the tab buttons get `aria-pressed` so the e2e rows assert the active tab — may change if AC5 holds.
- E2E rows in `__tests__/e2e/student.spec.ts` with a scoped lesson fixture in course 2, chapter 2, holding an HTML block with `50%`, a JavaScript block with `a%20b`, a C++ block with `printf("%d", x);`, a CSS block and a block with no language; each row follows the popup from "Thử ngay" and reads the editor value through the page's `monaco` model. The worker and crafted-link rows sit in `public.spec.ts` (anonymous, `/try_it` is public) — may change if the section 4 allocation holds.
- Commits: CP1 `feat(try-it): self-host Monaco from the npm package`, CP2 `fix(try-it): open lesson examples with their exact code and language`, CP3 `docs(dependency-maintenance): ...` — may change if each commit holds one checkpoint.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Monaco self-hosted (AC1, AC2); `[S5]` loads the editor, the worker row passes, the exception is removed (part of AC7). | Lockfile diff against G3; `git status` shows no `public/monaco` file; `rm -rf public/monaco node_modules && npm ci` recreates the copy and `diff -r node_modules/monaco-editor/min/vs public/monaco/vs` is empty; `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test:unit`; `npx supabase db reset`, `npm run test:e2e`. |
| CP2 | Try It and `PreBlock` fixes with unit and e2e rows (AC3 to AC6, rest of AC7). | `npm run test:unit`; `npm run test:e2e` twice; `npm test`; `npx tsc --noEmit`, `npm run lint`, `npm run build`. |
| CP3 | Records (AC9) and the full run. | `npm audit --omit=dev`; `npm run docs:check`; the CP2 commands rerun if CP3 touched code. Then Main: manual pass and, after the PR, AC8. |

Verification allocation:

| Guarantee | Layer | Assertion | File / row | Prerequisites |
| --- | --- | --- | --- | --- |
| AC2 copy | unit | a fresh copy equals the source tree; a stale file is gone after a second copy; a missing source throws naming the path | new `__tests__/unit/monaco-copy.test.ts` | temporary folders only |
| AC2 install hook | command | a clean `npm ci` recreates `public/monaco/vs` equal to the source | CP1 | none |
| AC1 self-hosted editor and workers | e2e | on `/try_it` every Monaco request goes to `/monaco/vs/` on the app's origin with status 200 and none leaves the origin; the editor model exists; invalid JavaScript typed in the JavaScript tab gets at least one marker from `monaco.editor.getModelMarkers` | `[S5]` changed, one new row in `public.spec.ts` | none (public page) |
| AC3, AC4 helpers | unit | `50%`, `a%20b` and `printf("%d", x);` round-trip exactly through the link builder and the reader; `html`, `js`, `javascript`, `cpp`, `c++`, no class, `css`, missing and unknown `lang` map as AC4 says | new `__tests__/unit/try-it.test.ts` | none |
| AC3 to AC5 lesson path | e2e | as `student`, each "Thử ngay" popup has the matching tab `aria-pressed` and an editor value equal to the fixture code; the CSS block has no "Thử ngay"; the block with no language opens HTML; switching away and back restores the example | new rows in `student.spec.ts` | scoped course-2 lesson fixture through the extended `createLessonFixture`, cleaned by the `owned` scope |
| AC6 crafted link | e2e | `/try_it?lang=html&code=` with an `<h1>ok</h1>` and a `<script>` that posts a message to the parent loads the exact text; before "Chạy Code" the iframe has no `srcdoc` content and no message arrives; the iframe `sandbox` is exactly `allow-scripts allow-modals`; after the click the frame shows `ok`; a JavaScript link shows its `console.log` line in the frame | new row in `public.spec.ts` | none |

Residual manual pass (Main, local dev server, no sign-in because `/try_it` is public): open `/try_it` links for HTML, JavaScript and C++ examples (built with the helper), run each and look at the output. Reason: the rendered output is perceptual and the C++ run calls the live Piston API, which the e2e guard blocks. No lesson data is needed; the lesson path is covered by the e2e rows.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Vercel's install skips `postinstall` or its build cache keeps an old `public/monaco`. | CI's `npm ci` and Vercel's configured argument-free `npm install` run the copy hook, which replaces the generated tree even when dependencies come from a restored cache; `public/monaco` is not in git, so a checkout never carries a copy; AC8 checks the preview before merge. |
| The deploy grows by 25 MB of static files. | Only `/try_it` requests them, about 1.2 MB per first load (section 2 trial). |
| Public files have no content hash, so a browser could keep an old Monaco after an update if they are cached long. | Not checked before the PR: AC8 records the preview's `Cache-Control`; a long cache without revalidation stops the merge and returns to Main. |
| Reading the editor value in e2e depends on Monaco's global `monaco` object. | Only the assertions use it; the rows fail loudly if it disappears. |
| A later `npm install monaco-editor@x` leaves an old copy in `public/monaco` (no `postinstall`). | The Monaco row requires `npm run monaco:copy` locally; CI and Vercel run argument-free installs, whose hook regenerates the copy, so a stale local copy cannot reach a deploy. |

- Rollout runbook: none beyond the merge; Vercel builds the merge commit.
- Stop when: a guardrail triggers; a check fails twice after an in-scope fix; the preview does not serve `/monaco/vs/loader.js`.
- Rollback: revert the PR; nothing hosted changes.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
