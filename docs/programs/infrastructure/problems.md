# Problems, risks and follow-ups — infrastructure

Plan: [plan.md](plan.md). Progress: [progress.md](progress.md).

## Open

### INF-002: seeded quiz answers never match

- Status: Open (2026-10-25).
- Problem: `supabase/seed.sql` stores `correct_answer` `A`, `B` and `C` for exercises 1 to 3, while the admin form writes `a` to `d` and `Quiz.tsx:83` compares the selected lowercase option value exactly, so no answer to a seeded quiz is ever accepted on the local stack and in CI.
- Evidence: `supabase/seed.sql` exercises rows; `app/admin/lessons/page.tsx` (the `a` to `d` values); `app/components/Quiz.tsx:83` and `:149`; found while planning the U6 manual pass, which sets lowercase answers in a temporary fixture. The U6 manual pass (M9) also showed the admin edit form opening exercise 3 with an empty correct-answer select.
- Direction: change the three seed rows to lowercase in a later infrastructure unit (U6 changes no seed, G6); whether hosted data mixes cases is a separate read-only check.
- Exit condition: the seeded quizzes on `bien-va-kieu-du-lieu` and `cau-truc-mot-trang-html` accept their correct answers after `db reset`.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-001 — Resolved 2026-10-23: the CI job `docs` runs `npm run docs:check` and `npm run docs:check:test` on every pull request and push to `main` (PR 11, run 39821844267).
- INF-001 — Resolved 2026-10-23: `next` and `eslint-config-next` 16.4.3 plus `npm audit fix` took `npm audit --omit=dev` from 17 findings to 5, none critical or high with an in-range fix; the 5 left are in FEAT-001 (PR 16, `1a13906`).
