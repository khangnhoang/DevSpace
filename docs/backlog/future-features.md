# Future features — backlog

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan.

## FEAT-005: Zod, React Hook Form and shadcn in the skills

- Status: Planned for the `app-foundation` program ([ADR 0003](../adr/0003-app-foundation-program.md)); the Owner wants these adopted incrementally.
- Direction: extend `server-actions` with the Zod parts of VocaSpace `nextjs-server-action-zod` (schemas, FormData, RHF contracts) instead of creating a second skill (D15). Extend `frontend-workflow` with the RHF/shadcn parts, async state and forms (D16). Update `frontend-design` to use shadcn components; it now says "no shadcn, don't add UI libs".
- Target program: app-foundation (when its first unit is planned, the skill updates enter its plan scope and this entry closes as `Moved to`).

## FEAT-006: Replace `window.confirm` with a Dialog

- Status: Planned for the `app-foundation` program, after shadcn is applied ([ADR 0003](../adr/0003-app-foundation-program.md)).
- Direction: replace the `window.confirm` delete confirmations (comments, admin CRUD of courses/chapters/lessons) with a Dialog. Tracked as P21 in `security-hotfix/problems.md`; `frontend-design` already points to this.
- Target program: app-foundation (when its first unit is planned, the Dialog enters its plan scope and this entry closes as `Moved to`).

## FEAT-012: One shared local test password

- Status: Deferred (Owner request, 2026-10-25, during the infrastructure U6 manual pass).
- Direction: give the invented local accounts one easy password instead of one per account, in `supabase/seed.sql`, `__tests__/e2e/accounts.ts`, `__tests__/rls/global-setup.ts` and `__tests__/rls/profiles.test.ts` together; local stack and CI only, never hosted. Small task: `db reset`, `npm test` and `npm run test:e2e` stay green.
- Target program: none yet.

## FEAT-013: E2e coverage for the flows U6 checked by hand

- Status: Deferred (Owner request, 2026-10-25).
- Direction: the U6 manual pass ([plan Appendix B](../programs/infrastructure/implementation-plans/u6-lint-cleanup/plan.md), rows M1 to M12 and M5b) checked by hand what the Playwright smoke does not exercise. The smoke opens the admin lists and the profile (`admin.spec.ts`, `learner.spec.ts`) and drives the payment flow, approve and reject (`payment-*.spec.ts`, so M4 and the approve and reject of M10 are largely covered), but no row runs the Header search (M1), the wrong-password error before a successful sign-in (M2), the review list, paging and edit (M3), comments, notes, the complete button and a full quiz (M5, M5b), the profile edit and transaction filter (M6), the try-it editor (M7), the admin notification bell (M8), the course, chapter and lesson edit and the exercise edit and delete (M9), the admin transaction status filter (M10), the user avatar preview (M11) or the same-password reset message (M12). Add rows that act on these, so later refactors need less manual QA; a delete needs a stub until FEAT-006 replaces `window.confirm`, and confetti and the `onError` image fallback may stay manual.
- Target program: none yet (app-foundation is the natural owner if its form units want the cover first).

## FEAT-015: Images for the seed courses

- Status: Deferred (Owner decision, agent-workflow U4 D7, 2026-10-25).
- Direction: give the seed courses invented images so the local stack shows them: image files in the repo uploaded on start through `[storage.buckets.<name>] objects_path` in `supabase/config.toml` (or into a bucket the baseline already has, such as `avatars`), and seed `image_url` values pointing at them (`supabase/seed.sql:39-41` sets none today). The bucket the code uploads to already exists (`supabase/migrations/20261021000000_baseline.sql:1420`), so no migration is needed for it. Also note that the local home page fetches an external placeholder image (`placehold.co`) through `/_next/image`; seed images remove that fetch. `db reset`, `npm test` and `npm run test:e2e` stay green (`test-quality-strategy`, Test data).
- Target program: none yet (backlog; small task).

## FEAT-016: Local mail into the local stack's mail sink

- Status: Deferred (Owner, agent-workflow U4, 2026-10-25).
- Direction: `npm run dev` sends mail with Gmail placeholders, so a send fails and is only logged (`lib/email.server.ts:74-76`; `app/action/payment.ts:293` ignores the result). Route local mail into the local stack's mail sink instead (`[local_smtp]` in `supabase/config.toml:106`, with an SMTP port exposed) so a manual pass can read the mail; this needs `lib/email.server.ts:5-9` to take the SMTP host from the environment instead of hard-coding `service: "gmail"`, and the dev env map in `__tests__/helpers/dev-env.ts` to set it. Hosted mail stays Gmail.
- Target program: none yet (backlog; a small code and config task).

## FEAT-014: Separate dev and test local stacks

- Status: Deferred (Owner decision, 2026-10-25). Starts as a backlog task or as a program the Owner opens for it; it needs no revision of the infrastructure master plan.
- Direction: run two local Supabase stacks instead of one: `dev` (seed data, manual QA) and `test` (the `rls` and `e2e` suites, each on a fresh `db reset`, still cleaning up after themselves), with distinct `project_id`s and port ranges, shared migrations and seed, and test helpers that read the `test` stack. A stack is started only when needed and stopped after use; every start and stop is confirmed (`supabase status` and `docker ps` for that `project_id`), not assumed from the command's exit; a reset needs to know who owns the stack. A third stack (separate `rls` and `e2e`) was considered and not chosen: double the containers for little gain. CI is unaffected (one stack per job).
- Target program: none yet (backlog; a program if the Owner opens one).

## FEAT-019: Node 26 for production, CI and `@types/node`

- Status: Deferred until Node 26 enters LTS (scheduled 2026-10-28); Owner decision D3 of infrastructure U7 (2026-10-27) and the Owner decision of 2026-10-23.
- Direction: move the three places that set the Node major to 26 in one task, skipping 24: the Vercel production setting, `node-version` in every job of `.github/workflows/ci.yml`, and `@types/node`. They differ today, and the `dependency-updates` Node row requires one major; the Owner's machine follows. Codex-gated because it changes CI and deploy (`.claude/rules.md` section 3). Out of this entry: an `engines` field or `.nvmrc` unless the task's plan decides it.
- Target program: none yet (backlog; its own Codex-gated task).

## FEAT-020: major updates waiting

- Status: Deferred (recorded by infrastructure U7 from `npm outdated`, 2026-10-27).
- Direction: one task per major, each sized by `docs/agent-loops.md` Sizing and following `dependency-updates` (Major): `typescript` 5 to 7, `eslint` 9 to 10, `lucide-react` 0.x to 1, `@google/genai` 1 to 2. `nodemailer` and `@types/nodemailer` are in BL-009, `@types/node` in FEAT-019. `@supabase/ssr` 0.7 to 0.12 is an auth helper and waits for the techstack migration (ADR 0001). The list is a snapshot: re-run `npm outdated` when a task starts.
- Target program: none yet (backlog; small tasks).

## Closed

- FEAT-001 — Moved to [infrastructure](../programs/infrastructure/future-features.md)
- FEAT-007 — Moved to [agent-workflow](../programs/agent-workflow/future-features.md)
