-- Rollback for techstack-migration TM-U4 (first slice): removes the column grants of the migration of the same name,
-- which restores the TM-U3 grants of devspace_api exactly (usage on schema public, select (id, role) on profiles).
-- Run it only after every code version that reads these columns through the API is gone, and before the rollback of
-- 20261108143215_devspace_api, whose DROP ROLE refuses a role that still holds a grant.
begin;

revoke select (id, name, slug, description, image_url, price) on public.courses from devspace_api;
revoke select (id, slug, course_id) on public.lessons from devspace_api;

commit;
