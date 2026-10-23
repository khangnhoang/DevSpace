# U4 detail plan — Playwright smoke

Revision: r3, 2026-10-23 (r3 adds D23 and narrows AC5 and S5 for it; r2 fixes the Codex round 1 findings: `/_next/image` sources in the network guard, T2 matches the one-question quiz view, the `frontend-workflow` `SKILL.md` line, PR and issue attachments as separate grants, the required-check verification and the conditional report upload). Owner approval: 2026-10-23 (r2); r3 (2026-10-23) adds the S5 exception D23, approved by the Owner the same day after the Codex diff gate found it. Master plan: [plan.md](../../plan.md) (unit U4, decisions D5, D6, D7 and D9; rollout order step 4).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: Playwright runs smoke tests of the main learner and admin paths in Chromium against a production build of the app served on the Owner's machine and in a new blocking CI job `e2e`, with every data request going to the local Supabase stack. The agent skill `playwright-cli` from `microsoft/playwright-cli` is in the repo with the DevSpace limits, and `CLAUDE.md` and the skills that mention browser tests describe this tooling and nothing that does not exist yet.

| ID | Observable result |
| --- | --- |
| AC1 | On the Owner's machine, after `npx supabase start` and `npx supabase db reset`, `npm run test:e2e` builds the app, starts it on its own port, runs every Appendix A row in Chromium and exits 0. Running it a second time with no reset in between also exits 0, and `npm test` run right after it also exits 0. |
| AC2 | The e2e run takes the API URL and the anon and service-role keys only from `npx supabase status -o json`, through the U3 host check: when the stack is down or the API host is not `127.0.0.1` or `localhost`, the run fails before the build with a message that names the local stack. |
| AC3 | The build and the server started by the e2e run get every environment variable that `app`, `lib` and `proxy.ts` read set to a non-empty local value or placeholder: the three Supabase variables from AC2, `NEXT_PUBLIC_BASE_URL` and `VERCEL_URL` pointing at the e2e server, and placeholders for `GMAIL_USER`, `GMAIL_PASS` and `GEMINI_API_KEY`. A unit test lists every `process.env.<NAME>` read in `app`, `lib` and `proxy.ts` and fails when one is missing from the e2e environment map or is empty there. No test, config or helper reads `.env*`. |
| AC4 | The e2e server is always the one the run started: Playwright never reuses an existing server, and the port is not 3000 (the dev server's port in `.claude/launch.json`). If the port is taken, the run fails. |
| AC5 | Every browser context in the suite aborts each request whose host is not `127.0.0.1` or `localhost`, and each `/_next/image` request whose `url` parameter is an absolute URL on such a host (the Next server would fetch it). Either kind aimed at a `*.supabase.co` host or at `devspace-lms.vercel.app` also fails the test that made it. A unit test of the request classifier, run without network, shows: a local page and a local `/_next/image?url=/x.png` are allowed; `https://placehold.co/...` and `/_next/image?url=https%3A%2F%2Fplacehold.co%2F...` are aborted; the same two forms with a `lkvxxrxojjlkchzzqidu.supabase.co` URL fail. A page error (`pageerror`) or a response with status 500 or higher from the local server fails the test. The one exception (D23): on S5 alone, the unhandled rejection whose reason is the load-error `Event` of the blocked `monaco-editor/min/vs/loader.js` script is not a page error; any other page error on S5 still fails it. |
| AC6 | The learner's enrollment in course 1 (Appendix A, L5) and the admin notifications that `enrollCourse` inserts are removed through the local service role after the test, even when it fails. Before L5, the test asserts with the service role that the learner has no enrollment in course 1. |
| AC7 | The CI job `e2e` runs on every pull request to `main` and every push to `main`: it starts the local stack, installs Chromium, and runs `npm run test:e2e`. A failing row, a setup failure or a hosted request fails the job. When Playwright ran and the job failed, its HTML report is uploaded as a workflow artifact; a failure before Playwright runs uploads nothing. No other job changes. |
| AC8 | `.claude/skills/playwright-cli/` holds `SKILL.md`, the ten `references/*.md` files and `LICENSE` from `microsoft/playwright-cli` at commit `b1a5903c5b633b8c9f843ad7b629c2a78437040c` (`skills/playwright-cli/` and the repo `LICENSE`). Each reference and `LICENSE` has the git blob SHA of its upstream file. `SKILL.md` differs from upstream in exactly two places: the frontmatter `description` (adds "Use when" and "Do not use when"; `name` and `allowed-tools` unchanged), and one DevSpace block right below the H1 (Appendix B). |
| AC9 | A committed `.claude/settings.json` holds only `permissions.ask` rules that match `playwright-cli` and `npx playwright cli` commands containing `attach`, `--cdp` or `--extension`, in Bash and PowerShell form. `.claude/rules.md` section 8 gains one line for a vendored third-party skill (D21). |
| AC10 | `CLAUDE.md` Commands lists `npm run test:e2e` and the `e2e` job. `test-quality-strategy` describes the e2e layer: placement, naming, the network guard, data cleanup and the commands. It keeps server action tests deferred to U5. `frontend-workflow` `SKILL.md` and `references/manual-ui-validation.md`, `code-review` `references/domain-dimensions.md`, `git-pr-workflow` `references/pr-and-ci.md`, `planning` `SKILL.md` step 9 and `references/qa-matrix.md`, and `docs/agent-loops.md` Sizing condition 4 match the new tooling. `grep -rn -i "no automated browser\|no automated frontend\|browser test yet\|not wired to it\|infrastructure U4" CLAUDE.md .claude docs/agent-loops.md` finds nothing outside `.claude/skills/playwright-cli/`. |
| AC11 | No product behavior changes: `git diff fcf4a27 -- app lib proxy.ts next.config.ts supabase` is empty. `npx tsc --noEmit` exits 0, `npm run lint` still reports 82 problems, and the `build`, `db` and `e2e` jobs pass on the PR. |

### 1.2 Scope and non-goals

- In scope (implementor): the `@playwright/test` devDependency and lockfile; `playwright.config.ts`; the `test:e2e` script; `__tests__/e2e` with its setup and helpers; the AC3 unit test; `.gitignore` entries for Playwright output and saved sessions; the `e2e` CI job; the `playwright-cli` skill files; `.claude/settings.json`; the rules line and the doc edits in AC9 and AC10.
- In scope (Main): the CP4 mutation check, and the state records. In the infrastructure `progress.md`: State, the INF-001 merge milestone (PR 16, `fcf4a27`), and `(this commit)` replaced by `1a13906` in the INF-001 milestone. The INF-001 line in `problems.md` gets the same replacement. FEAT-002 and FEAT-004 get their status updates. The Owner folded the INF-001 State lag into this PR (2026-10-23).
- Non-goals: server action tests and the payment and coupon flow (U5); any write path beyond L5; Firefox, WebKit or mobile projects; visual comparison; tests against hosted or a Vercel preview; seed changes; any product code change; fixing a bug the smoke exposes (it goes to Main for `problems.md`); adding `e2e` to the required checks (Owner step after merge).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Every variable in AC3 is set explicitly and non-empty in the environment of both the build and the server process. `@next/env` lets a non-empty process value win over `.env.local` but deletes empty ones and refills them from the file. | The local build bakes the hosted Supabase URL from `.env.local` into the client bundle, or a smoke path reaches real Gmail or Gemini (shared invariant 1). |
| G2. `reuseExistingServer` is false and the e2e port is fixed and not 3000. | A run silently tests the Owner's `next dev`, which points at hosted. |
| G3. The service-role key is used only in setup and cleanup helpers, never in a page or a request under test; the e2e environment map passes it only to the build and server processes, which need it at import. | A test passes because it bypassed RLS, or the key leaks into a report. |
| G4. Each role signs in through the login form once per run, in a setup project, and saves its session to an ignored file under `__tests__/e2e/.auth/`. The specs load those sessions. Only test code fills the seed passwords, on the local server. | The local Auth limit (`sign_in_sign_ups = 30` per 5 minutes) answers 429 on a second run; a password is typed by an agent (`.claude/rules.md` section 4). |
| G5. L5 restores its rows in `afterEach` through the service role (G3) and asserts its precondition first. No other row writes. | The learner stays enrolled in course 1, so the second run and the U3 `E1` and `E4` rows fail. |
| G6. Assertions name seed values (course names, lesson text, question text) and URLs, not CSS classes or layout. | Styling work breaks the smoke without a behavior change. |
| G7. The upstream skill files are downloaded only from `microsoft/playwright-cli` at the pinned commit and compared by blob SHA, and nothing else in them changes (AC8). | A silently edited or newer upstream text lands; updating later needs a manual diff of unknown edits. |
| G8. No file under `app`, `lib` or `supabase` changes, nor `proxy.ts` or `next.config.ts` (AC11). | An infrastructure PR hides a behavior change (shared invariant 4). |

### 1.4 Owner decisions that bind this unit

- D5: U4 follows U3. D6: the seed is invented and grows only when a test needs it (U4 needs no change). D7: no hosted secret in CI. D9: skills, rules and `CLAUDE.md` change in this PR (FEAT-002 `playwright-cli` part, FEAT-004 U4 part).
- D19 (2026-10-23, new, binds this unit only): the smoke reads the main pages per role and checks the access redirects (Appendix A). It adds one write path: the learner enrolls in free course 1 and opens its lesson, and the test cleans that up.
- D20 (2026-10-23, new, binds this unit only): Playwright runs in a new CI job `e2e` with its own local stack, blocking and parallel with `db`. The Owner adds `e2e` to the required checks on `main` after merge.
- D21 (2026-10-23, new, binds this unit only):
  - Skill content: the `playwright-cli` skill is `microsoft/playwright-cli` at `b1a5903` (Apache-2.0), kept verbatim with its `LICENSE`, except the frontmatter `description` and one DevSpace block under the H1.
  - Permissions: `allowed-tools` stays as upstream wrote it, and `.claude/settings.json` adds `ask` rules so `attach`, `--cdp` and `--extension` always prompt.
  - Rules exception: `.claude/rules.md` section 8 gains one line for this case. A vendored third-party skill keeps its upstream body, the DevSpace block wins over that body, and the length target applies to the block.
  - Download: the implementor downloads the files with `gh api` at that commit.
- D23 (2026-10-23, new, binds this unit only): S5 tolerates exactly one page error, the unhandled rejection whose reason is the load-error `Event` of the blocked Monaco CDN loader script (`monaco-editor@.../min/vs/loader.js`), identified by that script source, not by its message. Every other row, and every other page error on S5, stays a failure (AC5).
- D22 (2026-10-23, new, binds this unit only): `@playwright/test` is pinned to an exact version, because the browser build is tied to it. The implementor downloads Chromium for that version once on the Owner's machine (`npx playwright install chromium`, from the Playwright CDN, about 180 MB), and CI does the same in the job.

## 2. Repository facts

Baseline: `fcf4a27`, checked 2026-10-23.

- `package.json` has no Playwright package and no e2e script. `npm view @playwright/test` reports 1.64.1 with engines `node >=20`. CI and the Owner's machine run Node 24. This justifies D22 and AC1.
- The app reads eight variables (`grep process.env` over `app`, `lib`, `proxy.ts`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_BASE_URL`, `VERCEL_URL`, `GMAIL_USER`, `GMAIL_PASS`, `GEMINI_API_KEY`. The repo root has `.env.local`, which points at hosted. `@next/env` `processEnv` keeps a non-empty initial process value over a file value, and `replaceProcessEnv` deletes keys whose value is `""`. This justifies AC3 and G1.
- `.claude/launch.json` runs the dev server on port 3000. This justifies AC4 and G2.
- `proxy.ts` (`lib/supabase.proxy.ts`) redirects an anonymous `/admin` request to `/login`. `app/admin/layout.tsx` redirects a signed-in non-admin to `/`. `requireCourseAccess` (`lib/auth.server.ts`) sends an anonymous `/learn` request to `/login`, and a signed-in user who is not enrolled and not admin to `/course/<slug>`. This justifies the Appendix A redirect rows.
- The login page signs in with `supabase.auth.signInWithPassword` in the browser and then pushes `/` after one second. `supabase/config.toml` sets `sign_in_sign_ups = 30`. This justifies G4.
- `enrollCourse` (`app/action/enroll.ts`) requires a user, refuses a course with a non-zero price, inserts the enrollment with the service role, and inserts one `notifications` row per admin with `actor_id` = the learner and `type` `enrollment`. The course page button reads "Đăng ký học ngay". This justifies L5 and AC6.
- The seed (U2 and U3) has the users `learner`, `student` (enrolled in course 2 with an approved payment) and `admin`; courses `lam-quen-voi-html` (free) and `javascript-can-ban` (paid); lessons 1 to 4 with their content; and exercises 1 and 2 on lesson 3. It has no enrollment for `learner`. This justifies Appendix A.
- `vitest.config.mts` includes only `__tests__/unit` and `__tests__/rls`. `__tests__/helpers/local-stack.ts` holds the U3 host check. `tsconfig.json` includes `**/*.ts`, so `next build` type-checks the Playwright files. This justifies the placement hypothesis and the `tsc` checks.
- `ci.yml` has five jobs. `db` starts the stack with `-x studio,mailpit,edge-runtime,logflare,vector,imgproxy,supavisor,realtime,postgres-meta`. Job ids are the required check names. This justifies AC7 and D20.
- `microsoft/playwright-cli` at `b1a5903` (2026-10-19, Apache-2.0) has `skills/playwright-cli/SKILL.md` (489 lines; frontmatter `name`, `description`, `allowed-tools: Bash(playwright-cli:*) Bash(npx playwright:*) Bash(npx --no-install playwright:*)`) and ten references. Its text covers `npm install -g`, `attach --cdp=chrome` / `--extension=chrome` to a running browser, and `gh pr create --attach`. Its "Installation" section prefers `npx playwright cli` when a local Playwright exists. This justifies AC8, AC9, D21 and Appendix B.
- Claude Code permission rules are evaluated deny, then ask, then allow. A matching `ask` rule prompts even when an allow rule also matches, including in auto mode. The docs say such rules cover the usual command form and are not a security boundary. This justifies AC9 and the Appendix B text rule.
- Stale text U4 must rewrite: `CLAUDE.md:13` (job list), `CLAUDE.md:15` ("no automated browser"), `frontend-workflow` `SKILL.md:14` ("no automated frontend tests yet"), `code-review` `references/domain-dimensions.md:19`, `frontend-workflow` `references/manual-ui-validation.md:3`, `git-pr-workflow` `references/pr-and-ci.md:33`, `planning` `SKILL.md:29` and `references/qa-matrix.md:5`, `test-quality-strategy` `SKILL.md:12`, and `docs/agent-loops.md:21`. This justifies AC10.

## 3. Bounded implementation hypotheses

- `@playwright/test` at exactly `1.64.1`. `playwright.config.ts` defines:
  - `testDir: "__tests__/e2e"`;
  - one `setup` project and one `chromium` project that depends on it;
  - `baseURL` `http://127.0.0.1:3100`;
  - `webServer` with `command: "npx next start -p 3100"`, `reuseExistingServer: false` and the AC3 environment;
  - `workers: 1`, `retries` 0 locally and 1 in CI;
  - the HTML report with `open: "never"`.

  May change if AC1 to AC5 and G2 hold.
- The `test:e2e` script runs a small Node entry point. It reads `npx supabase status -o json`, applies the U3 host check, builds the AC3 environment map, runs `next build` with it, then runs `playwright test` with the same map. The same map module feeds `playwright.config.ts` and the AC3 unit test (`__tests__/unit/e2e-env.test.ts`). It may change if AC2, AC3 and G1 hold.
- A pure classifier in `__tests__/helpers/e2e-network.ts` returns allow, abort or hosted for a request URL, decoding the `url` parameter of `/_next/image`. A shared fixture in `__tests__/e2e/fixtures.ts` extends `test` with a context route that applies it, plus `pageerror` and response listeners (AC5). Every spec imports `test` from it. It may change if AC5 holds.
- Specs: `public.spec.ts` (S rows), `learner.spec.ts` (L rows), `student.spec.ts` (T rows), `admin.spec.ts` (A rows), and `auth.setup.ts`. A service-role helper for L5 cleanup reuses the U3 status reader. It may change if G3 to G6 hold.
- CI job `e2e`:
  - same Node 24 setup as `db` and the same `supabase start -x` list;
  - `npx playwright install --with-deps chromium`, then `npm run test:e2e`;
  - `actions/upload-artifact` on failure for `playwright-report/`, 7-day retention;
  - `timeout-minutes: 25`.

  It may change if AC7 holds.
- `.gitignore` adds `/test-results/`, `/playwright-report/`, `/__tests__/e2e/.auth/` and `/playwright/.cache/`. It may change if no session file or report can be committed.
- `.claude/settings.json` holds an `ask` list:
  - `Bash(playwright-cli *attach*)`, `Bash(playwright-cli *--cdp*)`, `Bash(playwright-cli *--extension*)`;
  - `Bash(npx *playwright cli *attach*)`, `Bash(npx *playwright cli *--cdp*)`, `Bash(npx *playwright cli *--extension*)`;
  - the same six patterns as `PowerShell(...)`.

  It may change if AC9 holds and Claude Code loads the file without a startup warning.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 (Sonnet) | Playwright, config, the `test:e2e` entry point with the host check and environment map, the AC3 unit test, the network fixture, the auth setup, the `.gitignore` entries (AC2 to AC5, G1 to G4). | `npm run test:unit` exits 0 and includes the AC3 test and the AC5 classifier test. With the stack stopped, `npm run test:e2e` fails before the build with the local-stack message. `grep -rn "\.env\|dotenv" playwright.config.ts __tests__/e2e __tests__/helpers scripts` finds nothing. `npx tsc --noEmit` exits 0. `npm run lint` reports 82 problems. |
| CP2 (Sonnet) | Every Appendix A row, L5 with its cleanup (AC1, AC6, G5, G6). | `npx supabase db reset`, then `npm run test:e2e` twice and `npm test` once, all exit 0. Then SQL through `psql` on `127.0.0.1:54322` shows no learner enrollment and no `enrollment` notification by the learner. `git status --short` shows no session or report file. tsc and lint as in CP1. |
| CP3 (Sonnet) | The `e2e` job, the skill files, `.claude/settings.json`, the rules line, and the doc edits (AC7 to AC10, G7). | `git diff --check`. `grep -n "secrets\.\|--linked\|--db-url\|db push" .github/workflows/ci.yml` finds nothing. Each vendored file's `git hash-object` matches the upstream tree at `b1a5903` (references, `LICENSE`). A diff of `SKILL.md` against upstream shows only the two AC8 places. `npx --no-install playwright cli --help` runs from the devDependency. The AC10 grep. `npm run docs:check` and `npm run docs:check:test` pass. |
| CP4 (Main) | Review of CP1 to CP3 and a mutation check. | On the local stack only, Main applies each throwaway change with `psql`, runs `npm run test:e2e`, and expects at least one named failure: delete the student's enrollment in course 2; set the admin's role to `user`; insert a learner enrollment in course 2. Then `npx supabase db reset`. Main confirms in a new session that `.claude/settings.json` loads without a warning. Then the Codex diff gate on CP1 to CP3. |
| CP5 (Main, on the PR) | AC7 and AC11 observed in CI; state records updated. | `gh pr checks <n>` shows `typecheck`, `build`, `docs`, `lint`, `db`, `e2e` and Vercel. The `e2e` log shows every row passing. The lint step shows 82 problems. `npm run docs:check` passes. |

The implementor does CP1 to CP3 as local commits, one per checkpoint after its self-review passes, and edits no state record. The Codex gate runs on this plan and on the CP1 to CP3 diff before push. Commit, push, PR and merge are separate grants.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A new `NEXT_PUBLIC_*` or server variable added later is missing from the e2e map, and the local build quietly takes it from `.env.local`. | The AC3 unit test fails on any unlisted `process.env` read; it runs in `db` and locally without Docker. |
| The local `next build` overwrites `.next` with a build that points at the local stack, so the Owner's next `npm start` serves it. | The `test-quality-strategy` e2e section says so; `npm run build` before `npm start` restores it. `next dev` (Next 16) builds in its own folder and is not affected. |
| Smoke is flaky (the one-second redirect after sign-in, toasts, cold server). | Assertions wait on URL and text with Playwright's auto-waiting, never fixed sleeps; `retries: 1` only in CI; a row that needs a retry to pass is reported in CP5. |
| Aborting non-local requests hides a page that needs a CDN (Monaco on `/try_it`, the `placehold.co` fallback images through `/_next/image`), and the blocked Monaco loader rejects with an `Event` page error. | S5 asserts the page shell only and tolerates only that rejection, matched by its script source (D23); no row asserts an image; the manual browser pass still covers the editor and images. |
| The `e2e` job is slow (stack start, Chromium install, build). | It runs in parallel with `db`; CP5 records its duration; the 25-minute timeout changes only if the job runs past 20 minutes. |
| The upstream skill tells agents to install globally, attach to a real browser or attach files to a PR. | The DevSpace block (Appendix B) wins over the body. The `ask` rules prompt on `attach`, `--cdp` and `--extension`. `.claude/rules.md` section 4 still gates PR updates. |
| A smoke row exposes a real product bug. | Stop rule below; the row is never weakened to pass. |

- Rollout runbook (Owner or hosted steps, in order): after merge, the Owner adds `e2e` to the required checks on `main`; Main then reads `gh api repos/khangnhoang/DevSpace/branches/main/protection` (read-only) to confirm the check name, and confirms `e2e` passed on the push run on `main`. Nothing touches hosted.
- Stop when:
  - a row needs a hosted URL, a secret, a real credential or a product code change to pass;
  - a row's real behavior contradicts Appendix A (a finding goes to Main for `problems.md`);
  - `npx --no-install playwright cli` does not exist in the pinned version (no global install);
  - the upstream commit's files or SHAs differ from section 2;
  - the seed would need a change.
- Rollback: revert the PR, and the Owner removes `e2e` from the required checks if it was added. Nothing hosted changes.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

## Appendix A: smoke matrix

Seed accounts: `learner` (enrolled nowhere), `student` (enrolled in `javascript-can-ban`), `admin`. Every row also passes the AC5 checks.

| # | Actor | Action | Expected |
| --- | --- | --- | --- |
| S1 | anon | open `/` | both seed course names are shown |
| S2 | anon | open `/course/lam-quen-voi-html` | the course name and both lesson titles are shown |
| S3 | anon | open `/admin` | ends on `/login` |
| S4 | anon | open `/learn/javascript-can-ban/bien-va-kieu-du-lieu` | ends on `/login` |
| S5 | anon | open `/try_it` | the page renders with status 200 and no page error other than the blocked Monaco loader rejection (D23) |
| S6 | anon | open `/login` | the email and password fields and the sign-in button are shown |
| L1 | learner | sign in through the form (the setup project) | ends on `/` signed in; the saved session is reused by the L rows |
| L2 | learner | open `/learn/javascript-can-ban/bien-va-kieu-du-lieu` | ends on `/course/javascript-can-ban`; the lesson text is not shown |
| L3 | learner | open `/admin` | ends on `/` |
| L4 | learner | open `/profile` | the learner's full name and email are shown |
| L5 | learner | on `/course/lam-quen-voi-html` press "Đăng ký học ngay", then open `/learn/lam-quen-voi-html/cau-truc-mot-trang-html` | the enrollment succeeds and the lesson text from the seed is shown; cleaned up (AC6) |
| T1 | student | open `/learn/javascript-can-ban/bien-va-kieu-du-lieu` | the lesson text from the seed is shown |
| T2 | student | open `/learn/javascript-can-ban/bien-va-kieu-du-lieu/quiz` | the first seed question of lesson 3 and the counter `Câu 1 / 2` are shown |
| A1 | admin | open `/admin`, `/admin/courses`, `/admin/chapters`, `/admin/lessons`, `/admin/transactions`, `/admin/users` (six tests) | each renders, and shows a seed value: a course name, a chapter title, a lesson title, the student's payment, the three users |
| A2 | admin | open `/learn/javascript-can-ban/bien-va-kieu-du-lieu` | the lesson text is shown (admin needs no enrollment) |

## Appendix B: DevSpace block in the `playwright-cli` skill

One block under the H1. It ends with a line saying it wins over the rest of the file. It states:

- Use when: an agent drives the DevSpace app in a browser from the shell on the Owner's machine (inspect a page, reproduce a UI bug, record evidence), or runs and debugs the e2e suite. Do not use when: the built-in browser pane is enough for a manual pass (`frontend-workflow`), or the target is not a local host.
- Run it as `npx --no-install playwright cli` from the pinned devDependency; never install it globally.
- Open only `127.0.0.1` or `localhost`, against the local stack started for the e2e run. Never open production, the Supabase dashboard or any hosted page.
- Never `attach` to a running browser (`--cdp`, `--extension`) without asking the Owner first; the `ask` rules in `.claude/settings.json` back this up.
- Sign in by loading a session saved by the e2e setup (`__tests__/e2e/.auth/`); never type a password.
- Screenshots and videos go to ignored paths. Attaching one to a PR is a PR update and needs the grant for that PR. Creating, editing or commenting on an issue needs its own Owner grant for that exact action and target (`.claude/rules.md` section 4).
- Provenance: upstream repo, commit, license, and how to update. Take the new upstream files, re-apply the description and this block, compare the reference SHAs, and run `npm run docs:check`.
