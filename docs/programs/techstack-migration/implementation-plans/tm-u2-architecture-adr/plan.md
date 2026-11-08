# TM-U2 detail plan — Architecture ADR

Revision: r3, 2026-11-08. Owner approval: r3 on 2026-11-08 after the Codex plan gate PASS. Master plan: [plan.md](../../plan.md) (Units row TM-U2, section 5 step 3, section 6 risks).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: ADR 0008 is accepted and merged, and settles every architecture question the later units depend on, backed by local spike results and dated vendor evidence, so TM-U3 starts without a new architecture decision. No backend code reaches `main`, nothing is deployed and production does not change.

The ADR answers these decisions. Each is the row its acceptance refers to.

| ID | Decision | The ADR must settle |
| --- | --- | --- |
| D1 | NestJS host | Host, plan, region, always-on or scale-to-zero, Node version it runs against `.node-version`, how the Vercel frontend reaches it. |
| D2 | PostgreSQL host | The host for TM-U3 to TM-U10 and the host after TM-U11 (a move only if they differ); connection path and pooling limit; how a backup and the TM-U1 restore check work on it, including what changes in the runbook when the host is not Supabase. |
| D3 | File store | Store, public URL shape, how `remotePatterns` and uploads through the API work; what TM-U10 copies. |
| D4 | Repository layout | Where the NestJS app lives, how it imports `lib/schemas` without a second copy, how installs, `tsc`, lint and the Vercel build keep working, and how one `npm run dev` starts both apps. |
| D5 | Browser-to-API origin and cookies | One browser origin (for example a same-origin rewrite), the local, test and production URLs, how a Server Component or server action forwards the session, and the cross-site request defense for a cookie-authenticated POST. |
| D6 | Supabase session before TM-U9 | How NestJS verifies the current session (a `getUser` call or local JWT verification), who refreshes it, what a signed-out or deleted user's still-valid token can do, and the cost per request. |
| D7 | Authorization model | Server checks as the enforcement; with or without RLS as a second layer; the database role NestJS connects as and why; how an `rls` guarantee is re-proven by an API test (master plan section 3). |
| D8 | Realtime replacement | What replaces the one realtime use, the sidebar progress update, and the visible behavior after it. |
| D9 | Drizzle | Generation from the database before TM-U11 without migrating, and the baseline and ownership after it. |
| D10 | API tests, CI, deploy | Test layers and their stack, the network guard for the API, new CI jobs without renaming the required checks, the deploy pipeline, the production settings the Owner sets, and the API's rollback. |
| D11 | Cost and latency | Per-service plan, limits, expected use, monthly cost and total; region map; latency budget per request and how TM-U3 measures it. |
| D12 | Better Auth placement | NestJS through the community package or a Next.js route; the pinned versions; the HTTP adapter (Express or Fastify); how the choice serves D5 and TM-U9. |

| ID | Observable result |
| --- | --- |
| AC1 | `docs/adr/0008-<slug>.md` follows the ADR template, is listed in `docs/adr/README.md` with its date and status, and `npm run docs:check` passes. |
| AC2 | For each of D1 to D12 the ADR states the chosen option, the options rejected with the reason, the evidence (a spike ID of AC5 or a dated vendor link) and the condition that would reopen the decision. |
| AC3 | The candidates of D1 to D3 include the Owner's reference stack (Owner decision 15) and every alternative listed in section 2, each marked chosen, rejected with a reason, or excluded with the fact that excludes it. |
| AC4 | The D11 table shows a new monthly total of at most 10 USD at the expected use, and for each service states what happens at its limit (sleep, suspend, write block or extra bill) and which alert warns of it. Current Vercel and Supabase bills are shown apart. |
| AC5 | Each spike below ran locally and the ADR records its result, the exact versions and any failure. S1 must pass on the chosen D5 topology before the ADR is accepted (master plan section 6): a failing S1 changes D5. A failure of S2 to S5 changes its decision, or stays in the ADR as a named open risk the Owner accepts only when it neither stands in for required evidence nor breaks an invariant. No failure is reported as passed. |
| AC6 | The ADR's Consequences section lists what TM-U3 needs: accounts and settings the Owner creates (names only), the instruction files TM-U3 must update, the measurements TM-U3 owes (Owner decision 16), and an authenticated proof on the production topology before any domain moves: a browser session cookie reaching the API, a Server Component's forwarded request, a token refresh and a refused cross-site POST, with the Owner signing in and the grants that proof needs named. |
| AC7 | The ADR's status reads `Accepted` only after its Codex gate passed and the Owner accepted it in words; until then it reads `Proposed`. |

