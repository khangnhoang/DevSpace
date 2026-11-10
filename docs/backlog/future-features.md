# Future features — backlog

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan.

## BL-F4: Images for the seed courses

- Status: Deferred (Owner decision, agent-workflow U4 D7, 2026-10-25).
- Direction: give the seed courses invented images so the local stack shows them: image files in the repo uploaded on start through `[storage.buckets.<name>] objects_path` in `supabase/config.toml` (or into a bucket the baseline already has, such as `avatars`), and seed `image_url` values pointing at them (`supabase/seed.sql:39-41` sets none today). The bucket the code uploads to already exists (`supabase/migrations/20261021000000_baseline.sql:1420`), so no migration is needed for it. Also note that the local home page fetches an external placeholder image (`placehold.co`) through `/_next/image`; seed images remove that fetch. `db reset`, `npm test` and `npm run test:e2e` stay green (`test-quality-strategy`, Test data).
- Target program: none yet (backlog; small task).

## BL-F13: Gate frontend production promotion on API readiness

- Status: Deferred by the Owner (2026-11-10). Continue the NestJS migration using the existing rollout order first.
- Direction: stage the Vercel production build and keep the current frontend live until it is ready and Railway serves the required API version and passes a smoke check of the new endpoints. Apply the gate to frontend releases with a new backend dependency, including features added after the migration. Verify that the gate holds `devspace-lms.vercel.app` on the current Vercel plan, including when Railway is late or fails. Review [ADR 0008](../adr/0008-backend-architecture-and-hosting.md) before changing rollout policy.
- Target program: none yet.

## Closed

- BL-F6 — Moved to [quality-engineering](../programs/quality-engineering/future-features.md)
- BL-F7 — Moved to [quality-engineering](../programs/quality-engineering/future-features.md)
- BL-F8 — Moved to [quality-engineering](../programs/quality-engineering/future-features.md)

- FEAT-001 — Moved to [infrastructure](../programs/infrastructure/future-features.md)
- FEAT-007 — Moved to [agent-workflow](../programs/agent-workflow/future-features.md)
- FEAT-019 — Moved to [dependency-maintenance](../programs/dependency-maintenance/future-features.md)
- FEAT-020 — Moved to [dependency-maintenance](../programs/dependency-maintenance/future-features.md)
- BL-F5 — Moved to [quality-engineering](../programs/quality-engineering/future-features.md)
- BL-F3 — Moved to [quality-engineering](../programs/quality-engineering/future-features.md)
- BL-F10 — Moved to [ui-ux](../programs/ui-ux/future-features.md)
- BL-F1 — Done: the three seed users share one local password in `supabase/seed.sql`, `__tests__/e2e/accounts.ts` and `__tests__/rls/global-setup.ts`; the dev stack takes it at its next `db reset` (PR #55)
- BL-F12 — Done: Prettier 3.9.10 pinned, `npm run format` and `npm run format:check` on the files a change touches, the format step in `git-pr-workflow`; Markdown is not formatted (PR #59)
- BL-F2 — Moved to [quality-engineering](../programs/quality-engineering/future-features.md)
- BL-F11 — Moved to [techstack-migration](../programs/techstack-migration/future-features.md)
- BL-F9 — Dropped: the Gemini key still works on local and production (Owner, 2026-11-08); the AI quiz action moves to NestJS on Gemini in techstack-migration TM-U8
