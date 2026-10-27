---
name: dependency-updates
description: "How DevSpace adds, removes and updates dependencies: one procedure per update type (patch, minor, major, security fix), the checks each needs, the dependency check run at program boundaries, and a table of rows for special cases (Node, the Supabase CLI, Playwright, Next with eslint-config-next, the Supabase auth helper, Monaco from the CDN). Use when adding, removing or updating a package in package.json or package-lock.json, acting on npm outdated or npm audit, changing the Node version, or updating the Supabase CLI, Playwright or the Monaco version loaded from the CDN."
---

# Dependency updates

## Use when / do not use when

Use when a task adds, removes or updates a package in `package.json` or `package-lock.json`, acts on `npm outdated` or `npm audit`, changes the Node version, updates the Supabase CLI, Playwright or the Monaco version loaded from the CDN, or runs the dependency check below.

Do not use it for a change that touches no dependency, for reviewing a dependency diff (`code-review`, [special-cases.md](../code-review/references/special-cases.md), Dependency), or for the Supabase migration workflow (`supabase-migration`).

Whether an install, update or removal is allowed at all is owned by `.claude/rules.md` section 4 ([rules](../../rules.md)): it needs the Owner's request or an approved plan. This skill says how, not whether. It holds no list of current versions, outdated packages or open findings; those are state, recorded in the backlog and the program docs (`program-docs`).

## Workflow

1. Classify the change: add, remove, or update as patch, minor, major or security fix. Read the matching row of the table below for every package the change touches.
2. Follow the procedure for that type.
3. Run the Dependency row of [test-quality-strategy](../test-quality-strategy/SKILL.md#which-command-for-which-change) after the last edit, and report the commands and counts as that skill says. A failed check is not waved through as "unrelated to the update".
4. Stage `package.json` and `package-lock.json` together; commits follow `git-pr-workflow`.

### Patch

Update, then run the checks of step 3. A patch of an exact pin (see the table) is a deliberate edit of the pin, not a drift.

### Minor

Read the changelog and release notes between the two versions first, looking for deprecations and behavior changes, then update and run the checks. Stop and treat it as a major when the notes show a breaking change.

### Major

A major is its own task. Size it by [docs/agent-loops.md](../../../docs/agent-loops.md) (Sizing), and never fold it into another change. The plan names the breaking changes read from the migration guide and the checks that cover them; a package whose major waits on the backend migration stays untouched until then.

### Security fix

- Order by impact: a finding on a production runtime path first (`npm audit --omit=dev`), dev-only findings after.
- Prefer the smallest in-range fix. `npm audit fix` is read as a lockfile diff before it is kept; `npm audit fix --force` is never used, because it installs a major or a downgrade without a plan.
- A finding with no in-range fix is not forced: it becomes a backlog entry that names the advisory, the affected path and the fixed version, and the fix runs as a major or minor task above.
- A fix is not postponed to the next regular update when it affects a production runtime path.

### Add a package

Check necessity, existing alternatives, maintenance, security status, license and runtime versus dev placement (`code-review`, Dependency). Install an exact or ranged version as the neighbouring entries do. A package with a special case adds its own row to the table in the same PR.

### Remove a package

Search the repo for every import and config reference, remove it with the package manager so the lockfile follows, and run the checks. Remove its row from the table.

## Dependency check

A manual review at fixed points: Main runs it when a delivery program opens or closes and whenever the Owner asks (`program-docs`, Lifecycle, index and ADRs). No bot and no scheduled job runs it.

1. Run `npm outdated`, `npm audit` and `npm audit --omit=dev`.
2. Review every row of the table below, the exact pins included (Supabase CLI, `@playwright/test`, the Monaco CDN version, the Node major), against the latest release and advisories.
3. Change no file except records. A patch update becomes one small task. Each minor, major or security update not yet tracked becomes or updates an entry in `docs/backlog/` (one entry per package), in the shape `program-docs` gives.
4. Install nothing: an update starts only on the Owner's request (`.claude/rules.md` section 4).

## Dependency rows

A package already in `package.json` with no special case has no row and follows the procedures above. A row lists only where the version is set and what an update must prove.

| Dependency | Where it is set | Rule |
| --- | --- | --- |
| Node | Vercel project setting (production), `node-version` in every job of `.github/workflows/ci.yml`, the `@types/node` major in `package.json` | Production, CI and `@types/node` use one Node major. A change of any of them moves all three in one task. The move to Node 26 is backlog FEAT-019, not a step here. |
| Supabase CLI (`supabase`) | exact pin in `package.json` | Never a range. An update is accepted only when `npx supabase db reset`, the local catalog compared with the hosted catalog (Main-only, `.claude/rules.md` section 4) and the full suite stay green. |
| `@playwright/test` | exact pin in `package.json`; CI installs the browser with `npx playwright install --only-shell chromium` in the `e2e` job | Never a range. An update runs `npm run test:e2e` locally, and the CI `e2e` job must pass with the browser install step unchanged. |
| `next` with `eslint-config-next` | both in `package.json` | They move together to the same version. Run `npm run build` and `npm run lint` besides the Dependency row; the server action tests read Next internals, so a Next update can fail them first (`test-quality-strategy`, Server action rows). |
| `@supabase/ssr` | `package.json` | The Supabase auth helpers are replaced by the backend migration: do not modernize them ([ADR 0001](../../../docs/adr/0001-modernization-roadmap.md)). A security fix is the only reason to update. |
| Monaco | the npm package through `@monaco-editor/react`, and the CDN copy: the default `paths.vs` URL of `@monaco-editor/loader` (`node_modules/@monaco-editor/loader/lib/es/config/index.js`), since the app sets no `loader.config` | `npm audit` cannot see the CDN version. The CDN version stays pinned to an exact version, never a range or `latest`. A change of it, or any `@monaco-editor/*` update that changes it, is reviewed against the Monaco advisories like a dependency update. |

## Stop when

- a major would ride inside another change, or the procedure needs `npm audit fix --force`;
- a row needs a rule that changes CI, Vercel settings or permissions: report it to Main instead of writing it here;
- the checks of the Dependency row fail and the cause is not the update itself.

## Checklist

- [ ] the change is classified and its procedure followed; each touched package's row was read
- [ ] the Dependency row of `test-quality-strategy` ran after the last edit, with counts reported
- [ ] `package.json` and `package-lock.json` changed together, and nothing unrelated
- [ ] a new special-case package added its row, a removed one lost its row
- [ ] a dependency check changed only records and installed nothing
