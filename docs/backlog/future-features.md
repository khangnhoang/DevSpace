# Future features — backlog

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan.

## BL-F4: Images for the seed courses

- Status: Deferred (Owner decision, agent-workflow U4 D7, 2026-10-25).
- Direction: give the seed courses invented images so the local stack shows them: image files in the repo uploaded on start through `[storage.buckets.<name>] objects_path` in `supabase/config.toml` (or into a bucket the baseline already has, such as `avatars`), and seed `image_url` values pointing at them (`supabase/seed.sql:39-41` sets none today). The bucket the code uploads to already exists (`supabase/migrations/20261021000000_baseline.sql:1420`), so no migration is needed for it. Also note that the local home page fetches an external placeholder image (`placehold.co`) through `/_next/image`; seed images remove that fetch. `db reset`, `npm test` and `npm run test:e2e` stay green (`test-quality-strategy`, Test data).
- Target program: none yet (backlog; small task).

## BL-F9: AI quiz generation on the DeepSeek API instead of Gemini

- Status: Deferred (Owner decision, 2026-11-01: no renewed Gemini key; replaces the Owner action in security-hotfix SH-P24).
- Direction: move `generateQuizFromContent` (`app/action/gemini.ts`, called from `app/admin/lessons/page.tsx`) from `@google/genai` and `gemini-3-flash-preview` to DeepSeek's official API with the model `deepseek-flash` (V4.1 Flash), called with `fetch` on its OpenAI-compatible endpoint `https://api.deepseek.com`, so no new package. The JSON output mode returns an object, so the prompt asks for `{"questions": [...]}` and the parser reads that array; keep `requireAdmin()`, the 50-character minimum and the error logging. Rename the key variable in `__tests__/helpers/dev-env.ts` (`AI_KEY_VARIABLE`) and `__tests__/helpers/e2e-env.ts`, remove `@google/genai` (it also drops the `gaxios` chain of dependency-maintenance DM-P1 group A), and the Owner sets the new key in Vercel. Options checked on 2026-11-01 and not chosen: OpenCode Zen's free `deepseek-v4.1-flash-free` is allowed only inside OpenCode ("Free-tier chat models require OpenCode", opencode.ai/docs/zen); the OpenCode Go key reaches DeepSeek V4.1 Flash but the plan is "designed for OpenCode and other coding agents" (opencode.ai/docs/go) and has no Gemini 3.8 Flash; Gemini's free tier still needs a Gemini key. Cost at the official prices ($0.30 input and $1.20 output per 1M tokens at peak, half off-peak) is about $0.005 per generation; lesson content goes to DeepSeek's servers, no user data. No test calls the AI, so the change needs a manual AI Magic pass with the real key. It changes an admin server action, so size it as medium work (`docs/agent-loops.md`, Sizing).
- Target program: none yet (backlog; a short plan in chat, `server-actions`).

## BL-F11: Schema review for the techstack migration

- Status: Deferred (Owner, 2026-11-03, while reviewing UX-U1; a list to settle when the techstack migration designs its schema).
- Direction: items the Owner noted, each checked on the dev stack (`1c689ba` schema) on 2026-11-03:
  - Enumerated values are plain `text` with no constraint: `profiles.gender`, `profiles.role` and `payments.status`; only `notifications.type` and `reviews.rating` have a check. `role` decides admin rights, so a check constraint on it is worth doing earlier than the migration, and `payments.status` belongs with security-hotfix H2-2b, which rewrites the payment actions.
  - Payment states beyond `pending`, `success` and `failed` (for example paid, expired, cancelled), as a business decision with the payment rewrite, not only a column type.
  - `instructors` could fold into `profiles` as nullable `bio` and `job_title`; keeping it is also acceptable.
  - `user_progress.completed_at` is accurate (a row is a completed lesson) but differs from the `created_at` used elsewhere; rename only inside the migration.
  - Soft delete and `updated_at`: only `comments` has `deleted_at`, and only `comments` and `payments` have `updated_at`; `notes`, `lessons`, `chapters`, `courses` and `exercises` have neither, so an edit leaves no time and a delete is permanent.
  - `lessons.has_video` and `lessons.word_count` are generated columns from security-hotfix H2-1a (P13): `content` and `video_url` are not readable by every caller, so the public course outline uses them for the video icon and the duration estimate (`estimateTime`: 10 minutes for any video lesson, else 200 words per minute). They are deliberate; the gap is that a video's real length is not stored, so a stored duration could replace the fixed 10 minutes.
  - Identifiers: `profiles.id` is a `uuid` because it is `auth.users.id`; every other table uses `bigint` identity. This is the usual Supabase shape and only needs a decision if the new backend changes auth.
  - `notifications`: the only writer is `app/action/enroll.ts` (`sendAdminNotification`), application code with no trigger, which notifies every admin of a free-course enrollment and swallows an insert error; a paid enrollment approved in `payment.ts` sends only an email, and no code notifies a learner, whose header has no bell. `title` is a fixed sentence per kind and `type` is written but never read (the admin bell in `HeaderAdmin.tsx` shows `title`, `message` and `link`). Direction for the migration: one notification service in the backend that every event calls (enrollment, payment approved, a reply to a comment); `type` names the event, the UI derives title, icon and link from `type` and a reference payload (for example `data jsonb` with `course_id` or `comment_id`), so `title`, the stored text and the stored link can go. A state such as an incomplete profile is computed when shown, not stored as a notification. A learner bell and reply notifications are new features of that work, not schema fixes.
  - User deletion (Owner, 2026-11-07, while planning security-engineering SE-U1): `payments` and `enrollments` reference `auth.users` with `on delete cascade`, so `deleteUserAccount` (`auth.admin.deleteUser`) erases a user's order and enrollment history and revenue figures with it. Direction: soft-delete users instead, so payments and enrollments stay readable after the account is deleted and the figures stay correct; decide the foreign keys that replace the cascades, whether a deleted user can sign in, and how their personal data is removed or masked. Done during or right after the NestJS migration, not before it; SE-U1's release of a deleted pending order's coupon use then only guards direct deletes.
  - Coupon reservation against overselling is already decided in security-hotfix `plan-h2.md` (D1, B12, B13) and is not part of this entry.
- Target program: the techstack migration (not opened yet); the `role` and `payments.status` checks may move earlier with security-hotfix H2-2b.

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
