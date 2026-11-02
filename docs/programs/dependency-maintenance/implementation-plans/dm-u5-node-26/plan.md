# DM-U5 detail plan — Node 26

Revision: r6, 2026-11-02. Owner approval: r5 on 2026-11-02, after the Codex plan gate PASS; r6 on 2026-11-02, after the Codex plan gate PASS in round 8. Master plan or charter: [charter](../../README.md) (Initiatives row DM-U5).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: production (Vercel), every CI job and `@types/node` use Node 26, the LTS line since 2026-10-28, so the `dependency-updates` Node row holds one major again (DM-F1). A `.node-version` file holds the major for CI and for fnm on the Owner's machine (D3). Local checks of this initiative run on Node 26.13.0 through fnm. No product behavior changes.

| ID | Observable result |
| --- | --- |
| AC1 | `package.json` lists `@types/node` in the 26 major (`^26.6.6` at the baseline) and no other entry changes; in `package-lock.json` the only version changes are `@types/node` and its dependency `undici-types`, besides the `peer` flags npm 11.20 rewrites (section 2). |
| AC2 | `.node-version` at the repository root contains `26` and nothing else. Every `setup-node` step in `.github/workflows/ci.yml` (seven jobs) reads it with `node-version-file: .node-version` and none sets `node-version`; no other line of the file changes. |
| AC3 | Under Node 26.13.0, `npx tsc --noEmit`, `npm run lint` (0 problems), `npm run build`, `npm run test:unit` and `npm run docs:check` pass after the last edit. |
| AC4 | Under Node 26.13.0, `npm test` passes with at least 407 tests and `npm run test:e2e` passes twice with at least 76 tests, both runs ending `clean`. |
| AC5 | On the PR, every CI job runs and passes, and the `setup-node` step of each job reports a Node 26 version. |
| AC6 | After the Owner sets the Vercel Node.js Version to `26.x` (section 5), the PR's preview deployment builds on Node 26 (its build log) and serves `/monaco/vs/loader.js` with status 200; after the merge, the production deployment of the merge commit builds on Node 26, reaches `Ready` and serves `/monaco/vs/loader.js` with status 200 to a request without cookies. Until then the rollout is incomplete. |
| AC7 | Records: the `dependency-updates` Node row names `.node-version` in place of the CI `node-version` lines, no longer calls the move a future step, and states the install-script behavior of Node 26's npm (section 2); DM-F1 is `Fixed locally, awaiting delivery`, and DM-F2 no longer points `@types/node` to DM-F1; the DM-U5 row and State in this program. |
| AC8 | `AGENTS.md`, Commands, has one bullet that every agent reads: DevSpace runs the Node major in `.node-version`; on the Owner's machine fnm selects it (Node installs in `%USERPROFILE%\.fnm`, set as `FNM_DIR` in the PowerShell profile and `~/.bashrc`), and an interactive shell switches on `cd`. An agent, in Git Bash or PowerShell, runs each DevSpace Node command from the repository root as `fnm exec -- <command>`, which takes the version from `.node-version`; `npm` and `npx` are written `npm.cmd` and `npx.cmd` there, because fnm starts the program without a shell and Windows ships them as `.cmd` shims (`fnm exec -- npm.cmd test`). It shows `fnm exec -- node -v` in its report; when `fnm` is not found or `FNM_DIR` is unset it loads the shell profile first, and when `fnm exec` fails it stops and reports instead of running the command on the system Node 24. It lands as its own `chore(agent-rules): ...` commit (`AGENTS.md` section 7) after `.node-version` exists. |

### 1.2 Scope and non-goals

