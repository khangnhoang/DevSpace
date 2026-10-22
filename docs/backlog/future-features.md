# Future features — backlog

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan. FEAT-001 moved to [infrastructure](../programs/infrastructure/future-features.md) on 2026-10-22.

## FEAT-005: Zod, React Hook Form and shadcn in the skills

- Status: Deferred until the foundation PR (shadcn + Zod + React Hook Form) lands; the Owner wants these adopted incrementally.
- Direction: extend `server-actions` with the Zod parts of VocaSpace `nextjs-server-action-zod` (schemas, FormData, RHF contracts) instead of creating a second skill (D15). Extend `frontend-workflow` with the RHF/shadcn parts, async state and forms (D16). Update `frontend-design` to use shadcn components; it now says "no shadcn, don't add UI libs".
- Target program: none yet (a separate foundation PR).

## FEAT-006: Replace `window.confirm` with a Dialog

- Status: Deferred until shadcn is applied.
- Direction: replace the `window.confirm` delete confirmations (comments, admin CRUD of courses/chapters/lessons) with a Dialog. Tracked as P21 in `security-hotfix/problems.md`; `frontend-design` already points to this.
- Target program: none yet (the foundation PR).

## FEAT-007: Token budget rule

- Status: Deferred; the rule was cut down to "read deliberately" (`CLAUDE.md` rule 6).
- Direction: revisit a fuller token-budget rule (VocaSpace Core Engineering Rule 6) only if the Owner sets budgets.
- Target program: none yet.
