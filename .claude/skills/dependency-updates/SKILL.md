---
name: dependency-updates
description: "How DevSpace adds, removes and updates dependencies: one procedure per update type (patch, minor, major, security fix), the checks each needs, the trial install a plan is written from, the type-only edit rule for type fallout, the dependency check run at program boundaries, and a table of rows for special cases (Node, the Supabase CLI, Playwright, Next with eslint-config-next, the Supabase auth helper, Monaco copied from the npm package). Use when adding, removing or updating a package in package.json or package-lock.json, acting on npm outdated or npm audit, changing the Node version, or updating the Supabase CLI, Playwright or the Monaco version the app serves."
---

# Dependency updates

## Use when / do not use when

Use when a task adds, removes or updates a package in `package.json` or `package-lock.json`, acts on `npm outdated` or `npm audit`, changes the Node version, updates the Supabase CLI, Playwright or the Monaco version the app serves, or runs the dependency check below.

Do not use it for a change that touches no dependency, for reviewing a dependency diff (`code-review`, [special-cases.md](../code-review/references/special-cases.md), Dependency), or for the Supabase migration workflow (`supabase-migration`).

Whether an install, update or removal is allowed at all is owned by `AGENTS.md` section 4 ([rules](../../../AGENTS.md)): it needs the Owner's request or an approved plan. This skill says how, not whether. It holds no list of current versions, outdated packages or open findings; those are state, recorded in the `dependency-maintenance` program docs (`program-docs`).

## Workflow