- In scope: `@types/node` 22 to 26 with its lockfile change; the new `.node-version` (`26`) and `node-version-file` in all seven CI jobs instead of `node-version: 24`; the AC8 bullet in `AGENTS.md` (D4); the Vercel production setting 22.x to 26.x, changed by the Owner (D1); the AC7 records.
- Non-goals:
  - an `engines` field or `.nvmrc` (D3);
  - the fnm install and shell profiles on the Owner's machine: Main set them up before this revision (D2), outside the repository;
  - approving or denying a dependency install script (`allowScripts`, `npm install-scripts approve|deny`): the three skipped at the baseline are a no-op, a version-scheme warning and a binding check (section 2);
  - any other package, `npm update`, `npm audit fix`, the `actions/setup-node` version, the Vercel Install or Build Command;
  - the Owner's other repository, which keeps fnm's default Node 24.11.1 (D2);
  - a live call to Gemini or the Piston API: the e2e guard refuses non-local hosts and the Gemini key is not renewed (BL-F9).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Every local command of this initiative runs on Node 26.13.0 through fnm from the repository root: `fnm exec --using=26.13.0 -- <command>` until `.node-version` exists, then `fnm exec -- <command>` (AC8), with `npm.cmd` and `npx.cmd` for `npm` and `npx`, because a non-interactive shell does not switch on `cd`; if `fnm` is not found or `FNM_DIR` is unset, load the shell profile first (`source ~/.bashrc` in Git Bash). The report shows `fnm exec -- node -v` and `fnm exec -- npm.cmd -v`. | Results from the system Node 24 are reported as Node 26 evidence. |
| G2. Install only with `npm install --save-dev @types/node@^26.6.6`; never `npm update`, `npm audit fix`, `--force`, `npm install-scripts approve` or `deny`. Confirm with `git diff package.json` and a version comparison of the lockfile. | Unlisted packages move, or an install-script approval lands in `package.json`. |
| G3. A failing check, or a needed edit of any file outside `package.json`, `package-lock.json`, `.node-version`, `.github/workflows/ci.yml`, the AC8 bullet in `AGENTS.md` and the AC7 records, stops the implementor; it reports to Main and edits nothing else. The trial needed no edit, so a type-only edit is new evidence too. | A runtime incompatibility is patched inside a version bump without review. |
| G4. No agent changes the Vercel project, deploys, redeploys, promotes or rolls back; the Owner changes the setting at runbook step 1. Main only reads deployment state (`vercel inspect`, the GitHub check). | A deployment outside the workflow (`AGENTS.md` section 4). |
| G5. Local stacks only; nothing reaches hosted. | An update test writes to production. |

### 1.4 Owner decisions that bind this initiative

- Charter decision 1: this program owns the work. It changes CI and deploy, so it gets the Codex gate on its plan and on its diff (`AGENTS.md` sections 2 and 3).
- D1 (2026-11-02) The Owner chose to plan DM-F1 now, on the new branch `chore/node-26`. The Owner changes the Vercel setting, guided by Main when the runbook reaches it.
- D2 (2026-11-02, revised the same day) Node versions on the Owner's machine are managed by fnm from now on, set up by Main before r3: fnm 1.39.0 (`winget install Schniz.fnm`), Node 26.13.0 and 24.11.1 installed through it into `FNM_DIR=%USERPROFILE%\.fnm`, default 24.11.1 for the Owner's other repository, and `FNM_DIR` plus `fnm env --use-on-cd` in the PowerShell profile and in `~/.bashrc` (with `~/.bash_profile` sourcing it). The portable Node 26 used for the trial is removed. The system Node 24 in `C:\Program Files\nodejs` stays for tools that do not load a shell profile.
- D3 (2026-11-02, revised the same day) A `.node-version` file (`26`) is added so fnm switches DevSpace to Node 26 on `cd` in an interactive shell. CI reads the same file through `node-version-file`, so the repository sets the major in one file and the Node row names three places: the Vercel setting, `.node-version` and `@types/node`. No `engines` field (it would override the Vercel setting) and no `.nvmrc`.
- D4 (2026-11-02) The fnm rule for agents is shared: it goes to `AGENTS.md` (Commands) for every agent, not only to this plan's G1, and lands with `.node-version` in this initiative.

## 2. Repository facts

Baseline: `d21f4fb`, checked 2026-11-02 (`nodejs.org/dist/index.json`, `npm view`, `vercel project inspect`, trial install).

