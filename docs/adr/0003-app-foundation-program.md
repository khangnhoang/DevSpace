# ADR 0003: App foundation program before the migration

Date: 2026-10-25. Status: Accepted.

## Context

[ADR 0001](0001-modernization-roadmap.md) orders the work as agent-workflow, infrastructure, techstack-migration, and says shadcn, Zod and React Hook Form are adopted incrementally in "a separate foundation PR" without giving that work a place in the order. Backlog FEAT-005 (Zod, React Hook Form and shadcn in the skills) and FEAT-006 (replace `window.confirm` with a Dialog, P21) wait for it with no target program, and the `server-actions` and `frontend-design` skills still say there is no schema library and no shadcn. When infrastructure U6 merged (PR 19, 2026-10-25) the regression cover from U3 to U5 (Vitest unit and RLS, the Playwright smoke, blocking CI) was in place, and only U7 (a docs-only dependency policy) remained in that program.

## Decision

The roadmap gains a fourth program, `app-foundation`, between infrastructure and techstack-migration: (1) agent-workflow, (2) infrastructure, (3) app-foundation, (4) techstack-migration (Next.js + NestJS + PostgreSQL). It is a delivery program that adopts shadcn, Zod and React Hook Form incrementally, one small PR per unit, and updates the skills that describe them. It starts after infrastructure U7 merges. Its scope: shadcn components and React Hook Form on the frontend, and Zod on both sides, as the schema for forms and as server-side validation of the data every server action accepts. The schemas are written to be shared between client and server and to move to the NestJS backend; the program does not restructure server actions beyond their validation.

## Consequences

- ADR 0001's rule still holds: no unit modernizes a part the migration replaces (for example the Supabase auth helpers).
- FEAT-005 and FEAT-006 target `app-foundation`: when its first unit is planned they enter its plan scope and close in the backlog as `Moved to`.
- Every unit keeps behavior covered by the U3 to U5 suites and adds tests where it changes a form or a validation contract (`test-quality-strategy`).
- Until the program's first unit merges, the current skill rules stand: server actions validate by hand and UI work adds no component library.
- techstack-migration starts later, from forms and Zod schemas that already define the request contracts the NestJS backend validates.
- Its Zod units change server-side validation, so they follow `server-actions` and get the risk handling of server-action changes.
