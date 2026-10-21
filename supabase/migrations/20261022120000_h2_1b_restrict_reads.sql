-- H2-1 security hotfix, migration B (restrictive): stop public reads of profile
-- PII, coupons, private lesson columns and exercises.
-- See docs/programs/security-hotfix/plan-h2.md section 4.1.
-- Not applied by the implementor; applied to the hosted DB after Owner approval.
-- Apply ONLY AFTER the H2-1 code is live in production: older code still reads
-- profiles, coupons, lessons.content/video_url and exercises as anon and breaks.

begin;

-- P1: profiles — only self or admin. Public name/avatar/role now come from the
-- profile_cards view (migration A).
-- Plain auth.uid() on purpose: a scalar subquery (sublink) here makes Postgres
-- raise 42P17 "infinite recursion detected in policy for relation profiles"
-- through the admin UPDATE/DELETE policies, which subquery profiles themselves.
drop policy "Public profiles are viewable by everyone" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- P2: coupons — no client reads at all (server uses service role).
drop policy "Public can view active coupons" on public.coupons;

-- P13: lessons — rows stay public, content columns do not.
-- INSERT/UPDATE/DELETE grants are untouched so the admin UI keeps writing.
revoke select on public.lessons from anon, authenticated;
grant select (id, title, slug, course_id, chapter_id, order_index, created_at,
               has_video, word_count)
  on public.lessons to anon, authenticated;

-- P13: exercises — enrolled learners of the lesson's course, or admin.
drop policy "Public view exercises" on public.exercises;
create policy "exercises_select_enrolled_or_admin" on public.exercises
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.lessons l
      join public.enrollments e on e.course_id = l.course_id
      where l.id = exercises.lesson_id
        and e.user_id = (select auth.uid())
    )
  );

commit;
