-- Rollback for techstack-migration TM-U3 / ADR 0008 D7: removes the API role. On hosted, set the role back to
-- NOLOGIN first (and end its connections) under a new grant; DROP ROLE refuses a role that is in use.
begin;

revoke select (id, role) on public.profiles from devspace_api;
revoke usage on schema public from devspace_api;
drop role if exists devspace_api;

commit;
