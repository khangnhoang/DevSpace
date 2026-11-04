# Problems, risks and follow-ups — app-foundation

Plan: [plan.md](plan.md). Progress: [progress.md](progress.md).

## Open

None.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AF-P1 — Resolved 2026-11-03: the user, enroll and Gemini actions log the detail and return fixed Vietnamese messages, covered by e2e V8 to V10 and two Gemini unit tests (PR 55, `9d6198c`).
- AF-P5 — Resolved 2026-11-03: the profile transaction header aligns left below `md` and its status filter is the shadcn `Select`, covered by e2e T6 (PR 55, `9d6198c`).
- AF-P4 — Resolved 2026-11-03: the AF-U3 profile schema turns a blank date of birth into null, so a profile without one saves, covered by an e2e row; security-hotfix SH-P16, the same bug, closes with it (PR 53, `33db042`).
- AF-P6 — Resolved 2026-11-04: the price-error clearing that e2e row C2 doubted is proven by a component test of `CourseFormDialog` (an emptied price clears its error and `aria-invalid`), and C2 moved there; the e2e timing cause stays unnamed (quality-engineering QE-U4, `35cc3c4`).
- AF-P2 — Resolved 2026-11-04: the AI bulk create awaits every save and reports a partial save, and both AI handlers clear the busy state in `finally`, covered by `__tests__/unit/ai-exercises.test.ts` (PR 60, `8384545`).
- AF-P7 — Resolved 2026-11-04: the AF-U6 user forms and their `createUserSchema`-derived schemas accept only the role `user` or `admin` on client and server; a database constraint stays in backlog BL-P14 (PR 63, `c300dbf`).
- AF-P3 — Moved to [backlog](../../backlog/problems.md)