| Spike | Proves, on local stacks only |
| --- | --- |
| S1 Same-origin session | Through the D5 rewrite, a browser session cookie reaches NestJS; a Server Component's forwarded request is authenticated; a refreshed token keeps working; a cross-site POST carrying the cookie is refused. |
| S2 Session verification | The D6 method accepts a valid session and refuses an expired, tampered and absent one; the signed-out and deleted-user cases behave as the ADR says. |
| S3 Shared schemas and Node | NestJS on the `.node-version` major imports a real `lib/schemas` module and refuses an invalid body, in the D4 layout. |
| S4 Drizzle | Drizzle generates a schema from the dev database, read-only, and a read query through it runs as an existing local role that matches the D7 choice; a role that does not exist yet is named in the ADR for TM-U3, not created. |
| S5 Better Auth placement | In the D12 placement and the D5 origin, on a scratch PostgreSQL, sign-in and sign-out work, a user whose stored hash is bcrypt verifies, and the session cookie survives the origin path. |

### 1.2 Scope and non-goals

- In scope (implementor): the throwaway spikes outside the repository, vendor research, the ADR, its index row, State in checkpoint commits.
- In scope (Main): the hosted metadata snapshot, the Codex gate on the ADR.
- In scope (Owner): acceptance of the ADR.
- Non-goals: any backend code, package, CI job or `next.config.ts` change in the repository (TM-U3); any deployment, vendor or hosted account creation, or hosted write (the local fixtures of G3 and G4 are the only accounts created); moving data or files; `AGENTS.md` and skill changes (TM-U3 and TM-U11 own them when the stack changes); closing any TM-P or TM-F entry.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Spike code lives in `%USERPROFILE%\devspace-spikes\tm-u2`, outside the checkout and outside `AppData` (`.claude/rules.md` section 8). Only results reach the ADR. | Spike code or its dependencies enter `main`, or the Owner cannot see the files. |
| G2. Spikes read connection values only from `npx supabase status` of the dev stack, never `.env*`, and use only the local commands of `AGENTS.md` Commands. The status output is captured as JSON in memory; its raw output, keys and connection strings never reach a report or a file. | A spike reaches hosted through the linked checkout or prints a secret. |
| G3. The Owner-approved database scope for the implementor is: start and stop the dev stack; sign-in sessions for its seed users; one invented Auth user `tm-u2-spike@devspace.test`, created and deleted through the local Admin API for S2's deleted-user case and removed by CP1's end; read-only introspection. No seed user is deleted, and no reset, bulk delete or seed change. Before the first Admin API call, creating a user or minting a session, the endpoint the client really uses is matched to the Docker identity of `devspace-local`, not only its port (`AGENTS.md` section 4). S5 uses its own Docker PostgreSQL, container `devspace-tm-u2-spike`, port 56400, bound to `127.0.0.1`. | The dev data for manual QA changes, or the scratch database collides with another stack. |
| G4. S1 and S2 use no password: they mint the session with the local Admin API (`generateLink`, then `verifyOtp`). The only password use is Owner decision 17: S5's script generates a random single-use value for an invented user on the scratch container, and never prints or stores it. | The `AGENTS.md` section 4 rule is widened beyond the Owner's grant, or a credential is exposed. |
| G5. S5 refuses to start if `devspace-tm-u2-spike` or port 56400 already exists. Cleanup runs when a spike fails too. When CP1 ends, the scratch container and its volume are gone, no spike process listens, the spike Auth user is deleted and the dev stack is stopped; the report shows the commands that confirm it, and a failed cleanup is reported as its own blocker. | A leftover service holds a port that a test or the next spike needs, or another resource is removed by name. |
| G6. Price, limit and capability claims cite the vendor's own page with the date read. A third-party comparison may name a candidate but cannot justify a choice. | The ADR rests on stale or wrong numbers. |
| G7. An option that cannot keep a master-plan invariant (section 3) is excluded, with the invariant named. An option where reaching a limit stops production is chosen only with a named alert and fallback. | The ADR picks a host that later breaks production or the backup rule. |
| G8. The ADR holds names of settings and aggregates only: no key, connection string with a password, user row or backup content. | A secret or personal data lands in a merged doc. |