- Node 26.13.0 (2026-10-28) is the first release of the 26 line marked LTS ("Lithium"); `@types/node` latest is 26.6.6 — justifies the target.
- Where the major is set today: Vercel project `devspace` Node.js Version `22.x` (`vercel project inspect devspace`); `node-version: 24` in the seven jobs of `ci.yml` (`changes`, `typecheck`, `build`, `docs`, `db`, `e2e`, `lint`, lines 39, 57, 76, 88, 111, 132, 157); `@types/node` `^22.20.5` (`package.json:54`); no `engines`, `.nvmrc` or `.node-version` in the repo — justifies AC1, AC2, AC6 and D3.
- `actions/setup-node` reads a version from a file with `node-version-file` (`.node-version` among the supported formats), and fnm reads `.node-version` for `fnm use` and `--use-on-cd`. Vercel reads neither (its version comes from the project setting or `engines.node`) — justifies AC2, D3 and runbook step 1.
- fnm on the Owner's machine (checked 2026-11-02): after `source ~/.bashrc`, `fnm use` in a folder holding a `.node-version` of `26` switched Git Bash to v26.13.0 with npm 11.20.0; `cd` alone did not switch in a non-interactive shell. The Claude desktop app is an MSIX package, so files its agents write under `AppData` land in `AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache`: Node first installed into fnm's default `AppData\Roaming\fnm` was invisible to the Owner's own PowerShell ("Can't find an installed Node version matching v26.13.0"), and junctions into it failed for native programs ("The system cannot find the path specified"). With `FNM_DIR` in `%USERPROFILE%\.fnm`, `fnm use` and `fnm exec -- node -v` print v26.13.0 in both the agent's PowerShell and Git Bash; `fnm exec` exits 1 in a folder with no version file and for a version that is not installed, so it never falls back to the system Node. `fnm exec -- npm -v` fails with "Can't spawn program: program not found" in both shells, while `fnm exec -- npm.cmd -v` and `npx.cmd --version` print 11.20.0 and `npm.cmd exec -c "node -v"` prints v26.13.0, so npm's child processes stay on Node 26 — justifies D2, G1 and AC8.
- Vercel's Node.js versions page lists `26.x` as the default, and an `engines.node` range in `package.json` overrides the project setting — justifies D3 and runbook step 1.
- Engines of the 437 lockfile packages that declare one all accept 26.13.0, except the optional win32-ia32 binary of `sharp`, which is not installed on x64 — justifies the absence of other package changes.
- Node 26 semver-major changes checked against the repo: end of life for `http` `writeHeader` and `_stream_*` modules, runtime deprecation of `module.register()`, removal of `--experimental-transform-types`, undici 8, Temporal enabled. The repo calls none of these APIs; its preloads use `--import` (`scripts/test-stack/run.mjs:20`) and `--require` (`scripts/e2e/serve.mjs:35`), and `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON` (`npm run dev`, `npm test`) still runs — justifies "no product behavior change" and G3.
- Node 26.13.0 bundles npm 11.20.0 (the system npm is 11.6.2). It skips the install scripts of dependencies that `allowScripts` does not cover and warns: at the baseline `@google/genai` (`preinstall: echo 'preinstall: no-op'`), `protobufjs` (`postinstall`, a version-scheme warning) and `unrs-resolver` (`postinstall`, a binding check). The root `postinstall` (`npm run monaco:copy`) still runs, and `npx supabase --version` reports 2.121.0 without an install script — justifies the install-script non-goal and the AC7 row text.
- Trial install (`git worktree add --detach` at `d21f4fb` outside the checkout, Node 26.13.0 from the official portable zip, SHA-256 checked, since removed; `npm ci`; `npm install --save-dev @types/node@^26`; removed afterwards): `package.json` changed only `@types/node` to `^26.6.6`; the lockfile changed versions of `@types/node` (22.20.5 to 26.6.6) and `undici-types` (6.21.0 to 8.9.0) only, plus `peer` flags rewritten by npm 11.20. `npx tsc --noEmit`, `npm run lint`, `npm run build` (CI placeholder env) and `npm run test:unit` (316 passed) passed with no edit; `public/monaco/vs` was created — justifies AC1, AC3 and G3.
- Baseline counts: `npm test` 407 and `npm run test:e2e` 76 (app-foundation AF-U2, PR 51) — justifies AC4.

