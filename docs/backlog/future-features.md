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

## BL-F9: AI quiz generation on the DeepSeek API instead of Gemini

- Status: Deferred (Owner decision, 2026-11-01: no renewed Gemini key; replaces the Owner action in security-hotfix SH-P24).
- Direction: move `generateQuizFromContent` (`app/action/gemini.ts`, called from `app/admin/lessons/page.tsx`) from `@google/genai` and `gemini-3-flash-preview` to DeepSeek's official API with the model `deepseek-flash` (V4.1 Flash), called with `fetch` on its OpenAI-compatible endpoint `https://api.deepseek.com`, so no new package. The JSON output mode returns an object, so the prompt asks for `{"questions": [...]}` and the parser reads that array; keep `requireAdmin()`, the 50-character minimum and the error logging. Rename the key variable in `__tests__/helpers/dev-env.ts` (`AI_KEY_VARIABLE`) and `__tests__/helpers/e2e-env.ts`, remove `@google/genai` (it also drops the `gaxios` chain of dependency-maintenance DM-P1 group A), and the Owner sets the new key in Vercel. Options checked on 2026-11-01 and not chosen: OpenCode Zen's free `deepseek-v4.1-flash-free` is allowed only inside OpenCode ("Free-tier chat models require OpenCode", opencode.ai/docs/zen); the OpenCode Go key reaches DeepSeek V4.1 Flash but the plan is "designed for OpenCode and other coding agents" (opencode.ai/docs/go) and has no Gemini 3.8 Flash; Gemini's free tier still needs a Gemini key. Cost at the official prices ($0.30 input and $1.20 output per 1M tokens at peak, half off-peak) is about $0.005 per generation; lesson content goes to DeepSeek's servers, no user data. No test calls the AI, so the change needs a manual AI Magic pass with the real key. It changes an admin server action, so size it as medium work (`docs/agent-loops.md`, Sizing).
- Target program: none yet (backlog; a short plan in chat, `server-actions`).


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
