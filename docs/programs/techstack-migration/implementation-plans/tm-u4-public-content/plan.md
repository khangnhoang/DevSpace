# TM-U4 detail plan — Public content and Try It

Revision: r1, 2026-11-09. Owner approval: 2026-11-09. Master plan or charter: [plan.md](../../plan.md).

This revision plans the first slice only: the home page course list (master plan decisions 12 and 13). The sizing reason for a slice: decision 12 measures this page before anything else moves, and the Owner reads one complete request flow locally before the pattern repeats (decision 14). The rest of TM-U4 (course page reads, reviews read, Header search with TM-P13, Try It with TM-P11 and the Owner's C++ runner choice) is planned in a later revision of this file.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the public home page gets its course list from `GET /api/courses/home` through the server helper, the look and the filters stay as they are, and the time until the list is visible is measured on production before and after the switch.

| ID | Observable result |
| --- | --- |
| AC1 | A caller with no session sends `GET /api/courses/home` and gets 200 with a JSON array ordered by course `id`; each item has exactly the keys `id`, `name`, `slug`, `description`, `image_url`, `price`, `firstLessonSlug`. |
| AC2 | `firstLessonSlug` is the slug of the course's lesson with the lowest `lessons.id`, and `null` for a course with no lesson (today's rule, unchanged). |
| AC3 | With the database unreachable the route answers 503 with no detail. |
| AC4 | The set of public routes of the production build is exactly `/api/health`, `/api/health/db` and `/api/courses/home`. |
| AC5 | `devspace_api` can select only `courses (id, name, slug, description, image_url, price)` and `lessons (id, slug, course_id)` beyond its TM-U3 grants. It is refused on every other column of those tables (`lessons.content` and `lessons.video_url` named in a row) and on every write. The rollback restores the TM-U3 grants exactly. |
| AC6 | An anonymous visitor opens `/` and sees the seed courses; the API records one `GET /api/courses/home` for that render, and the browser sends no request to the Data API for the course list. |
| AC7 | The search box, the free/paid filter, the count, the empty text, the three hero slides and the two most expensive featured courses behave as they do at the baseline. |
| AC8 | While the list is being fetched, the visitor sees the banner and six card skeletons of today. |
| AC9 | When the API fails or cannot be reached, `/` still renders with the text "Không tìm thấy khóa học nào.", as a failed read does today, and the server log names the failure with no response body or cookie. |
| AC10 | The p95 time until the first course card is visible, measured on production by the same script before and after the frontend switch, grows by at most 200 ms. If it grows more, caching this public read is tried first, then the Owner decides under ADR 0008 D11. |

### 1.2 Scope and non-goals

- In scope: a grant migration and its rollback; a `courses` API module with the one public route; the home page as a Server Component with its interactive part in a client component; removing `getDashboardData`, which this move leaves unused; tests; the instruction lines this change makes false; the `progress.md` catch-up from PR 84 and this unit's State.
- Stays on the Data API until a later slice of this unit: `searchLesson` (Header), `getLessonsByCourse`, the course page and review reads. Until TM-U5, TM-U6 and TM-U8: `getUserDashboardData`, `getAdminCourseData`, the protected lesson reads and every write on these tables.
- Non-goals: a restrictive migration (course rows are public by design, and the operations above still use the Data API, so this slice has no door to close); caching, unless AC10 needs it; visual changes; TM-P11, TM-P12 and TM-P13.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The response is built from a named column list and sends no lesson rows. | `devspace_api` has `BYPASSRLS`, so its query and grants are the whole boundary; a wider select fails on the column grants or leaks lesson data to a public route. |
| G2. The grant names columns, never a table. | A table-level `SELECT` would give the API `lessons.content` and `lessons.video_url` (`supabase-migration`, trap 3), which TM-U5 protects. |
| G3. The migration applies and its postflight passes before PR 1 merges, and Railway answers before PR 2 merges. | The endpoint fails on its first production read, or the frontend calls an endpoint that is not live (ADR 0008, steps A to C). |
| G4. The baseline measurement runs before PR 2 merges. | The baseline is lost, and decision 12 cannot be answered. |
| G5. The `api-role` replay rows keep proving their cases against the new grants. | Replaying the TM-U3 migration now stops on the new grants, and `drop role` in its rollback fails while they exist; a row that is loosened to pass proves nothing. |

### 1.4 Owner decisions that bind this unit

- Master plan decisions 9 to 14. Decision 11: a short plan and Main's review; Codex reviews the diff of the grant migration, and its Required findings are corrected and re-checked. Decision 12: AC10. Decision 14: agents implement and the Owner reads the request flow afterwards.
- Accepted look change for approval: the search box, the filter and the count appear with the list instead of showing "0 khóa học chất lượng" during the wait, because they move into the client component that holds the data.

## 2. Repository facts

Baseline: `032f823`, checked 2026-11-09.

