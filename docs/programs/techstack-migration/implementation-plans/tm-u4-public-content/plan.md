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

## Appendix A — Course detail and public reviews (r2)

Baseline: `a568e98`. Owner approval: 2026-11-10. This appendix defines the next slice. Sections 1–5 above preserve the approved home-page slice.

### Binding Spec

- Move the public reads on `/course/[slug]` together. Preserve the page's appearance and chapter controls. A missing or ambiguous slug gets a 404 from NestJS and the existing missing-course state with a link home. Backend failure returns a generic 503 and the page reports a load failure. Preserve existing slug values through a fixed path and safely encoded query argument; cover a legacy slug containing non-ASCII text and spaces through `apiFetch`. Keep enrollment and payment controls in their loading state until the current caller's checks settle.
- Keep **Xem thêm** and five reviews per page, ordered by `created_at` descending with `id` descending as the tie-breaker. Accept zero-based pages 0–9 and return `hasMore` only when another row exists and the next page is within that bound. Advance only after success. A failed read keeps the current list and page and can be retried. On a successful review submission, refresh page one through the same public read, replacing list, page and `hasMore` together only on success. Ignore older requests after a refresh or course change, including a load-more response still in flight when the write succeeds.
- Leave own-review lookup and writes, enrollment, payment status, resume-learning logic and private learning reads with their existing callers and permissions. Header search is excluded by Owner decision on 2026-11-10. A replacement search and filter page and Try It are separate work. The deferred release gate is [BL-F13](../../../../backlog/future-features.md#bl-f13-gate-frontend-production-promotion-on-api-readiness).

### Evidence and boundaries

- `getFullCourseDetail` in `lib/supabase.ts` has one caller. Its chapter query orders chapters by `order_index` and nested lessons by `id`. It derives duration from `has_video` and `word_count`. It also reads an exercise count that the detail page does not render. Exclude that count from the public contract: exercise rows are restricted by H2-1b. Leave the separate `getLessonsByCourse` helper for protected learning routes.
- Detail payload: course `id, name, slug, description, image_url, price`; instructor `id, bio, job_title` and profile `full_name, avatar_url`; chapters `id, title`; lessons `id, title, slug, type, duration_display`. Preserve the displayed price, lesson count and total duration using the existing rules. Review payload: `id, rating, content, created_at`, author `full_name, avatar_url` and paging metadata. Missing instructor or profile cards remain nullable.
- Required added reads: `courses(instructor_id)`, `chapters(id, course_id, title, order_index)`, `lessons(chapter_id, title, has_video, word_count)`, `instructors(id, user_id, bio, job_title)`, `reviews(id, course_id, user_id, rating, content, created_at)` and `profile_cards(id, full_name, avatar_url)`. Courses, chapters, lessons, instructors and reviews have public SELECT row policies in the baseline, with H2-1b limiting lesson columns. Join/filter keys stay internal unless named in the payload. The role bypasses RLS. Use column grants and project only the listed fields; keep profile roles and private columns, lesson bodies, video URLs, exercises and writes outside the added grants.
- Course slugs are not unique yet (TM-P12). An ambiguous slug must not silently select one course; preserve the existing single-match behavior. Validate slug and pagination inputs at the API boundary without introducing TM-P12's slug format rule.

### PRs and verification

| PR | Delivery | Checks |
| --- | --- | --- |
| Backend | Extend the courses API with public detail and paginated reviews. Add the named column grants and rollback, update the route and grant maps, and remove the completed home benchmark script. | `__tests__/api/courses.test.ts`: anonymous reads, exact payloads, chapter and lesson order, empty reviews, pagination boundaries and equal timestamps, missing or ambiguous slug, invalid input, generic 503. `guards.test.ts`: exact public route set. `__tests__/rls/api-role.test.ts`: effective allowlist, prohibited reads/writes, replay of TM-U3 and home migrations, and rollback restores both prior grant sets. Run API typecheck, lint, build and schema check. |
| Frontend | Switch both public reads on `/course/[slug]`; retire the obsolete detail helper. Read detail through the Next server helper. Preserve the existing interactive client controls. | Extend `public.spec.ts` S10 for real NestJS paging and cover through-Next detail, missing course, absence of the old public Data API requests and retry after an interrupted page request. Extend `learner-forms.spec.ts` F2/F14 to prove the real write is followed by a page-one reload through NestJS. Cover a legacy slug through the helper and stale responses in focused tests. Run frontend typecheck, lint and build. |

- Both final PR regressions run `npm test`, `npm run test:e2e` and `npm run docs:check`. Exercise a full last page without a successor and the page-9 cap with focused paging logic tests, and use the existing owned E2E review fixture for tied timestamps and multi-page behavior. Keep the real 503 assertion in API integration.
- Route paths and pagination wiring are implementation hypotheses. If reviews use the browser rewrite, after the backend deploy measure sequential anonymous reads through the production frontend origin against the 600 ms end-to-end p95 target in ADR 0008 D11. Report the endpoint, sample count, status results and p95. Bring the result to the Owner before switching the frontend if it exceeds the target.
- For visual QA, compare the existing course details and review layout at desktop and 375 px on the dev stack. Use test-stack fixtures for pagination and tied timestamps. After the frontend deploy, the Owner smoke-checks the public route using an existing course, without creating hosted fixtures.
- Before the backend PR merges: Codex reviews the grants and rollback, CI passes, and the Owner takes a fresh backup that Main verifies. Main obtains separate prepare and apply grants and verifies the exact migration and effective privileges before merge. Before the frontend PR merges: Railway health reports the backend merge commit and both public endpoints answer as expected. Keep existing public Data API access for the old frontend and other callers. After the frontend deploy, verify both reads on production. If rolling back, verify the compatible frontend is live before removing endpoints, then verify no deployed API uses the new grants before revoking them.

## Appendix B — Try It C++ runner (r3)

Baseline: `f10c1d5`, checked 2026-11-17. Owner approval: 2026-11-17, after the Codex plan gate passed in round 3. This appendix defines the last slice of TM-U4 and resolves TM-P11. Sections 1–5 and Appendix A above preserve the two approved slices.

Sizing (master plan decision 13): medium, one PR, frontend only. No route, migration, grant, session or payment code changes, so decision 11 asks for a short plan and Main's review of the diff; the Owner asked for the Codex gate on this plan.

### B.1 Binding Spec

Outcome: a visitor runs C++ on `/try_it` and sees the program's result, because the C++ tab sends the code from the browser to Wandbox instead of the Piston API that refuses it; every way a run can fail shows a message and frees the button.

| ID | Observable result |
| --- | --- |
| B-AC1 | A visitor, signed in or not, runs a C++ program and the answer has `status` "0" and an empty `signal`: the console shows the compiler text when there is any (a warning), then the program's standard output, line by line, and the toast "Chạy thành công!" appears. |
| B-AC2 | The answer has any other `status` (the empty string included) or a `signal` that is not empty: the console shows, in this order, the compiler text, the program's standard output and its standard error, each only when it is not empty, and then one closing line that says compiling or running did not succeed and gives the status and the signal when they are not empty; the toast "Có lỗi biên dịch hoặc runtime!" appears. A program that does not compile therefore shows the compiler's message and the closing line, and a segmentation fault, which returns no text, shows the closing line alone. |
| B-AC3 | The closing line of B-AC2 is never cut: when the output is longer than the B-AC7 limit, the cut notice and then the closing line still end the console. The page does not try to tell a compile failure from a run failure, because the answer does not let it: a program that compiles with a warning and returns 1 without printing looks the same as one that does not compile (trial result 2). |
| B-AC4 | Wandbox answers with an HTTP status other than 200, or with a body that is not a JSON object in which `status`, `signal`, `compiler_error`, `program_output` and `program_error` are all strings (a field that is missing or of another type): the console shows one error line that carries the HTTP status and the toast "Server biên dịch không chạy được mã!" appears. For HTTP 429 the line tells the visitor in Vietnamese that they ran code too many times and should wait a few minutes. |
| B-AC5 | No answer arrives within the deadline (30 seconds): the page stops waiting and aborts its request, the console shows one Vietnamese line that says it stopped waiting because the run took too long and suggests checking for an endless loop, an error toast appears and the run button is usable again. A request that fails to connect shows the existing connection error, worded without the name of a provider. |
| B-AC6 | While a C++ run is waiting, the run button is disabled, a second activation before the next render starts no second request, and the console shows "Compiling...". Only the current run may change the console, the toast and the waiting state: when the visitor switches tab during the wait, the request is aborted and the button is usable at once on the new tab; the abandoned run writes nothing and shows no toast, also after the visitor returns to the C++ tab, and when the visitor starts a new run there, the end of the abandoned one neither enables the button nor replaces the new run's console. Leaving the page aborts a pending request. |
| B-AC7 | The console shows at most a fixed number of output lines (1,000) followed by one line that says the rest was cut; shorter output is shown whole. Output is rendered as text, never as markup. |
| B-AC8 | The only request the application sends for a C++ run goes to `https://wandbox.org/api/compile.json` (with the preflight the browser adds), as a POST with `credentials: "omit"` and `referrerPolicy: "no-referrer"` whose JSON body holds exactly the compiler name and the code in the editor. Loading `/try_it` still sends no request off the app's origin, and the HTML and JavaScript tabs run the visitor's code as at the baseline. |
| B-AC9 | No file under `app/`, `lib/` or `__tests__/` names Piston or `emkc.org` any more, and no message the application writes names the provider. |

Scope: `app/(main)/try_it/page.tsx`, its `_lib/` helpers and their tests; the TM-P11 entry; this program's State. No instruction line becomes false: `AGENTS.md`, `README.md` and the skills name `/try_it` only as a route and for its editor files. Non-goals: a NestJS endpoint or any server-side call for running code; standard input, compiler options or a choice of compiler in the UI; any change to the look of the page, to the HTML and JavaScript tabs, to `lib/try-it.ts` or to the lesson "Thử ngay" links; a second provider or an automatic fallback; other languages.

| Guardrail | Failure if omitted |
| --- | --- |
| B-G1. The call is made by the visitor's browser, never by Next or NestJS. | The one non-browser client tried was refused by Wandbox's front end (trial result 3), and requests are limited per IP (trial result 4): a server-side call risks failing outright and would share one limit among all visitors. |
| B-G2. Every path out of the current run (answer, refusal, deadline, abort, thrown error) ends the waiting state, and a run that is no longer current changes nothing. | An endless loop keeps the request open past 38 seconds (trial result 5); with the one button disabled on every tab, the visitor could run nothing until a reload. Without the second half, the late end of an abandoned run frees the button or overwrites the console of the run that replaced it. |
| B-G3. The result is read from the fields B-AC4 names with a type check on each; a missing or wrongly typed field is the B-AC4 case, and an empty `status` string is the B-AC2 case, never an empty success. | TM-P11 itself: an answer the code did not expect showed nothing. |
| B-G4. The application puts nothing but the editor's code and the compiler name into the request: no cookie, session token, user id or page URL in the body, the headers it sets or the referrer. | The code crosses to a third party with no agreement; an identifier the application added would tie it to an account. What the browser and the network reveal by themselves (B-D2) is outside this guardrail. |
| B-G5. The interpreting logic stays in a `_lib/` module with no React, Next or Supabase import, and the request function takes its `fetch` as a parameter. | The unit tests could not reach the rules without a DOM or a network (`frontend-workflow`, route-private files). |

Owner decisions that bind this slice, taken with the approval of this appendix on 2026-11-17:

- B-D1. The C++ runner is Wandbox (`wandbox.org`), called straight from the browser with no key. Its FAQ allows use for lectures and commercial use, warns of per-IP limits and promises no SLA. The alternatives from the Owner's research (OneCompiler or JDoodle behind a NestJS endpoint with a key, a quota and a rate limit; Judge0) are not built.
- B-D2. The visitor's code is sent to that third party, which the Owner does not control and which may keep it. A direct call also shows that party what any website sees: the visitor's IP address, the browser's user agent and the `Origin` of DevSpace. No notice is added to the page.
- B-D3. The compiler is pinned to `gcc-13.2.0` (Piston ran GCC 10.2.0). When Wandbox retires that name every run shows the B-AC4 error until the constant is changed; this is accepted instead of reading the compiler list at run time.
- B-D4. When Wandbox is down, limited or gone, the C++ tab shows the error and nothing else changes. A replacement provider is a new Owner decision then, not part of this slice.
- B-D5. This slice moves no data operation to NestJS: the master plan's TM-U4 row asks only for "a C++ runner the detail plan chooses", and Outcome 1 covers application data operations, which a code run is not.

### B.2 Repository facts and trial results

Repository facts, at the baseline:

1. `app/(main)/try_it/page.tsx:122-148` posts `{ language, version, files }` to `https://emkc.org/api/v2/piston/execute` and reads the answer with `interpretPistonResponse` (`_lib/piston-result.ts`), which already maps a refusal to an error line; the Piston API answers 401 to everyone (TM-P11) — justifies the slice and B-AC9. The catch branch prints "Lỗi: Không thể kết nối đến server Piston API." — B-AC5.
2. `handleRunCode` sets `isRunning` for all three languages and one button serves all tabs (`page.tsx:79-82`, `:182-194`); `switchLanguage` clears the console but does not stop a pending request (`:67-77`) — B-AC6, B-G2.
3. The console renders each line as a text child of a `div` (`page.tsx:241-245`) — B-AC7.
4. `__tests__/unit/piston-result.test.ts` holds the rows of the current interpreter; no component test of the page exists; `public.spec.ts` `[S5]` asserts that loading `/try_it` sends no request off the app's origin, and the e2e network guard aborts any request to a non-local host (`test-quality-strategy`, End-to-end) — justifies the test allocation in B.4.
5. The app sets no Content-Security-Policy (`next.config.*` and `proxy.ts` hold no such header) — a cross-origin `fetch` from the page is not blocked by the app.
6. `lib/try-it.ts` and `app/components/PreBlock.tsx` only build the `/try_it?lang=&code=` link — unchanged by this slice.

Trial results, 2026-11-17 (the feasibility check of this slice, `planning` step 10). Method: `fetch` from the page `https://devspace-lms.vercel.app/try_it` in Chromium, so the real origin and the real CORS path; invented sample programs only. Evidence kind: manual, live provider; Wandbox may change any of it.

1. The preflight for a JSON POST answers 204 with `Access-Control-Allow-Origin: *`; eleven POSTs from the production origin were answered — B-D1, B-G1.
2. An answered run returns HTTP 200 and a JSON object of strings: `status`, `signal`, `compiler_output`, `compiler_error`, `compiler_message`, `program_output`, `program_error`, `program_message`. Observed: success `status "0"` with the output in `program_output`; compile error `status "1"` with the text in `compiler_error` and empty program fields; an uncaught exception `status "134"` with `program_output` and `program_error` both filled; `return 3` `status "3"`; a null dereference `status "139"` with every text field empty; a program that prints without end returned after 15.9 s with `program_output` cut at 131,072 characters and an empty `status`; a program that reads standard input gets none and runs on; UTF-8 output arrives intact — B-AC1 to B-AC3, B-AC7, B-G3.
3. The same POST from a non-browser client (Python `urllib`) is refused with HTTP 403 and the text "error code: 1010" by the service's front end — B-G1.
4. After eleven requests in about a minute the next three got HTTP 429 with the plain text "Error: Too many requests"; requests succeeded again a few minutes later — B-AC4. An unknown compiler name gets HTTP 500 with plain text, a body without `code` gets HTTP 422 with plain text — B-AC4, B-D3.
5. `int main() { for(;;){} }` got no answer within 38 seconds, when the trial aborted it; the service's own limit was not found — B-AC5, B-G2.
6. Ordinary runs took 2.1 to 5.2 seconds — context for "Compiling..." and the deadline.

Not established: Wandbox's exact limits (requests per IP, run time), whether it stores submitted code, and its behavior from a shared campus address.

### B.3 Bounded implementation hypotheses

Each may change while B.1 holds.

- `_lib/piston-result.ts` becomes `_lib/wandbox-result.ts`: `interpretWandboxResponse(status, ok, body)` returns the lines and one of the three existing outcomes, and applies the B-AC7 cap; `__tests__/unit/piston-result.test.ts` is renamed with it.
- A `_lib/run-cpp.ts` function takes the code, a `fetch` and an `AbortSignal`, sends the B-AC8 request and returns the display, mapping a deadline, an abort and a thrown error to their own results.
- A run is current while its token (a counter or its controller, held in a ref) is the latest; the handler checks it synchronously before the request and again before every state update after an `await`.
- The page keeps one `AbortController` in a ref for the pending run: `switchLanguage` and unmount abort it; the deadline is `AbortSignal.timeout` combined with it, or a timer.
- The compiler name, the deadline and the line cap are named constants in `_lib/`.
- Suggested wording of the new lines, which the implementor may improve under `frontend-design` (natural Vietnamese): "Biên dịch hoặc chạy không thành công (mã thoát 139).", "Lỗi: Bạn đã chạy mã quá nhiều lần. Vui lòng thử lại sau ít phút. (HTTP 429)", "Lỗi: Đã ngừng chờ kết quả vì chương trình chạy quá lâu. Hãy kiểm tra xem có vòng lặp vô hạn không.", "… (đã cắt bớt phần còn lại của kết quả)", "Lỗi: Không thể kết nối đến server biên dịch."

### B.4 Checkpoints and verification

| CP | Outcome | Verification |
| --- | --- | --- |
| B-CP1 | The interpreter, the request function, the page wiring and their tests (B-AC1 to B-AC9) | `npm run test:unit`, each new row proven by a mutation; `npx tsc --noEmit`, `npm run lint`, `npm run format:check` on the changed files; `npm run test:e2e -- public` for `[S5]` and `[S5b]` |
| B-CP2 | Whole-diff review, TM-P11 set to `Fixed locally, awaiting delivery` (it is resolved only after the production check), State updated, final regression | `npm test`, `npm run test:e2e`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run docs:check` |

| Guarantee | Layer and place | Assertion |
| --- | --- | --- |
| B-AC1 to B-AC4, B-AC7, B-G3 | unit, `__tests__/unit/wandbox-result.test.ts` | One row per observed answer of trial results 2 and 4, fed the captured field shapes, asserting the exact lines, their order and the outcome: success; success with compiler text; compile failure; compiler text with a non-zero status and no program text; status 134 with both program fields; status 139 with no text; a `signal` that is not empty; `status` "" (B-AC2) and, as separate rows, a missing `status` and a non-string field (B-AC4); a non-JSON body; exactly 1,000 lines uncut, and 1,001 lines with a failing status ending in the cut notice and then the closing line; the 429 wording |
| B-AC5, B-AC8, B-G4 | unit, beside it, with `fetch` faked as the external boundary | The URL, method, `credentials: "omit"`, `referrerPolicy: "no-referrer"`, the headers set and the exact body keys; a deadline, a rejected `fetch` and an abort each return their own result |
| B-AC5, B-AC6, B-G2 | component, `__tests__/unit/components/TryItPage.test.tsx`, with `@monaco-editor/react`, `next/navigation`, `sonner` and the global `fetch` replaced; the handler and the `_lib/` helpers run for real | With a held `fetch`: button disabled and "Compiling..." while pending, and two activations in one tick send one request. Each way out enables the button and shows its line and toast: a success, a failed run (HTTP 200 with `status` "1" and compiler text: the compiler text, the closing line and the toast "Có lỗi biên dịch hoặc runtime!"), a refusal (429), a rejected `fetch`, the deadline (fake timers). A tab switch aborts the signal and enables the button; the late end of that run adds no line and no toast after returning to C++. Run A, switch away, return and start run B: when A ends (resolved and rejected variants), the button stays disabled and B's console is untouched; when B resolves, its output shows. Unmount aborts the pending signal. One mutation per row (remove the current-run check, the synchronous guard, the abort on switch, the unmount cleanup, the deadline, the toast of each outcome) |
| B-AC8 (page load), HTML and JavaScript tabs | e2e, the existing `/try_it` rows of `public.spec.ts` (`[S5]` and `[S5b]` for the load, `[S7]` and `[S8]` for running the HTML and JavaScript tabs) | Unchanged rows keep passing |
| B-AC9 | command | `git grep -i -E "piston|emkc" -- app lib __tests__` returns nothing |

No e2e row runs C++: the network guard aborts the request to `wandbox.org`, and a row that fulfilled it with `page.route` would assert only client logic that the component rows already cover (`test-quality-strategy`, E2E rule).

Residual manual QA, each because it needs the live provider or perceptual judgment:

- Main, on `npm run dev` in the browser pane, before the PR, at desktop width since the page blocks mobile. Live provider (the answer shapes of B.2 are a snapshot that only a real call confirms): the default example, a compile error, a null dereference, an endless loop (the deadline line), an endless print (the cut notice and the closing line). Wiring that no automated row reaches: a lesson's C++ block opened through "Thử ngay". Real request (B-G4 cannot be proven with a faked `fetch`): Main reads the C++ request in the network panel and reports its credentials mode, its referrer and its body keys. Perceptual: the new lines read naturally in the console.
- The Owner, on production after the deploy: one successful run and one compile error.

Not checkable on demand: the 429 path without spending the limit of the tester's own address; it is covered by the unit row and by trial result 4.

### B.5 Risks, rollout and rollback

| Risk | Impact | Mitigation and earliest exposure |
| --- | --- | --- |
| Wandbox is down, changes its answer or starts challenging browsers | C++ runs fail for everyone | Every failure shows a message (B-AC4, B-AC5, B-G3); B-D4; exposed by Main's manual pass and the production QA, and afterwards only by a visitor's report, because no monitor watches a third party |
| Many learners behind one address (a campus network) hit the per-IP limit | 429 for that group | The B-AC4 wording tells them to wait; the limit is not known (B.2); a server-side provider is the Owner's later choice (B-D4) |
| The pinned compiler is retired | Every run shows the B-AC4 error | B-D3; one constant to change |
| A visitor pastes private text into the editor | It reaches a third party | B-D2, B-G4; the page is a practice editor and sends nothing by itself |
| The deadline cuts a slow but valid program | A false "took too long" | 30 seconds against 2.1 to 5.2 seconds observed for ordinary runs and 15.9 seconds for the heaviest answered one |

- Rollout, each step under its own Owner grant: implementation by a separate implementor session with local commits per checkpoint; Main's review and manual pass; push and PR; CI; merge; the Owner's production check; then Main records TM-P11 as resolved with the PR and updates State, which completes TM-U4.
- No hosted database step, no environment variable and no Railway change. Vercel deploys on merge as usual.
- Stop when: the trial results no longer hold when the implementor or Main repeats a run (the answer shape, CORS); a guarantee would need a server-side call; the component test cannot hold the page without replacing its own logic.
- Rollback: revert the PR. The C++ tab then shows the Piston refusal as an error again, as today; nothing else depends on this slice.