1. Classify the change: add, remove, or update as patch, minor, major or security fix. Read the matching row of the table below for every package the change touches.
2. When the change gets a plan (a major, or an initiative of `dependency-maintenance`), run the trial install below during discovery, before the plan goes to the Owner.
3. Follow the procedure for that type. Type fallout of an updated package follows Type-only edits below.
4. Run the Dependency row of [test-quality-strategy](../test-quality-strategy/SKILL.md#which-command-for-which-change) after the last edit, and report the commands and counts as that skill says. A failed check is not waved through as "unrelated to the update".
5. Stage `package.json` and `package-lock.json` together; commits follow `git-pr-workflow`.

### Trial install

Changelogs do not show what newer type definitions break in this repo; found only during implementation, that fallout stops the work for a plan revision. A plan for an update is therefore written from a trial install:

1. Make a throwaway copy of the checkout at the plan's baseline commit, outside the checkout so the checkout's lint and type check never see it: `git worktree add --detach <dir> <baseline>`, then `npm ci` in it. Its `node_modules` is its own install, never a link to the checkout's (`git-pr-workflow`, The rule).
2. Install the plan's target versions there, as the implementation will.
3. Run `npx tsc --noEmit`, `npm run lint` and `npm run build` there. The copy has no env file and none is copied into it: give `npm run build` the placeholder `env` of the CI `build` job (`.github/workflows/ci.yml`).
4. Record each failure in the plan's repository facts with the package, file, error and baseline commit, and classify it: a type-only edit (below), or a change the plan must specify or a package it must leave out.
5. Remove the copy with `rm -rf <dir>` in Git Bash, then `git worktree prune`, and check `git worktree list`. On Windows `git worktree remove` stops with "Filename too long" inside `node_modules` and leaves the folder behind.

The trial changes no file of the checkout and nothing of it is committed. It is an install, so it runs only once the Owner has asked for the update (see the opening of this skill). Fallout the trial did not show still follows Type-only edits or stops the work.

### Type-only edits

When an updated package's own types make `npx tsc --noEmit` or `npm run build` fail, the failing lines that use that package, in app or test code, may be edited to compile again under all of these limits:

- only type syntax changes (an annotation, a type argument, a type-only import), so the emitted JavaScript stays the same;
- no `any`, `as` cast, non-null assertion or `@ts-` directive;
- no change to runtime code, test names, rows, values, assertions or test count, and no other line.

The edit goes in the commit of that package's update, and the report lists each edit with the error it fixes, so the diff review checks it. A fix that needs more is a code change: the update of that package stops, and the change is planned as Minor and Major say. A plan does not restate this rule; it lists the edits its trial install found.

### Patch

Update, then run the checks of step 4. A patch of an exact pin (see the table) is a deliberate edit of the pin, not a drift.

### Minor

Read the changelog and release notes between the two versions first, looking for deprecations and behavior changes, then update and run the checks. Stop and treat it as a major when the notes show a breaking change.

### Major

A major is its own task. Size it by [docs/agent-loops.md](../../../docs/agent-loops.md) (Sizing), and never fold it into another change. The plan names the breaking changes read from the migration guide and the checks that cover them; a package whose major waits on the backend migration stays untouched until then.

### Security fix

- Order by impact: a finding on a production runtime path first (`npm audit --omit=dev`), dev-only findings after.
- Prefer the smallest in-range fix. `npm audit fix` is read as a lockfile diff before it is kept; `npm audit fix --force` is never used, because it installs a major or a downgrade without a plan.
- A finding with no in-range fix is not forced: it becomes an entry in `dependency-maintenance` `problems.md` that names the advisory, the affected path and the fixed version, and the fix runs as a major or minor task above.
- A fix is not postponed to the next regular update when it affects a production runtime path.

### Add a package

Check necessity, existing alternatives, maintenance, security status, license and runtime versus dev placement (`code-review`, Dependency). Install an exact or ranged version as the neighbouring entries do. Every added package adds its own row to the table in the same PR: where its version is set and its rule, or "no rule beyond the procedures above" when it has no special case.

### Remove a package

Search the repo for every import and config reference, remove it with the package manager so the lockfile follows, and run the checks. Remove its row from the table.

## Dependency check

A manual review at fixed points: Main runs it when a delivery program opens or closes and whenever the Owner asks (`program-docs`, Lifecycle, index and ADRs). No bot and no scheduled job runs it.

1. Run `npm outdated`, `npm audit` and `npm audit --omit=dev`.
2. Review every row of the table below, the exact pins included (Supabase CLI, `@playwright/test`, the `monaco-editor` version, the Node major), against the latest release and advisories.
3. Change no file except records. A patch update becomes one small task. Each minor, major or security update not yet tracked becomes or updates an entry of the `dependency-maintenance` program (one entry per package; `problems.md` for a security finding, `future-features.md` otherwise), in the shape `program-docs` gives, or is named in the section 2 facts of an initiative plan of that program that will update it.
4. Install nothing: an update starts only on the Owner's request (`AGENTS.md` section 4).

## Dependency rows

A package that was already in `package.json` before this skill and has no special case has no row and follows the procedures above; a package added later always has one. A row lists only where the version is set and what an update must prove.

| Dependency | Where it is set | Rule |
| --- | --- | --- |
| Node | Vercel project setting (production), `.node-version` (every job of `.github/workflows/ci.yml` reads it through `node-version-file`, and fnm on the Owner's machine), the `@types/node` major in `package.json` | Production, CI and `@types/node` use one Node major. A change of any of them moves all three in one task, and the major changes in `.node-version`, not in `ci.yml`. The npm bundled with Node 26 (11.20) skips the install scripts of dependencies that `allowScripts` does not cover and warns (`@google/genai`, `protobufjs` and `unrs-resolver` at DM-U5); the root `postinstall` (`monaco:copy`) still runs. With the three skipped, the `unrs-resolver` binding was already present through its optional dependency and every DM-U5 check passed, but the `unrs-resolver` script can install a missing binding (`napi-postinstall`), so approve or deny no script without a plan. |
| Supabase CLI (`supabase`) | exact pin in `package.json` | Never a range. An update is accepted only when `npm test -- --reset` (a reset of the test stack under the new CLI), the local catalog compared with the hosted catalog (Main-only, `AGENTS.md` section 4) and the full suite stay green. |
| `@playwright/test` | exact pin in `package.json`; CI installs the browser with `npx playwright install --only-shell chromium` in the `e2e` job | Never a range. An update runs `npm run test:e2e` locally, and the CI `e2e` job must pass with the browser install step unchanged. |
| `next` with `eslint-config-next` | both in `package.json` | They move together to the same version. Run `npm run build` and `npm run lint` besides the Dependency row; the server action tests read Next internals, so a Next update can fail them first (`test-quality-strategy`, Server action rows). |
| `@supabase/ssr` | `package.json` | The Supabase auth helpers are replaced by the backend migration: do not modernize them ([ADR 0001](../../../docs/adr/0001-modernization-roadmap.md)). A security fix is the only reason to update. |
| Monaco (`monaco-editor`) | direct dependency in `package.json` (`^0.57.0`); `scripts/monaco/copy-vs.mjs` copies `node_modules/monaco-editor/min/vs` to `public/monaco/vs` (git-ignored) from `postinstall`, and `loader.config` in `app/(main)/try_it/page.tsx` points `@monaco-editor/react` at `/monaco/vs` | The lockfile version is the version that runs, so `npm audit` sees it. `npm install <pkg>` with a package argument does not run `postinstall` (npm 11): run `npm run monaco:copy` after one, then check `diff -r node_modules/monaco-editor/min/vs public/monaco/vs`. CI (`npm ci`) and Vercel (`npm install`) regenerate the copy. A `monaco-editor` or `@monaco-editor/*` update is reviewed against the Monaco advisories like a dependency update and proved by the `/try_it` e2e rows (editor and language worker served from `/monaco/vs/`). Monaco vendors DOMPurify inside its own code and never imports the `dompurify` package, so a `dompurify` `overrides` entry would change only an unused package and hide the finding: add none. |
| `postcss-selector-parser` | `overrides` in `package.json`, scoped to `@tailwindcss/typography` (6.1.5) | `@tailwindcss/typography` pins 6.0.10 exactly, below the security fix 6.1.5. Remove the entry once `@tailwindcss/typography` no longer pins a version below 6.1.5. A change of it, or of `@tailwindcss/typography` or Tailwind, is proved by comparing the CSS files of two clean builds (`.next` removed first), as the 6.1.5 override did. |
| `radix-ui` | `package.json`; imported by `components/ui/*` | The one package behind the shadcn primitives. Keep `npm run build` and the confirm-dialog E2E checks besides the Dependency row. Allocate portal, Escape, focus return and pending-state checks through [test-quality-strategy](../test-quality-strategy/SKILL.md#select-checks-from-the-contract): reuse/extend U1 A10/T5/AP5 and justify residual visual/exploratory checks; preserve approved acceptance. |
| `class-variance-authority` | `package.json`; imported by `components/ui/button.tsx` | No rule beyond the procedures above. |
| `zod` | `package.json` (`^4.6.7`, a dependency: the schemas in `lib/schemas/` run in server actions); also a transitive dependency of `eslint-plugin-react-hooks`, so the lockfile holds one copy | The schemas are the contract of the server actions: an update runs `npm run test:unit` (`action-schemas.test.ts`, `action-parse.test.ts`) and `npm run test:e2e`, and a minor is read for changed messages, `z.url`, `z.email` and `z.uuid` rules, which the schemas rely on. A Zod major is its own task and moves the client forms with it. |
| `react-hook-form` | `package.json` (`^7.91.0`, a dependency: the learner forms import it) | An update runs `npm run test:unit` (`learner-form-schemas.test.ts`), `npm run test:e2e` (`learner-forms.spec.ts`, rows F1 to F11) and `npm run lint`: a minor is read for changes to `handleSubmit`, `register`, `useWatch` and the type parameters of `useForm`, and the React Compiler lint rule `react-hooks/refs`, which rejects `handleSubmit(fn)` in render when `fn` reads a ref. |
| `@hookform/resolvers` | `package.json` (`^7.0.1`, a dependency); the code imports only `@hookform/resolvers/zod` | Its peer `zod` (`^3.25.0 \|\| ^4.0.0`) must match the installed `zod` and its peer `react-hook-form` the installed one. Its optional peer `ajv@^8` is not installed: adding the package moved `ajv` 6 and `json-schema-traverse` 0.4 under `eslint` and `@eslint/eslintrc` in the lockfile (dev only), which is expected. An update runs the rows of `react-hook-form`; 7.0.0 was a major only for its TypeBox resolver. |
| `prettier` | exact pin in `package.json` (devDependency); `.prettierrc.json`, `.prettierignore` | Never a range: a new release can change the output, and the format step reformats each file a change touches (`git-pr-workflow`, Format the changed files), so the version moves only on purpose. An update reads the changelog for output changes and runs `npm run format:check` on a few touched files; it reformats nothing in bulk. No other check: no build, test or CI job runs Prettier. |

## Stop when

- a major would ride inside another change, or the procedure needs `npm audit fix --force`;
- a row needs a rule that changes CI, Vercel settings or permissions: report it to Main instead of writing it here;
- the checks of the Dependency row fail and the cause is not the update itself.

## Checklist

- [ ] the change is classified and its procedure followed; each touched package's row was read
- [ ] a plan for the change, when it has one, was written from a trial install, and the copy was removed
- [ ] every type fallout edit stays type-only and is listed in the report with its error
- [ ] the Dependency row of `test-quality-strategy` ran after the last edit, with counts reported
- [ ] `package.json` and `package-lock.json` changed together, and nothing unrelated
- [ ] every added package added its row, a removed one lost its row
- [ ] a dependency check changed only records and installed nothing