- `app/(main)/page.tsx` is `"use client"` and is the only caller of `getDashboardData` (`lib/supabase.ts:203`), which reads courses and lessons from the browser and returns `[]` on an error — justifies the slice, AC6 and AC9.
- The first lesson is picked by `lessons.id`, not by `order_index` — AC2.
- `courses.price` is `integer` and the ids are `bigint` in `mode: "number"`, so the JSON types match what PostgREST sends — AC1.
- `courses` and `lessons` have the policies "Public view courses" and "Public view lessons" with `USING (true)`, so `BYPASSRLS` exposes no extra row; anon has column grants on `lessons` without `content` and `video_url` (H2-1 B) — AC5, G1, G2.
- `devspace_api` holds only `USAGE` on `public` and `SELECT (id, role)` on `profiles` — AC5.
- `SessionGuard` returns before reading a token on a `@Public()` route, so the helper's forwarded cookie cannot refuse this route — AC1.
- `apiFetch` uses `cache: "no-store"` and reads `cookies()`, so the page stays dynamic and an admin's edit shows on the next load, as today — no helper change is needed unless AC10 fails.
- `__tests__/rls/api-role.test.ts` asserts the exact column list (API-R4) and that `courses` is refused (API-R3). API-R5 to R10 replay the TM-U3 migration or rollback on the committed state, so with the new grants present the "stops" rows could pass for the wrong reason and the others fail; the API-R7 "another table" case uses `courses` — G5.
- `__tests__/api/guards.test.ts` pins the public route set at the two health routes — AC4.
- No e2e row covers the page's own search or filter; `[S9]` covers the Header search only — AC7 needs component rows.
- No `loading.tsx` exists under `app/`, and one in `app/(main)/` would also wrap the course, learn and profile pages — AC8 uses a `Suspense` boundary in the page.
- A push to `main` builds both Railway and Vercel with no order between them (ADR 0008, Consequences) — two PRs, G3.

## 3. Bounded implementation hypotheses

Each may change while the Spec and guardrails hold.

- Migration `<timestamp>_tm_u4_api_home_course_read.sql` and its `.down.sql`: column grants only; the header cites TM-U4 and ADR 0008 D7 and states that it is additive and applied before PR 1 merges.
- `backend/src/courses/` (`courses.module.ts`, `courses.controller.ts`, `courses.service.ts`), with one Drizzle query that selects the named course columns and the first lesson slug. No input, so no `ZodPipe`.
- `lib/courses.server.ts`: `getHomeCourses()` calls `apiFetch("/api/courses/home")` and maps every failure to `[]` with a server log (AC9).
- `app/(main)/page.tsx` renders a `Suspense` boundary around an async component that awaits the helper. `app/(main)/_components/HomeCourseBrowser.tsx` holds the hero, toolbar, grid and featured block; `HomeSkeleton.tsx` holds today's skeletons.
- `scripts/api/measure-home.mjs`: anonymous Chromium with an empty cache per sample, 3 batches of 20 samples at least one minute apart, time from navigation start until the first grid card heading is visible, printing p50 and p95. It ships in PR 1 so both runs use the same code, and the next TM-U4 PR removes it after the after-measurement.
- API rows in `__tests__/api/courses.test.ts`, with a course without lessons as an owned fixture; `HomeCourseBrowser.test.tsx` for AC7; a new row beside `[S1]` in `public.spec.ts` that reads the API request record (`api.jsonl`) for AC6; AC9 in a unit row beside `__tests__/unit/api-server-helper.test.ts` with the API call faked, because Playwright cannot intercept a server-side request.
- Instruction lines to correct: the "Database" bullet of `server-actions`, the code map in `AGENTS.md` and the comment "The only public routes" in `health.controller.ts`.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 (PR 1) | Migration, rollback, API route, measure script, AC1 to AC5, instruction lines, `progress.md` catch-up | `npm test`, each new guard or grant row proven by a mutation; `npm run typecheck:api`, `npm run lint:api`, `npm run build:api`, `npm run api:schema:check` (no schema change expected), `npm run docs:check`; Codex on the migration diff |
| CP2 (PR 2) | Server page, client browser, skeleton, helper, `getDashboardData` removed, AC6 to AC9 | `npm run test:unit`, `npm run test:e2e` on `public.spec.ts`, `npx tsc --noEmit`, `npm run lint`; a browser pass on the dev stack |
| CP3 | Whole-diff review and final regression, then the Owner reads the flow locally | `npm test`, `npm run test:e2e`, both type checks, both lints, both builds, `npm run docs:check` |

Manual QA after CP2, on `npm run dev` at desktop and 375 px width: the page matches the baseline and the skeleton looks right (perceptual, no automated assertion). Not checkable locally: the production p95 (AC10) and the Railway-to-Sydney read time.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The server read is slower than the browser read (ADR 0008 D11 failed its budget on the rewrite) | The helper does not cross the rewrite; AC10 measures it, and caching is the prepared next step |
| A paused Supabase project or a stopped API blanks the list | AC9 keeps the page up; the TM-U3 uptime monitors alert the Owner |
| The API hangs without answering | No timeout is added here: the skeleton stays until the platform's function limit, as the browser read could hang today; AC9 covers a failure that returns |
| An error looks like "no courses" | Existing behavior, kept on purpose under the master plan's same-behavior invariant; the server log tells them apart |

- Rollout runbook, each step under its own Owner grant:
  1. After CP3 and the Codex pass: a fresh backup taken by the Owner and `npm run backup:check` passing on it.
  2. Main: prepare and apply the migration (`supabase-migration`, Hosted apply), then a catalog postflight of the `devspace_api` grants.
  3. Merge PR 1 (step A).
  4. Main checks that `/api/health` reports the PR 1 commit and that `/api/courses/home` answers with the course list on production (step B).
  5. Main runs the baseline with the measure script on the Owner's machine, against the page still on the old path.
  6. Merge PR 2 (step C). The Owner smoke-checks the home page. Main runs the after-measurement in the same part of the day and records both results in `progress.md`.
- Stop when: the dry run lists anything but this migration; step B fails; AC10 fails after caching was tried (the Owner decides); a replay row cannot prove its case without weakening it.
- Rollback: before step C, redeploy the previous Railway deployment; the frontend does not call the route yet. After step C, roll the frontend back first, confirm it is live, then the API. The grant rollback runs only after every code version that reads these columns is gone. There is no step D in this slice.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
