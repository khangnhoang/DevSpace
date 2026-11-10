-- TM-U4 / ADR 0008 D7: add only the reads for the public detail and review routes.
-- The API role bypasses RLS, so private lesson and profile data and all writes stay outside these grants.
begin;

grant select (instructor_id) on public.courses to devspace_api;
grant select (id, course_id, title, order_index) on public.chapters to devspace_api;
grant select (chapter_id, title, has_video, word_count) on public.lessons to devspace_api;
grant select (id, user_id, bio, job_title) on public.instructors to devspace_api;
grant select (id, course_id, user_id, rating, content, created_at) on public.reviews to devspace_api;
grant select (id, full_name, avatar_url) on public.profile_cards to devspace_api;

commit;
