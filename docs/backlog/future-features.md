# Future features — backlog

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan.

## FEAT-005: Zod, React Hook Form and shadcn in the skills

- Status: Planned for the `frontend-foundation` program ([ADR 0003](../adr/0003-frontend-foundation-program.md)); the Owner wants these adopted incrementally.
- Direction: extend `server-actions` with the Zod parts of VocaSpace `nextjs-server-action-zod` (schemas, FormData, RHF contracts) instead of creating a second skill (D15). Extend `frontend-workflow` with the RHF/shadcn parts, async state and forms (D16). Update `frontend-design` to use shadcn components; it now says "no shadcn, don't add UI libs".
- Target program: frontend-foundation (moves into its `future-features.md` when its first unit is planned).

## FEAT-006: Replace `window.confirm` with a Dialog

- Status: Planned for the `frontend-foundation` program, after shadcn is applied ([ADR 0003](../adr/0003-frontend-foundation-program.md)).
- Direction: replace the `window.confirm` delete confirmations (comments, admin CRUD of courses/chapters/lessons) with a Dialog. Tracked as P21 in `security-hotfix/problems.md`; `frontend-design` already points to this.
- Target program: frontend-foundation (moves into its `future-features.md` when its first unit is planned).

## FEAT-012: One shared local test password

- Status: Deferred (Owner request, 2026-10-25, during the infrastructure U6 manual pass).
- Direction: give the invented local accounts one easy password instead of one per account, in `supabase/seed.sql`, `__tests__/e2e/accounts.ts`, `__tests__/rls/global-setup.ts` and `__tests__/rls/profiles.test.ts` together; local stack and CI only, never hosted. Small task: `db reset`, `npm test` and `npm run test:e2e` stay green.
- Target program: none yet.

## FEAT-013: E2e coverage for the flows U6 checked by hand

- Status: Deferred (Owner request, 2026-10-25).
- Direction: the Playwright smoke loads the profile and admin pages but does not act on them, so the U6 manual pass checked by hand: profile edit and its transaction filter, admin course, chapter, lesson and exercise edit and delete, the admin notification bell, the user avatar preview, the admin transactions filter, and the same-password reset message. Add smoke rows that act on these so later refactors need less manual QA; a delete confirmation needs a stub until FEAT-006 replaces `window.confirm`.
- Target program: none yet (frontend-foundation is the natural owner if its form units want the cover first).

## Closed

- FEAT-001 — Moved to [infrastructure](../programs/infrastructure/future-features.md)
- FEAT-007 — Moved to [agent-workflow](../programs/agent-workflow/future-features.md)
