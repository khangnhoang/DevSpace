-- Rollback for techstack-migration TM-U5: removes the column grants of the migration of the same name, which restores
-- the TM-U4 grants of devspace_api exactly. Run it only after every code version that reads these columns through the
-- API is gone (the learn routes of the TM-U5 backend), and before the rollbacks of the TM-U4 migrations.
begin;

revoke select (order_index, created_at, content, video_url) on public.lessons from devspace_api;
revoke select (user_id, course_id) on public.enrollments from devspace_api;
revoke select (lesson_id) on public.exercises from devspace_api;

commit;
