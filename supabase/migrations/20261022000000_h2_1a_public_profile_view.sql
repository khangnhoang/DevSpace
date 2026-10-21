-- H2-1 security hotfix, migration A (additive): public profile projection and
-- derived lesson metadata. See docs/programs/security-hotfix/plan-h2.md section 4.1.
-- Not applied by the implementor; applied to the hosted DB after Owner approval.
-- Safe to apply before the code deploy: nothing existing changes.

begin;

-- Public projection of profiles: only what other users may see.
-- The view is owned by postgres and is NOT security_invoker, so reads bypass
-- profiles RLS on purpose; that is what lets us later restrict profiles to
-- self/admin while reviews, comments and instructors still show names.
-- (The security_definer_view advisor warning is expected and accepted.)
create view public.profile_cards as
  select id, full_name, avatar_url, role from public.profiles;

-- A simple view is auto-updatable, and the schema's default ACL grants
-- INSERT/UPDATE/DELETE on new relations to anon/authenticated. Without this
-- revoke, writes through the view would hit profiles as postgres and bypass RLS.
revoke all on public.profile_cards from public, anon, authenticated;
grant select on public.profile_cards to anon, authenticated;

-- Public lesson metadata derived from the private columns, so outlines and
-- duration estimates no longer need content or video_url.
-- word_count mirrors estimateTime(): content.replace(/<[^>]*>?/gm, "").trim().split(/\s+/).length,
-- i.e. strip HTML tags, trim all whitespace, split on whitespace. Like JS, a
-- whitespace-only body counts as 1 (split of "" has length 1); empty/null = null.
alter table public.lessons
  add column has_video boolean
    generated always as (coalesce(video_url, '') <> '') stored,
  add column word_count integer
    generated always as (
      case when coalesce(content, '') = '' then null
           else coalesce(array_length(regexp_split_to_array(
                  regexp_replace(regexp_replace(content, '<[^>]*>?', '', 'g'), '^\s+|\s+$', '', 'g'),
                  '\s+'), 1), 1)
      end) stored;

commit;
