-- Rollback for 20261021181051_h2_1a_public_profile_view.sql.
-- Only run after the code no longer reads profile_cards, has_video or word_count.

begin;

drop view if exists public.profile_cards;

alter table public.lessons
  drop column if exists has_video,
  drop column if exists word_count;

commit;
