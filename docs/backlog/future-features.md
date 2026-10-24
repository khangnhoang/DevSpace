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

## Closed

- FEAT-001 — Moved to [infrastructure](../programs/infrastructure/future-features.md)
- FEAT-007 — Moved to [agent-workflow](../programs/agent-workflow/future-features.md)
