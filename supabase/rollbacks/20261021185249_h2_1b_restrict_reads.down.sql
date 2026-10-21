-- Rollback for 20261021185249_h2_1b_restrict_reads.sql.
-- Restores the original (publicly readable) policies and the table-level SELECT
-- on lessons; only use to undo a bad deploy. Migration A objects are untouched.

begin;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" on public.profiles
  for select to public using (true);

drop policy if exists "Public can view active coupons" on public.coupons;
create policy "Public can view active coupons" on public.coupons
  for select to public using (true);

drop policy if exists "exercises_select_enrolled_or_admin" on public.exercises;
drop policy if exists "Public view exercises" on public.exercises;
create policy "Public view exercises" on public.exercises
  for select to public using (true);

-- Column grants are additive to a table-level grant; revoking them first keeps
-- the end state identical to the original table-level SELECT.
revoke select (id, title, slug, course_id, chapter_id, order_index, created_at,
               has_video, word_count)
  on public.lessons from anon, authenticated;
grant select on public.lessons to anon, authenticated;

commit;
