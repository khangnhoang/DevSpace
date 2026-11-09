# TM-U3 detail plan — Backend foundation

Revision: r9, 2026-11-09. Owner approval: r9 on 2026-11-09 after the Codex plan gate PASS, which applies the production results to the acceptance and defines PR 2 (Owner decisions 26 to 31). r8 was approved on 2026-11-09 (rollout step 7 gains the check of `NEXT_PUBLIC_BASE_URL`, which the Codex implementation gate found missing); r7 was approved on 2026-11-08 after the Codex plan gate PASS. Master plan: [plan.md](../../plan.md) (Units row TM-U3, section 5 step 4). Architecture: [ADR 0008](../../../../adr/0008-backend-architecture-and-hosting.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: a NestJS API in the ADR 0008 layout runs beside the current app on local, test, CI and production, with a health endpoint, a Drizzle schema generated from the database, a session guard for the current Supabase session, a validation pipe on the shared schemas, API tests and `npm run dev` starting both apps. The ADR's production proofs have run and their results are recorded. No screen and no operation uses the API yet, so production behavior is unchanged.

Local, test and CI (PR 1):

| ID | Observable result |
| --- | --- |
| AC1 | `backend/` is an npm workspace with one root lockfile and one `.node-version`. `npm ci`, the root `tsc`, `npm run build` and PR 1's Vercel preview build behave as before, and no version of an existing root dependency changes in `package-lock.json`. The backend build writes `dist/backend/src/main.js` and `dist/lib/schemas/*`, and that output starts on Node 26. |
| AC2 | `backend` imports `lib/schemas` by relative path. `npm ls zod` shows one copy, and no schema is copied. |
| AC3 | `npm run dev`, with no new dependency, starts `next dev` on `127.0.0.1:3000` and the API on `127.0.0.1:4000` on the dev stack. `GET http://127.0.0.1:3000/api/health` answers through the rewrite. A stopped stack fails with a message before either server starts and never reaches hosted. When one server exits, the launcher stops the other and exits non-zero. |
| AC4 | Anyone calling `GET /api/health` gets 200 with `"ok":true` and the build's commit identifier, with no database use. `GET /api/health/db` gets 200 with `"ok":true` after `select 1` through the pool, a non-200 status with no detail when the database is unreachable, and at most one database probe per 10 seconds however many callers arrive. |
| AC5 | Every route requires a session unless it is marked public. A test that enumerates the registered routes finds exactly `/api/health` and `/api/health/db` public. |
| AC6 | The session guard (D6) accepts a live session and answers 401, with no user data, for an absent, malformed, expired, tampered, `alg: none`, signed-out and deleted-user token. A failed Auth call answers 503 and is never accepted or cached. Only positive results are cached, for at most 30 seconds and never past the token's `exp`, keyed by a hash of the token, in a bounded structure. An operation marked payment or admin class skips the cache. Nothing is accepted from unverified claims. |
| AC7 | The CSRF guard (D5) on every non-GET request carrying a cookie refuses with 403 when `Sec-Fetch-Site` is present and not `same-origin`; otherwise when `Origin` is not on `ALLOWED_ORIGINS`; and when both headers are absent. It is skipped only for a request with `Authorization: Bearer` and no `Cookie`. A cross-origin POST with both a cookie and `Authorization` is 403. The order on every request is proof flag, CSRF guard, session guard, proof owner check on a temporary route, validation, handler, so a refused cross-site request is 403 whether its cookie is invalid or Auth is unavailable. |
| AC8 | A body that fails a schema from `lib/schemas` is 400 with a generic message and no Zod issue list, path or raw input. A valid body reaches the handler with the schema's transforms applied. |
| AC9 | Limits (Owner decision 20): a JSON body over 4 MiB, or a multipart file over 2 MiB, is refused with 413. A body whose bytes read differ from `Content-Length` is refused, never handled as truncated. A handler that finishes within 60 seconds answers normally; one still running at 60 seconds is ended with an explicit error. |
| AC10 | `proxy.ts` still runs `getUser()` on every request it handles and rewrites `/api/*` to `API_INTERNAL_URL` itself, carrying the refreshed cookies on the response and the forwarded request. With `API_INTERNAL_URL` unset, `/api/*` answers 503 and every other route behaves as before. The URL never reaches the browser bundle. |
| AC11 | One server-only helper is the only code that calls `API_INTERNAL_URL`; it forwards the cookie and sets `Origin` to the app origin. Through Next, on the test stack and on the fixtures of AC20: the rewrite keeps a refreshed cookie; a server-side POST through the helper passes; the same POST without the helper's `Origin` is 403; a browser POST from another origin straight to the API is 403; a cross-origin POST to a server action is refused and the API records no call; a signed-in GET render of every route makes no non-GET API call, read from the API's request record. |
| AC12 | Migration `devspace_api` creates the role `NOLOGIN`, `BYPASSRLS`, `NOSUPERUSER`, `NOCREATEROLE`, `NOCREATEDB`, `NOREPLICATION`, with no role membership. Its direct grants are `USAGE` on schema `public` and `SELECT (id, role)` on `public.profiles`, and what `PUBLIC` holds is not changed. An `rls` row shows that it reads `profiles.id, role` regardless of RLS and is refused on another column, any write, `CREATE TABLE` in `public` and `ALTER TABLE`; and reads its effective privileges from the catalog: no other table or column in `public`, `auth` or `storage`, no `CREATE` on those schemas or on the database, no payment function executable, and the functions it can execute through `PUBLIC` equal a list recorded in the test. `TEMP` through `PUBLIC` is unchanged and is not counted as DDL. On a local stack the seed sets `LOGIN` and the invented password. Replay after a reset checks the attributes and a real connection; the rollback restores the earlier state and is replayed locally. |
| AC13 | At startup the API exits non-zero when a required variable is missing, or when `current_user` is not `devspace_api`, on local stacks and through the pooler alike. The pool holds at most 5 connections. |
| AC14 | `drizzle-kit pull` on a local stack generates `backend/src/db/schema.ts` and `relations.ts`; its baseline SQL and `meta/` are removed. The command refuses a non-loopback host. CI regenerates the schema on the test stack and fails on a diff. No Drizzle `push`, `generate` or `migrate` command exists in `package.json`. |
| AC15 | A Vitest project `api` runs under `npm test`, on the test stack, with the same lock, reset and audit. Actor sessions are minted through the local Admin API, with no typed password. A direct Vitest run is refused as for `rls`. The API process runs under a network guard: a connection outside loopback fails the test. |
| AC16 | `npm run test:e2e` starts `next start` on 3100 and the API on 3101, both guarded, and refuses when either port is taken. `buildE2eEnv` holds every variable the code reads. Every existing row passes unchanged. |
| AC17 | CI keeps exactly the required check names `typecheck`, `build`, `docs`, `db`, `e2e`, `lint`, and runs the backend inside them: both type checks, both builds, the `api` project and the schema diff in `db`, both servers in `e2e`, and the backend ESLint config, at 0 problems, in `lint`. |
| AC18 | The instruction files of ADR 0008 Consequences describe what now exists, and each new package has its row in `dependency-updates`. `npm run docs:check` passes. |
| AC19 | With `API_PROOF_ENABLED` unset, every temporary surface of section 1.2 answers 404 on the API and on Next. With it set, a temporary API route answers 404 to a live session whose user id is not `API_PROOF_USER_ID`, and to every session when that variable is unset, and `/tm-u3-proof` answers 404 whenever the API answers it 404. The verify mode of `scripts/tm-u3-proof/`, which takes no cookie, exits non-zero unless every temporary route answers 404. |
| AC20 | The through-Next rows of AC11 run on test-only fixtures (a Next route with its server action, and API routes) that exist only in the e2e build and the e2e API entry point. A production `next build` route list and the backend `dist` hold none of them, and they stay after PR 2. |

Production, after PR 1 merged (the Owner signs in; Main records aggregates only). Rows P1 and P2 are the part of the ADR's authenticated proof that blocks completion. Rows P3, P4, T5 and M2 moved to TM-U5 (decision 27) and are not TM-U3 acceptance. Rows T1 to T4 keep their transport path blocked when they fail; they do not block completion. M1 and M3 are settled by decisions 26 and 29.

| ID | Observable result on the production topology |
| --- | --- |
| R1 | Railway builds and runs the API on Node 26, or on the Dockerfile fallback. `/api/health` reports the merged commit. |
| R2 | `/api/health/db` answers `"ok":true` from Railway, through the Supabase session pooler over IPv4, connected as `devspace_api`. |
| P1 | The browser session cookie reaches the API through the rewrite: `GET /api/session` returns the caller's own user id only, and no cookie is 401. |
| P2 | The temporary Server Component's forwarded request is authenticated. |
| P3 | After the cookie's `expires_at` is set in the past, an `/api` call leaves the browser cookie updated, with no page load. Moved to TM-U5 (decision 27). |
| P4 | A cross-site POST carrying the cookie, from an origin the Owner serves locally, is refused 403 or arrives without the cookie. Moved to TM-U5 (decision 27). |
| T1 | JSON of 1 MiB, 4 MiB, and a multipart upload of a 2 MiB file arrive byte-identical, by hash compared at the API. Not passed (decision 28). |
| T2 | A 58-second response from a timed handler completes and reaches the client. This proves transport only: ADR 0008 D5 pass condition (b), a real Gemini call, stays pending and moves to TM-U8 (Owner decision 23). |
| T3 | Over each limit the request is refused explicitly, a truncated body is refused, and a handler still running at 60 seconds is ended with the explicit error. |
| T4 | A 35-second response and a streamed response are exercised and their behavior is recorded. |
| T5 | 20 parallel requests with an expired cookie leave the session usable, or the failure is recorded and goes to the Owner. Moved to TM-U5 (decision 27). |
| M1 | From the Owner's machine in Vietnam, 100 sequential and 20 concurrent requests each for `/api/health`, `/api/health/db`, `/api/session` with a cold and a warm cache, the `proxy.ts` check alone and the two-query read, with p50 and p95 against both D11 budgets: end to end from the script, and at the API from a `Server-Timing` value on the temporary routes, whose span starts before the session guard and ends after the last query. Cold-cache samples use the temporary sensitive route, which skips the cache. Failed the D11 budget (decision 26). |
| M2 | On the hosted HS256 project the script sends a fixture session's access token to `/api/proof/session-cold`, which skips the cache, before and after the change, using two fixture sessions. While live, each passes the session guard and gets 404 from the proof owner check, which shows the refusal is a real change. The same token gets 401 from the session guard after one session is signed out and after the other's account is deleted. The `/auth/v1/user` round trip from Singapore is recorded with and without the cache. Moved to TM-U5 (decision 27). |
| M3 | Whether a `proxy.ts` pass counts against the Hobby invocation cap is read from the Vercel usage page before and after a counted batch of calls. Inconclusive; does not block (decision 29). |
| E1 | PR 2 is merged: no temporary surface, flag or script of section 1.2 remains, and a search for `tm-u3-proof`, `API_PROOF_ENABLED` and `API_PROOF_USER_ID` finds nothing outside plans and State. `railway.json` is gone (decision 31). The AC20 fixtures and their rows remain, and the two permanent checks of CP6a still pass. |
| E2 | A backup the Owner takes after `devspace_api` has `LOGIN` passes `backup:check`, which imports its `roles.sql`. |

### 1.2 Scope and non-goals

- In scope (implementor): `backend/`, the workspace wiring, the dev launcher, the `proxy.ts` rewrite, the server helper, the `devspace_api` migration and its rollback, the local role password, Drizzle generation, the `api` Vitest project and API guard, e2e with two servers, CI, the fallback `Dockerfile.api`, instruction files, tests, State in checkpoint commits, and the removal in PR 2.
- Temporary surfaces, each behind `API_PROOF_ENABLED=1`, the API routes open only to the session of `API_PROOF_USER_ID` (Owner decision 24), and each removed by PR 2: `GET /api/session` (user id only); `GET /api/proof/session-cold` (the same, marked sensitive so it skips the cache); `GET /api/proof/read` (two sequential Drizzle reads of the caller's own `profiles.id, role`, returns only `ok`); `POST /api/proof/echo` and `POST /api/proof/upload` (return only length and SHA-256); `GET /api/proof/slow` (35, 58 or 65 seconds only); `GET /api/proof/stream`; `app/tm-u3-proof/page.tsx`; `scripts/tm-u3-proof/`.
- Test-only fixtures, which stay (AC20): the Next route and server action, and the API routes, that the through-Next rows drive.
- In scope (Main): hosted metadata, read-only Railway CLI use under G10, the Codex gates, hosted apply, the postflight, `backup:check`, recording results.
- In scope (Owner): the backup; the hosted `LOGIN` and password of `devspace_api`; `railway login` and `railway link`, in the Owner's own terminal; every Railway, Vercel and uptime-monitor setting; the first deploy; signing in for the proofs; the usage reads.
- Non-goals: moving any operation or screen to the API (TM-U4 onward); changing the supported limits later units may re-prove; Better Auth and `jose`; the R2 bucket; `GEMINI_API_KEY` on Railway (no Gemini code exists in the API until TM-U8; the long-call proof is a timed handler, Owner decision 23); rate limiting; closing any TM-P or TM-F entry other than TM-P14 (decision 30); modernizing `@supabase/ssr`.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The implementor runs nothing that reaches hosted, Railway, Vercel or Cloudflare, and reads no `.env*`. Local stacks only, under `AGENTS.md` section 4. The approved implementor scope on the dev stack is: `start`, `stop`, `migration up --local`, and one `alter role devspace_api login password` with the seed's local value, because `migration up` does not rerun the seed, after the target's Docker identity is verified. No reset. | A production system changes during implementation, or QA data is lost. |
| G2. No screen, server action or Server Component that can reach a production build calls the API, other than the temporary surfaces of section 1.2. The AC20 fixtures may call it because they exist only in the e2e build and the e2e API entry point. | A page depends on a service that is not deployed yet, and production breaks at merge. |
| G3. The API connects only as `devspace_api`. No connection string or hosted password enters the repository, a command, a log or a report. The local password is an invented local value set by `supabase/seed.sql`, which never reaches hosted (`--include-seed` is forbidden by `supabase-migration`). | The API runs with owner rights, or a credential is exposed. |
| G4. The role's grants are exactly AC12, each new object starting from an explicit revoke (`supabase-migration`, trap 2). Managed schemas and `handle_new_user` are untouched. | A `BYPASSRLS` role with default privileges reaches every table. |
| G5. Temporary handlers never store or log a body, return no field beyond those named in section 1.2, and accept only the session of `API_PROOF_USER_ID`; the flag makes them 404 first. A proof window always ends with the cleanup of rollout step 9, on pass, failure or interruption. | A public echo endpoint becomes a data path or a way to burn the Railway budget during or after the proofs. |
| G6. The proof script takes the Owner's cookie and the fixture tokens from the Owner's own terminal environment, never writes it to a file and prints only status, timing and hash equality. Results recorded in State or a PR are aggregates. | A session token lands in a log, a doc or a transcript. |
| G7. Drizzle commands run only against loopback, and generated baseline SQL is never applied. | Two migration owners, or a write to hosted through a linked checkout. |
| G8. Every new test process runs under the existing lock and writer preload, and writes only owned fixtures. | Residue on the shared test stack, or a run that bypasses the audit. |
| G9. `proxy.ts` changes only for the rewrite; `lib/schemas` is unchanged unless a schema cannot compile under the backend's `tsconfig`, which stops the work. | The migration refactors what later units replace, or forks the schema contract. |
| G10. Main may run Railway CLI commands that only read, for the rollout, diagnosis, monitoring and cost checks of this unit (for example `whoami`, `list`, `status`, `logs`, `metrics`, `usage` without changing a limit, listing deployments or services). It never reads the CLI's stored login and never runs what can show a secret value, for example `variable`, `run`, `shell`, `connect`, `ssh`, `dev` and `code get-config`. The list is not complete, so a command not named here is read in its help first. An `api` call is judged by its operation and by the fields it returns: only a query that returns no secret value. Any command that changes Railway (`up`, `deploy`, `redeploy`, `restart`, `down`, `delete`, a setting, a variable, a limit, a resource) needs its own Owner grant naming the action and target. The permission ends with this unit. | A diagnostic command prints a credential, or a read session turns into a production change. |

### 1.4 Owner decisions that bind this unit

- Master plan decisions 1, 2, 4 and 7; ADR 0008 D1 to D12 and Owner decisions 14 to 19.
- 20 (2026-11-08) The supported limits are: one file of 2 MiB, JSON of 4 MiB, a long call of 60 seconds. The API ends a long call at 60 seconds with an explicit error.
- 21 (2026-11-08) The temporary proof surfaces merge in PR 1 behind a flag that is off by default, require a session, and are removed by PR 2. TM-U3 completes only when PR 2 is merged.
- 22 (2026-11-08) The first week of Railway usage and whether a daily `select 1` stops the Supabase pause do not block TM-U4. TM-U3 completes on the same-day proofs. The Owner reads the usage after 7 days and it is recorded as a milestone; when it exceeds the included 5 USD by more than 3 USD, D1 reopens. The pause stays watched by the `/api/health/db` monitor and is recorded as not proven.
- 23 (2026-11-08) ADR 0008 D5 pass condition (b), a real Gemini call of the longest supported length reaching the client, moves from TM-U3 to TM-U8: it must pass on the production topology before the merge that moves Gemini to the API. TM-U3 records the 58-second transport result only. Railway gets no `GEMINI_API_KEY` before TM-U8.
- 24 (2026-11-08) While the flag is on, the temporary API routes accept only the session of the user id in `API_PROOF_USER_ID`, and any other session gets 404. The proof window closes only when the script's verify mode passes.
- 25 (2026-11-08) The Railway CLI is installed globally and the Owner signs in to it. During TM-U3, and only then, agents use it under G10: read operations for deployment, diagnosis, monitoring and cost, with no secret value read or printed. Changes to Railway production need a separate Owner grant.

- 26 (2026-11-09) M1 failed the ADR 0008 D11 budget. No region or database moves. 300 and 600 ms stay as targets, and ADR 0008 is amended with the breakdown. The gate moves to TM-U4: its first slice reads through the server helper and is measured on production, and the page's p95 may rise by at most 200 ms over the same page before the move (a number set here, no vendor source). Browser calls to `/api/*` stay over budget until re-measured.
- 27 (2026-11-09) P3, P4, T5 and M2 are required before TM-U5's first session route reaches production, and run there on real routes. TM-U3 closes with them unproven on production, covered by local tests only.
- 28 (2026-11-09) T1 is recorded as not passed: through Vercel the contract rows passed in 1 of 2 runs. The upload path stays blocked for TM-U5, TM-U8 and TM-U10 until re-proven, as ADR 0008 D5 says, with no further investigation now. Binary 4 MiB through Vercel is an unsupported limit, investigated only if a feature depends on it. JSON 4 MiB and file 2 MiB are unchanged (decision 20).
- 29 (2026-11-09) M3 is inconclusive: the Hobby plan exposes no usable reading (`vercel usage`, `vercel metrics`, runtime and request logs, the dashboard). It does not block TM-U3. Whether a `proxy.ts` pass counts against the invocation cap stays not proven, and the monthly usage check of ADR 0008 appendix A stays.
- 30 (2026-11-09) TM-P14 closes: the header is absent on an anonymous deployed response, and the Owner accepts that reading.
- 31 (2026-11-09) `railway.json` is removed: Railway Config as Code accepts no new service since 2026-08-28 and stops reading files on 2026-12-01. The service's settings live in the Railway dashboard, and the Dockerfile fallback is the variable `RAILWAY_DOCKERFILE_PATH=Dockerfile.api`. No `.railway/railway.ts` in this unit.

## 2. Repository facts

Baseline: `9af09be`, checked 2026-11-08.

- `npm run dev` is `scripts/dev/local.mjs`, which reads the stack and spawns only `next dev`; it takes no lock and writes no data — justifies AC3 and G1.
- No `app/api` route exists; the only route handler is `app/auth/callback/route.ts`, and `/api/` appears only in the Piston URL of `app/(main)/try_it/page.tsx` — justifies AC10, since the rewrite shadows nothing.
- `proxy.ts` delegates to `lib/supabase.proxy.ts`, whose `updateSession` returns `NextResponse.next`, and its matcher excludes paths ending in an image extension — justifies AC10 and G9.
- The root `tsconfig.json` includes `**/*.ts`, and `eslint.config.mjs` has no `backend` ignore — justifies AC1 and AC17.
- `scripts/e2e/run.mjs` checks only port 3100, and `scripts/e2e/serve.mjs` starts `next start` under `server-guard.cjs`; `__tests__/helpers/e2e-env.ts` is tested for completeness by `e2e-env.test.ts` — justifies AC16.
- `callAction` cannot express the AC11 refusal: `WORKER_URLS` (`__tests__/helpers/server-action-core.ts`) maps only named pages, `__tests__/e2e/server-action.ts` always sends the valid origin, and the response reader rejects every non-200 — justifies the bounded harness extension in section 4.
- `npm run backup:check` restores the backup's `roles.sql` (`scripts/backup/`) — justifies E2.
- `vitest.config.mts` defines `unit`, `components` and `rls`; the `rls` global setup refuses a run without the lock — justifies AC15.
- `lib/schemas` holds nine modules that import only `zod` or a sibling — justifies AC2.
- The `avatars` bucket limit is 2097152 bytes (baseline line 1421), and no page sets a smaller client limit — justifies Owner decision 20.
- `.github/workflows/ci.yml` runs on pull requests only since PR 81, so a merge starts no push run, and job IDs are the required checks — justifies AC17.
- Hosted metadata, 2026-11-08, read-only: `postgres` has `CREATEROLE` and `BYPASSRLS` and is not a superuser, so a migration can create a `BYPASSRLS` role; `devspace_api` does not exist. ADR 0008 records the Sydney region, Free plan and HS256 signing — justifies AC12 and M2.
- The vendor pages of ADR 0008 appendix A were read on 2026-11-08 — the rollout re-reads them if it starts more than 30 days later.
- Railway CLI 5.71.0 was installed on 2026-11-08 with `fnm exec -- npm.cmd install -g`, into the fnm folder of Node 26.13.0, outside `AppData` (`.claude/rules.md` section 8). This is machine setup, outside Git; a change of the Node version needs a reinstall. The command list in G10 comes from its `--help` — justifies G10.

## 3. Bounded implementation hypotheses

- `backend/` layout: `src/main.ts`, `src/app.module.ts`, `src/health/`, `src/auth/` (session and CSRF guards, public and sensitive markers), `src/db/`, `src/common/` (Zod pipe, limits, env) and `src/proof/` — may change if AC1 to AC13 hold and `src/proof/` stays deletable alone.
- Starting versions are the lines S3 and S4 ran: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` 12.4.x, `express` ^5, `drizzle-orm` 0.45.x, `drizzle-kit` 0.31.x, `pg` 8.23.x, `reflect-metadata`, `rxjs` — may change if the Spec holds and the new versions get their `dependency-updates` rows.
- `backend/tsconfig.json` sets `rootDir` to the repository root and a CommonJS target; the root `tsconfig.json` and ESLint exclude `backend/`, and a small `backend/eslint.config.mjs` uses `typescript-eslint` — may change if AC1 and AC17 hold.
- The API tests start the Nest app in-process on a loopback port, and the guard reuses the logic of `server-guard.cjs` — may change if AC15 holds.
- The API database URL is built from the local stack's status by replacing the user and password — may change if G3 holds.
- The migration creates the role only when absent, in case a local reset keeps roles; the rollback revokes before dropping — may change if a replay and the rollback both pass.
- The Railway dashboard sets the build and start commands and watch paths `backend/**` and `lib/schemas/**`, and the commit comes from `RAILWAY_GIT_COMMIT_SHA` — may change if R1 holds; a different identifier needs only that `/api/health` reports the merged commit.
- `sslmode=require` on the pooler URL and `pg` idle timeouts — may change if R2 and AC13 hold.
- The Next fixture uses a page extension that `next.config.ts` adds only when the e2e build sets its variable, and the API fixtures live in a separate entry point outside the production `tsconfig`. That variable is set non-empty by `buildE2eEnv` for both the build and the server, is absent in production, and the completeness check of `e2e-env.test.ts` is extended to `next.config.ts` — may change if AC16 and AC20 hold.
- The pooler URL has the shape `postgresql://devspace_api.<project-ref>:<password>@<pooler-host>:5432/postgres` — may change if R2 and AC13 hold; the value lives only in the Railway setting.
- Multipart is parsed with the Express layer Nest ships — may change if AC9 holds, under the Add a package procedure.
- CP6a adds a session-guarded route to `backend/e2e/e2e.controller.ts` that reads through `DbService`, starts the two `db-verification` rows on the `dist-e2e` build, and adds a Server Component under `app/e2e-fixture` that reads through the helper on GET, so T6 has a live API record — may change if CP6a's rows hold and nothing is added to a production build.
- `backend/src/common/raw-body.ts` has `/api/proof/echo` as its only user and goes with it, unless a remaining route uses it — may change if E1 and AC9 hold.

## 4. Checkpoints

The implementor does CP1 to CP5 on `feat/tm-u3-backend-foundation`, and CP6a to CP6c on `chore/tm-u3-remove-proof` after the rollout, branched from `d1ea4b0`. r9 ships in PR 2.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Workspace, build, health routes without the database, backend lint, two-server dev launcher. | AC1 to AC3; a lockfile diff showing root versions unchanged; `npx tsc --noEmit`; `npm run lint`; `npm run build`; backend build and start; `npm run dev` on the dev stack. |
| CP2 | Migration and rollback, local role password, pool, `/api/health/db`, startup checks, Drizzle generation, `api` project and network guard. | AC4, AC12 to AC15; `npm test -- --reset`, then `npm test` on the retained stack; rollback replay on the test stack; a deliberately non-loopback host and a deliberately wrong DB user both refused. |
| CP3 | Default-deny, session guard, CSRF guard, validation pipe, limits. | AC5 to AC9 in the `api` project, each guard proven by a mutation that makes its row fail. |
| CP4 | Rewrite, server helper, temporary surfaces, test-only fixtures, the `callAction` extension, e2e with two servers, CI. | AC10, AC11, AC16, AC17, AC19, AC20; each through-Next row proven by a mutation that makes it fail; `npm run test:e2e`; a production build's route list holds no fixture. |
| CP5 | Instruction files, dependency rows, final regression. | AC18; `npm test` and `npm run test:e2e` unfiltered; `tsc` of both packages; lint; both builds; `npm run docs:check`. |
| CP6a | The two permanent checks stop leaning on temporary surfaces, with the temporary surfaces still present: the `[S2]` rows of `__tests__/api/db-verification.test.ts` read through a test-only route, and T6 of `__tests__/e2e/api-topology.spec.ts` proves its record live on a test-only page. | Both rows pass and each fails under a mutation (the role check before the first query removed; a non-GET call added to the fixture render). A production route list and `dist` hold no new fixture. |
| CP6b | Every temporary surface of section 1.2, its flags and the code only it used are removed, with the rows that test only those surfaces. The AC20 fixtures and the through-Next rows stay. | E1's search, extended with `RawBody`, `IS_RAW_BODY`, `ProofModule`, `proofEnabled` and `proofUserId`; a list mapping each removed row to the temporary surface it tested, so no guarantee of AC5 to AC11 loses its row; `npm test`, `npm run test:e2e`, `tsc` of both packages, both lints, both builds. |
| CP6c | `railway.json` is deleted and the comment of `Dockerfile.api` and the two mentions in `AGENTS.md` corrected; `AGENTS.md` and `test-quality-strategy` no longer describe temporary surfaces, and `server-actions` (Limits) no longer names raw bodies if CP6b removed them. In `problems.md`: TM-P14 resolved (decision 30); new entry TM-P17 for T1 with the numbers of both runs, the 4 MB Routing Middleware limit in Vercel's docs and the blocked paths; a dated update on TM-P15 and TM-P16 that the rollout did not decide them. State records the backups, the apply, the merge and the R, P, T, M and E results as aggregates, moves to TM-U4 and names the pending gates (decisions 26 and 27, and the Gemini gate for TM-U8), and the lagging "(this commit)" gets its hash. | `npm run docs:check`; the CP6b commands reused only if the last edit cannot affect them. |

Verification allocation:

| Guarantee | Layer | Assertion | File or row | Prerequisites |
| --- | --- | --- | --- | --- |
| Session outcomes (AC6) | `api` | status and no user data per token kind; cache expiry; sensitive route skips the cache | `__tests__/api/session.test.ts` (new) | fixture user owned by `FixtureScope`, created and deleted through the local Admin API |
| CSRF and default deny (AC5, AC7) | `api` | status per header combination; route list | `__tests__/api/guards.test.ts` (new) | seed session minted through the Admin API |
| Pipe and limits (AC8, AC9) | `api` | status, generic body, no handler side effect | `__tests__/api/validation.test.ts` (new) | none |
| Health and startup (AC4, AC13) | `api` | probe count under concurrent callers; exit code | `__tests__/api/health.test.ts` (new) | unreachable database simulated by a closed loopback port |
| Proof gates (AC19) | `api`, `e2e` and `unit` | 404 per surface with the flag off; 404 for another live session and with the user id unset, on the API and on the page; 200 for the named user; verify mode fails on any status but 404 | `__tests__/api/proof-gate.test.ts` and `__tests__/unit/proof-verify.test.ts` (new; removed whole by PR 2), and the AC19 rows of `__tests__/e2e/api-topology.spec.ts` (PR 2 removes only those rows; the file and its AC10, AC11 and AC20 rows stay) | a second seed session minted through the Admin API |
| A connection is verified before the first query, and page renders never write through the API, after PR 2 (AC13, AC11) | `api` and `e2e` | as today, on test-only surfaces | the `[S2]` rows of `__tests__/api/db-verification.test.ts`, T6 of `__tests__/e2e/api-topology.spec.ts` | the AC20 fixture builds |
| Role (AC12) | `rls` | allowed read, each denied read, write and DDL | `__tests__/rls/api-role.test.ts` (new) | local role password |
| Rewrite, cookie refresh, helper, server action refusal, no mutation on GET (AC10, AC11, AC20) | `e2e` | browser state and API record | `__tests__/e2e/api-topology.spec.ts` (new) | API request record under `__tests__/e2e/.server/`; bounded `callAction` extension: the fixture's worker in `WORKER_URLS`, a caller-chosen `Origin`, and a narrow expected-refusal path, while every unexpected 5xx and guard record still fails |
| Role replay and connection (AC12) | `rls` | attributes and a real login after a reset | `__tests__/rls/api-role.test.ts` | seed password |
| Schema drift (AC14) | CI command | exit code on a diff | `db` job | test stack |
| Helper shape (AC11) | `unit` | sets `Origin`, forwards the cookie, is the only caller of the variable | `__tests__/unit/api-server-helper.test.ts` (new) | none |

Residual manual matrix (no automated substitute: the real Vercel, Railway and Supabase topology):

| # | Who | Action | Expected | Needs | Reason |
| --- | --- | --- | --- | --- | --- |
| 1 | Owner | Sign in on the production origin; run P1 to P4 | As P1 to P4 | Own account | Only production has the real rewrite, and agents never type the Owner's credentials |
| 2 | Owner | Run `scripts/tm-u3-proof/` with the cookie in the own terminal | T1 to T5, M1, M2 | Own account, and a hosted fixture account the Owner creates and deletes themself | Same, and only the Owner's machine is in Vietnam |
| 3 | Owner | Read the Vercel usage before and after a counted batch | M3 | Vercel dashboard | Only the Owner has the dashboard |
| 4 | Owner | Open the home page, a course and a lesson after PR 1 and after PR 2 | Unchanged | Own account | Smoke of live production |

Readiness: automated rows use the seed and owned fixtures. Rows 1 and 2 ran as far as decisions 26 to 28 require, and row 3 ended inconclusive (decision 29). Row 4 after PR 2's merge is the last manual check: TM-U3 completes when E1, E2, the rollout step 10 monitors and row 4 hold.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The workspace changes the Vercel build or hoists a different version of a root dependency. | CP1's lockfile diff; PR 1's Vercel preview exposes it before merge; D4 names the fix. |
| Railway has no Node 26 build. | R1 is the first production step; the fallback Dockerfile ships in PR 1. |
| Vercel's external rewrite drops cookies, changes bodies or times out. | P1 and P2 stop the unit; T1 to T4 keep only their path blocked; D5 names the route-handler fallback, which needs a new plan revision. |
| The latency budget fails with two session checks per request. | M1 separated the hops it could, not the `proxy.ts` check; decision 26 settles the failure and moves the gate to TM-U4. |
| The API is public and a route ships without authentication. | AC5's route enumeration; G5. |
| 20 concurrent refreshes revoke the Owner's session on production. | T5 moved to TM-U5 (decision 27), which plans it with the Owner signing in again. |
| `backup:check` meets a new login role, whose dump adds to `roles.sql`. | E2 proves it inside this unit, at rollout step 11, before TM-U4's first hosted write; a failure is fixed in PR 2 or stops the unit. |
| The temporary surfaces outlive the proofs or a failed proof, or another account uses them while the flag is on. | Rollout step 9 runs on pass, failure and interruption and ends with the scripted check. Owner decision 24 limits them to one user. Decision 21: TM-U3 cannot complete before PR 2. |

Rollout runbook, in order (every grant separate, `AGENTS.md` section 4):

1. Main: Codex gate on the implementation and the migration; PR 1 with CI green.
2. Owner takes a backup; Main runs `backup:check` on it (grant for that backup).
3. Main: prepare and apply the migration, two grants (`supabase-migration`, Hosted apply), then the postflight of role attributes and grants by metadata and simulated role.
4. Owner: in the hosted SQL editor, sets `LOGIN` and a generated password on `devspace_api`. Main re-reads `rolcanlogin` only.
5. Owner merges or grants the merge of PR 1. Vercel deploys as usual; `/api/*` answers 503 until step 7.
6. Owner, as the instruction for the first deploy: creates the Railway project and service `devspace-api` in Singapore with the GitHub connection, restart policy, health path `/api/health`, hard limit 10 USD and email alert at 7 USD, and the build, start and watch-path settings in the dashboard (decision 31); sets `DATABASE_URL` (session pooler, user `devspace_api.<project-ref>`), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGINS`, `API_PROOF_ENABLED=1` and `API_PROOF_USER_ID` (the Owner's own user id). R1 and R2.
7. Owner on Vercel: function region `sin1`, `API_INTERNAL_URL`, `API_PROOF_ENABLED=1`; confirms that `NEXT_PUBLIC_BASE_URL` is the production origin and equals an entry of Railway's `ALLOWED_ORIGINS` (the server helper throws without it, and a different origin fails the CSRF guard), then redeploys production.
8. Owner runs P1, P2, T1 to T4, M1 and M3; Main records aggregates in State.
9. Proof cleanup, on pass, failure or interruption: the Owner removes `API_PROOF_ENABLED` and `API_PROOF_USER_ID` on Railway and `API_PROOF_ENABLED` on Vercel, redeploys both and runs the script's verify mode, which must pass; a 401 or 200 means the flag is still on. Cleanup is not a pass: a failed row stays failed, and a failed P row stops the unit here, and the failed budget is settled by decision 26.
10. Owner sets the two uptime keyword monitors and the dated usage checks of ADR 0008 appendix A.
11. Owner takes a new backup; Main runs `backup:check` on it, under a grant for that backup (E2).
12. Main: PR 2 under its own grants; after its merge, E1 and manual row 4.
13. After 7 days the Owner reads the Railway usage (Owner decision 22). Main reads it with `railway usage` only while TM-U3 is still open (G10) or under a new Owner grant.

- Stop when: a guard cannot meet AC5 to AC9 without changing an ADR decision; a `lib/schemas` module does not compile for the backend; P1 or P2 fails; CP6a cannot keep the guarantee of a permanent check; any step needs a permission this plan does not name. Return to Main, which asks the Owner.
- Rollback: before step 5, close PR 1 and run the migration's `.down.sql` under a new grant after setting the role back to `NOLOGIN`. After step 5, the frontend is unaffected by a failed API because no screen calls it: pause the Railway service or unset `API_INTERNAL_URL`, and revert PR 1 under a new grant. The `sin1` region returns by the same Vercel setting. The hosted role stays harmless with `NOLOGIN` until a later migration removes it.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