### 1.4 Owner decisions that bind this unit

- Master plan decisions 1, 2, 4 and 7 (target stack; incremental move; TM-U2 decides hosting in an ADR; Codex gate).
- TM-U1 used numbers 9 to 13; this unit continues at 14.
- 14 (2026-11-08) The new hosting cost is at most 10 USD a month.
- 15 (2026-11-08) The reference stack is Vercel for the frontend, Railway (Free or Hobby) for NestJS, Neon Free for PostgreSQL and Cloudflare R2 for files. The ADR compares it with the alternatives and may recommend a better one; the Owner decides by accepting the ADR.
- 16 (2026-11-08) Spikes run locally only: nothing is deployed in this unit. Real latency and cold starts are measured in TM-U3 on production, and the ADR is amended if they fail its budget.
- 17 (2026-11-08) A narrow password exception for this unit only: S5's script may generate and use one random single-use value for an invented user on its scratch container, as G4 says. `AGENTS.md` section 4 is unchanged and nothing else is covered.

## 2. Repository facts

Baseline: `365a73c`, checked 2026-11-08. Vendor pages read 2026-11-08; the ADR re-reads them when it is written.

- Sessions are cookie-based through `@supabase/ssr` (`lib/supabase.ts:41`, `lib/supabase.server.ts`), and `proxy.ts` refreshes them with `getUser` (`lib/supabase.proxy.ts:28-31`) — justifies D5 and D6, S1 and S2.
- The role is read from `profiles` with the caller's session (`lib/auth.server.ts:24-37`); the payment rules are database functions called with the service role (`app/action/payment.ts:33-291`) — justifies D7.
- The one realtime use is `user_progress` in `app/components/SidebarContent.tsx:104-120`, the only table the baseline publishes (`20261021000000_baseline.sql:975`) — justifies D8.
- The app's Storage code uses only `avatars` (`lib/supabase.ts:293,332,482`) and `next.config.ts:24-27` names the hosted host — justifies D3.
- There is one root package with no workspaces, nine modules in `lib/schemas`, `.node-version` major 26 and no `vercel.json` — justifies D4, D10 and S3.
- CI job names are the required checks (`.github/workflows/ci.yml:18-19`); `db` and `e2e` run on the Supabase test stack, and `__tests__/rls` holds the access guarantees — justifies D7 and D10.
- The seed-password exception names only `npm run dev` and the e2e server (`AGENTS.md` section 4) — justifies G4 and Owner decision 17.
- [Railway](https://railway.com/pricing): Free has a 1 USD monthly credit, 0.5 GB per service and no custom domain; Hobby is 5 USD with 5 USD of usage included; a GB of RAM is about 10 USD and a vCPU about 20 USD a month. Inference: an always-on NestJS service costs more than 1 USD of usage, so Free cannot hold it for a month, and Hobby probably stays near its 5 USD. S3's idle memory is the input to check this — justifies AC4.
- [Neon](https://neon.com/pricing): Free has 1 GB per project, 100 CU-hours, 5 GB egress and a 6-hour restore window, and always suspends after 5 minutes idle; past its compute or egress limit, compute is suspended until the next period. Launch has no minimum, 0.106 USD per CU-hour and 0.35 USD per GB-month, with alerts that do not cap spending — justifies AC4 and G7.
- [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/): free for 10 GB-month, 1 million Class A and 10 million Class B requests, and free egress — justifies D3.
- [Supabase](https://supabase.com/pricing): Free has 500 MB, 1 GB files, a pause after one week idle and no automatic backups; Pro starts at 25 USD, over the cap of decision 14 if it were a new cost — justifies D2.
- [Vercel](https://vercel.com/docs/frameworks/backend/nestjs) deploys NestJS with no configuration as one Function on Fluid compute, under the Function limits; the docs give no cold-start figures — justifies the alternative below.
- [Better Auth](https://better-auth.com/docs/integrations/nestjs.md) calls its NestJS integration community-maintained, with beta Fastify support — justifies D12 and S5.
- Alternatives the ADR must assess (AC3). NestJS: Railway Hobby, Vercel Functions, Render, Fly.io, Koyeb, a VPS with Coolify. PostgreSQL: Neon Free, Neon Launch, the existing Supabase Postgres kept through TM-U11 or permanently (master plan Outcome 3, decision 4), Railway PostgreSQL on a volume. Files: R2, Supabase Storage kept, Vercel Blob. Render, Fly.io, Koyeb and the VPS have only third-party numbers so far; G6 applies.
- Not known from the repository: the hosted Supabase region, plan and JWT signing mode, the Vercel plan and function region, the hosted database size. Main hands them over as a snapshot (section 3) — justifies D1, D2, D6 and D11.

## 3. Bounded implementation hypotheses

- Main's snapshot before dispatch uses read-only metadata only: the CLI project listings for region and plan, the public JWKS endpoint for the signing mode and `pg_database_size` — may change if no hosted row is read and no hosted write happens.
- S1 uses a minimal Next.js app with a `rewrites` entry to a NestJS app on another local port — may change if S1's proofs hold.
- The spike Node version comes from `fnm exec --using=<.node-version value>`, since the spike folder has no `.node-version` — may change if S3 runs on major 26.
- The likely ADR shape keeps the template's three sections, with one subsection per decision under Decision and the cost table and spike results as appendices — may change if AC1 and AC2 hold.

## 4. Checkpoints

The implementor does CP1 to CP3; Main runs the snapshot and the Codex gate.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Spikes S1 to S5 run; results, versions and failures reported to Main; nothing committed. | Each spike's stated proof shown by its command output; G5 cleanup commands; `git status --short` shows no spike file in the checkout. |
| CP2 | ADR 0008 `Proposed` with D1 to D12, the cost table, spike results and the TM-U3 list; index row; State. | `npm run docs:check`; AC2 to AC6 checked decision by decision; every vendor claim has a dated vendor link (G6); a search of the ADR for key and connection-string patterns finds none (G8). |
| CP3 | After Codex PASS and the Owner's acceptance, the status reads `Accepted` in the ADR and the index; State says TM-U2 is ready to deliver. | `npm run docs:check`; `git diff` shows only the status and State. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A local same-origin proof passes but the production rewrite behaves differently (headers, cookie attributes, timeouts). | Owner decision 16 keeps deployment out of this unit; AC6 makes TM-U3 prove the authenticated path on the production topology before any domain moves, since a health endpoint passes with no cookie, and the ADR names the fallback. |
| Neon Free stops production at its limit, or a long-lived pool keeps its compute awake and burns the 100 CU-hours. | D2 must state the expected CU-hours for the chosen connection pattern; G7 requires an alert and a fallback, or the ADR picks a paid or kept database. |
| Keeping Supabase Postgres on its free plan pauses after a week idle and has no automatic backups. | The D2 assessment names the Owner's real plan from the snapshot; the backup invariant already requires a manual backup before each hosted write. |
| NestJS as a Vercel Function fits the budget but cold starts or Function limits hurt, and a connection per instance strains the database. | D1 and D2 assess pooling and limits together; the ADR states the condition that reopens it after TM-U3's measurement. |
| The community Better Auth package lags or breaks on the pinned versions. | S5 runs the chosen placement; D12 may place Better Auth in a Next.js route instead. |
| NestJS, Drizzle or Better Auth does not run on Node 26, or the host does not offer it. | S3 and D1 expose it first; the ADR states the supported version, and any Node change goes through `dependency-updates`. |
| Vendor prices or limits change after the ADR. | Dates are in the ADR; AC2's reopen condition covers it. |

- Rollout runbook: none. No hosted or deploy step.
- Stop when: no option fits the 10 USD cap under G7; a spike needs a hosted resource, a deployment or a password use beyond Owner decision 17; a decision needs a change to a master-plan invariant or Owner decision (return to Main, which asks the Owner).
- Rollback: revert the docs PR, or supersede ADR 0008 with a later ADR. Spike files are deleted by the Owner or left outside the repository.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
