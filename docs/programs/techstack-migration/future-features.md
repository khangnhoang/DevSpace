# Future features — techstack-migration

Direction the Owner has set. The entries below moved here on 2026-11-08 (Owner decision 5 in the plan) and are in this program's scope: the owning unit of each is named in the plan's Units table, and an entry closes as `Done` when that unit delivers it.

## TM-F1: Self-service password change for signed-in users

- Status: Deferred (2026-11-05, raised by the Owner while reviewing SE-U2); moved from SE-F1 (security-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Direction: Add an account-settings entry point where a signed-in user supplies the current password, a new password and its confirmation. Enforce current-password verification at the Auth API and provide a link to the existing forgot-password flow when the user cannot supply it. The app currently has a recovery page only. SE-P1 and [SE-U2](../security-engineering/implementation-plans/se-u2-password-recovery/plan.md) protect that recovery flow and the Auth boundary; the new account-settings interface is a separate feature. Schedule under the roadmap when the Owner selects it.
- Target program: techstack-migration (TM-U9).

## TM-F2: Admins only reset another user's avatar to the default

- Status: Planned (2026-11-07, requested by the Owner after SE-U4 production QA; the Owner decided on 2026-11-07 to do it in the techstack migration): outstanding work that must be done, not dropped. List it whenever the Owner asks what work remains; moved from SE-F2 (security-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Direction: The admin user form stops uploading or replacing another account's avatar; an admin may only reset it to the default avatar, and each user changes their own avatar from their profile. SE-U4 kept the admin exemption in the `avatars` Storage policies (Owner decision D4) because the admin user form and course images still write there; once the admin user form no longer uploads, the exemption can narrow to what course images need. It also removes the upload-before-create path behind TM-P10.
- Target program: techstack-migration (TM-U8).

## TM-F3: Accounts created by an admin get a password the admin never knows

- Status: Planned (2026-11-07, requested by the Owner after SE-U4 production QA; the Owner decided on 2026-11-07 to do it in the techstack migration): outstanding work that must be done, not dropped. List it whenever the Owner asks what work remains; moved from SE-F3 (security-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Direction: Today the admin types the new account's password in the create form (`app/admin/users/_components/UserFormDialog.tsx`, `createNewUser` in `app/action/user.ts`), so the admin knows it. Replace this so the admin never sees a password: either send the new user an invite or set-password link from Supabase Auth (preferred, no password travels by mail), or generate a random password of at least 8 characters on the server and mail it, requiring a change at first sign-in. One shared password for every new account is rejected: anyone who learns it can sign in to any account that has not changed it.
- Target program: techstack-migration (TM-U9).

## TM-F4: Schema review for the techstack migration

- Status: Deferred (Owner, 2026-11-03, while reviewing UX-U1; a list to settle when the techstack migration designs its schema); moved from BL-F11 (the backlog) on 2026-11-08, techstack-migration Owner decision 5.
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
- Target program: techstack-migration (TM-U12; the notification items without new tables in TM-U6). The `profiles.role` check was delivered by security-engineering SE-U3 (SE-P7, PR #69).

## TM-F5: Assert mail content through a local Mailpit

- Status: Recorded 2026-11-01 by the Owner; deferred until its own initiative is approved; absorbs QE-F6 (from BL-F5: local mail into the local stack's mail sink, Owner, agent-workflow U4, 2026-10-25), transferred on 2026-11-01; moved from QE-F4 (quality-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Direction:
  - Today the app sends one mail: the course activation mail from `app/action/payment.ts:293` through `lib/email.server.ts`, whose nodemailer transport is fixed to `service: "gmail"`. E2E replaces `sendMail` with a record of recipient and subject only (`__tests__/e2e/server-mail.cjs`), so no test reads the body or its link. Backlog BL-P6 and BL-P7 are both content defects that such a test would catch.
  - Make the transport configurable by environment (SMTP host and port), then point the test stack at Supabase's local mail server (`[local_smtp]`, Mailpit; disabled today in `supabase/config.toml`). E2E reads the delivered mail through Mailpit's API and asserts the recipient, the rendered name and the action link. The local mail server stays inside the network guard's local hosts.
  - Enable Mailpit only on the stack that needs it (the QE-P2 direction). Plan it when a new mail flow arrives (password reset, auth confirmations) or together with the NestJS mail module. ADR 0001 replaces the current server-action mail path, so build no mail infrastructure the migration discards.
  - From QE-F6 (BL-F5): `npm run dev` sends with Gmail placeholders, so a send fails and is only logged (`app/action/payment.ts:293` ignores the result). Route dev mail into the same local mail server (an SMTP port exposed), with the SMTP host set in `__tests__/helpers/dev-env.ts`, so a manual pass can read the mail. Hosted mail stays Gmail.
  - Real provider delivery (Gmail) stays out of scope, as QE-F2 says.
- Target program: techstack-migration (TM-U7).

## TM-F6: Harness hook that blocks dangerous database commands

- Status: Fixed locally, awaiting delivery (TM-U1: the hook asks the Owner instead of refusing, Owner decision 11, and also covers the Supabase MCP write tools); recorded 2026-11-01 by the Owner (QE-U3 planning); moved from AW-F5 (agent-workflow) on 2026-11-08, techstack-migration Owner decision 5.
- Direction: a Claude `PreToolUse` hook in `.claude/settings.json` refuses, before it runs:
  - a `supabase` command with `--linked`, `db push`, `link`, `--db-url` or `migration repair`;
  - `db reset` without the test-stack `--workdir`;
  - `psql` to a host other than `127.0.0.1`.
  It complements the identity check in the QE-U3 test tooling. It matches command text only, so a script that calls `supabase` internally is not caught. The `AGENTS.md` section 4 rules stay the owner of permissions, and the hook enforces part of them. Settings changes need the Owner's approval (`update-config`).
- Target program: techstack-migration (TM-U1).

## Closed