## 3. Bounded implementation hypotheses

- Commits: `chore(deps): move CI and @types/node to Node 26 with .node-version` and `chore(agent-rules): select the Node version with fnm` for CP1, `docs(dependency-maintenance): ...` for the CP2 records — may change if the package change stays in one commit with its lockfile.
- The `dependency-updates` Node row names the Vercel setting, `.node-version` (read by every CI job and by fnm) and `@types/node`, keeps its one-major rule, and replaces the DM-F1 sentence with the install-script note — may change if the row still states the three places, one major and the install-script behavior.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | `@types/node` 26 installed, `.node-version` added and CI reading it (AC1, AC2, AC3 without docs), then the AC8 bullet in a separate `chore(agent-rules)` commit. | Under G1: `node -v`, `npm -v`; `cat .node-version`; `git diff package.json .github/workflows/ci.yml`; after the AC8 edit and before its commit, `npm run docs:check`; from a fresh `bash -lc` and a fresh `powershell -NoLogo -Command` (profile loaded) in the repository root, `fnm exec -- node -v` prints v26.13.0; lockfile version comparison against `d21f4fb`; `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test:unit`. |
| CP2 | Full local verification and records (AC4, AC7). | Under G1: `npm test`, `npm run test:e2e` twice with counts and `clean` state; `npm run docs:check`; the AC7 records, the skill row edited under `skill-authoring` (Maintaining). |

After CP2 Main runs the Codex diff gate, then the runbook below under its grants.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Node 26 breaks the Windows test tooling (writer preload, process start times, lock) or the e2e server guard. | AC4 runs `npm test` once and `npm run test:e2e` twice on Node 26 locally; CI runs both on Linux. G3 stops the work on a failure. |
| Vercel installs with Node 26's npm, which skips dependency install scripts, so a build step that relied on one breaks. | The trial shows the three skipped scripts do no install work and the root `postinstall` still runs; AC6 checks the preview build and the Monaco copy it serves. |
| undici 8 changes server-side `fetch` toward Supabase or Gemini (Piston is called from the browser, `app/(main)/try_it/page.tsx`). | Supabase calls run in `npm test` and `npm run test:e2e` against the local stack. Gemini is not verified (non-goal); a failure there shows as the action's existing error message and is fixed by a revert. |
| Between runbook steps 1 and 3, another deployment of `main` builds on Node 26 with `@types/node` 22. | Runtime code is identical (trial build passed); no other PR merges until step 3. |

- Rollout runbook (in order, each step under its own grant):
  1. After the Codex diff gate PASS and the Owner's push and PR grants: the Owner opens the Vercel project `devspace`, Settings, Build and Deployment, sets Node.js Version from `22.x` to `26.x` and saves. It applies to the next deployments only; production keeps running on 22.x.
  2. Main pushes `chore/node-26` and opens the PR. Main reads the preview build log for the Node version and checks `/monaco/vs/loader.js` on the preview (AC6), and watches CI (AC5).
  3. On the Owner's merge grant, Main merges; Main confirms the production deployment of the merge commit built on Node 26, reached `Ready` and serves `/monaco/vs/loader.js` with status 200 (AC6). A failure follows the rollback below.
- Stop when: G3 triggers; a check fails twice after an in-scope fix; the preview build fails on Node 26 (the Owner sets the setting back to `22.x` before anything merges).
- Rollback: the Owner sets the Vercel setting back to `22.x`, then Main reverts the PR under a grant, so the revert deployment builds on 22.x and CI returns to Node 24. Nothing hosted besides the setting changes. fnm on the Owner's machine stays.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
