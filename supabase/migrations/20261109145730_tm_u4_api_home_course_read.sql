-- techstack-migration TM-U4 (first slice) / ADR 0008 D7: the columns the API reads for the public home page course list.
-- Column grants only, never a table grant: a table-level SELECT on lessons would also give the API lessons.content and
-- lessons.video_url, which TM-U5 protects (supabase-migration, trap 3). The API role bypasses RLS, so these grants are
-- the whole boundary of what the public route can read. Course and lesson rows are public by design ("Public view
-- courses", "Public view lessons" with USING (true)), so no extra row becomes visible.
-- Rollout: additive, applied before PR 1 merges; the frontend does not call the route until PR 2.

begin;

-- The role holds nothing on these two tables (the TM-U3 migration stops on anything else), so this only makes the
-- starting point explicit before the exact grants.
revoke all (id, name, slug, description, image_url, price) on public.courses from devspace_api;
revoke all (id, slug, course_id) on public.lessons from devspace_api;

grant select (id, name, slug, description, image_url, price) on public.courses to devspace_api;
-- The first lesson slug of a course is the slug of its lowest lessons.id; course_id joins it to the course.
grant select (id, slug, course_id) on public.lessons to devspace_api;

commit;
