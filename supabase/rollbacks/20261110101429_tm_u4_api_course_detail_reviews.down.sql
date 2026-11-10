-- TM-U4: remove only the detail and review grants, preserving the home and TM-U3 grants.
begin;

revoke select (id, full_name, avatar_url) on public.profile_cards from devspace_api;
revoke select (id, course_id, user_id, rating, content, created_at) on public.reviews from devspace_api;
revoke select (id, user_id, bio, job_title) on public.instructors from devspace_api;
revoke select (chapter_id, title, has_video, word_count) on public.lessons from devspace_api;
revoke select (id, course_id, title, order_index) on public.chapters from devspace_api;
revoke select (instructor_id) on public.courses from devspace_api;

commit;
