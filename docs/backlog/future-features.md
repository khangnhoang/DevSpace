# Future features — backlog

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan.

## BL-F1: One shared local test password

- Status: Deferred (Owner request, 2026-10-25, during the infrastructure U6 manual pass).
- Direction: give the invented local accounts one easy password instead of one per account, in `supabase/seed.sql`, `__tests__/e2e/accounts.ts`, `__tests__/rls/global-setup.ts` and `__tests__/rls/profiles.test.ts` together; local stack and CI only, never hosted. Small task: `db reset`, `npm test` and `npm run test:e2e` stay green.
- Target program: none yet.

## BL-F2: E2e coverage for the flows U6 checked by hand

- Status: Deferred (Owner request, 2026-10-25).
- Direction: automate remaining behavior from the U6 manual pass ([plan Appendix B](../programs/infrastructure/implementation-plans/u6-lint-cleanup/plan.md), M1-M12 and M5b), selected by `test-quality-strategy`, without duplicating current assertions. Rendering/payment coverage already covers much of M4 and approve/reject in M10. App-foundation U1 replaced native confirms and added real fixture deletes for course/chapter/lesson/exercise/user (`admin.spec.ts` A4-A8), comment deletion (`student.spec.ts` T4), dialog keyboard/mobile/style checks (A10/T5), cancelled AI bulk-create/unsaved-lesson behavior (A9), non-payment transit failure (A3), and payment dialog cancel/pending/transit failure (AP4-AP6). No native-confirm stub dependency remains. Outstanding scenarios include Header search (M1), wrong-password recovery (M2), review list/paging/edit (M3), remaining comment behavior, notes, complete button and a full quiz (M5/M5b; T2/T3 assert only initial quiz interaction), profile edit and transaction filter (M6), try-it editing (M7), admin notification bell (M8), course/chapter/lesson/exercise edit (M9), admin transaction status filter (M10), avatar preview (M11) and same-password reset message (M12). Coordinate with feature-owned coverage, BL-F7 failure/race work and BL-F6 safe fixtures; this entry remains open and adds no tests now. Justify residual perceptual/exploratory checks such as confetti or image appearance per scenario.
- Target program: none yet (app-foundation is the natural owner if its form units want the cover first).

## BL-F4: Images for the seed courses

- Status: Deferred (Owner decision, agent-workflow U4 D7, 2026-10-25).
- Direction: give the seed courses invented images so the local stack shows them: image files in the repo uploaded on start through `[storage.buckets.<name>] objects_path` in `supabase/config.toml` (or into a bucket the baseline already has, such as `avatars`), and seed `image_url` values pointing at them (`supabase/seed.sql:39-41` sets none today). The bucket the code uploads to already exists (`supabase/migrations/20261021000000_baseline.sql:1420`), so no migration is needed for it. Also note that the local home page fetches an external placeholder image (`placehold.co`) through `/_next/image`; seed images remove that fetch. `db reset`, `npm test` and `npm run test:e2e` stay green (`test-quality-strategy`, Test data).
- Target program: none yet (backlog; small task).

## BL-F5: Local mail into the local stack's mail sink

- Status: Deferred (Owner, agent-workflow U4, 2026-10-25).
- Direction: `npm run dev` sends mail with Gmail placeholders, so a send fails and is only logged (`lib/email.server.ts:74-76`; `app/action/payment.ts:293` ignores the result). Route local mail into the local stack's mail sink instead (`[local_smtp]` in `supabase/config.toml:106`, with an SMTP port exposed) so a manual pass can read the mail; this needs `lib/email.server.ts:5-9` to take the SMTP host from the environment instead of hard-coding `service: "gmail"`, and the dev env map in `__tests__/helpers/dev-env.ts` to set it. Hosted mail stays Gmail.
- Target program: none yet (backlog; a small code and config task).

## BL-F3: Separate dev and test local stacks

- Status: Deferred (Owner decision, 2026-10-25). Starts as a backlog task or as a program the Owner opens for it; it needs no revision of the infrastructure master plan.
- Direction: run two local Supabase stacks instead of one: `dev` (seed data, manual QA) and `test` (the `rls` and `e2e` suites, each on a fresh `db reset`, still cleaning up after themselves), with distinct `project_id`s and port ranges, shared migrations and seed, and test helpers that read the `test` stack. A stack is started only when needed and stopped after use; every start and stop is confirmed (`supabase status` and `docker ps` for that `project_id`), not assumed from the command's exit; a reset needs to know who owns the stack. A third stack (separate `rls` and `e2e`) was considered and not chosen: double the containers for little gain. CI is unaffected (one stack per job).
- Target program: none yet (backlog; a program if the Owner opens one).


## Closed

- BL-F6 — Moved to [quality-engineering](../programs/quality-engineering/future-features.md)
- BL-F7 — Moved to [quality-engineering](../programs/quality-engineering/future-features.md)
- BL-F8 — Moved to [quality-engineering](../programs/quality-engineering/future-features.md)

- FEAT-001 — Moved to [infrastructure](../programs/infrastructure/future-features.md)
- FEAT-007 — Moved to [agent-workflow](../programs/agent-workflow/future-features.md)
- FEAT-019 — Moved to [dependency-maintenance](../programs/dependency-maintenance/future-features.md)
- FEAT-020 — Moved to [dependency-maintenance](../programs/dependency-maintenance/future-features.md)
