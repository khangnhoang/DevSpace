-- techstack-migration TM-U3 / ADR 0008 D7: the login role of the NestJS API.
-- NOLOGIN here: the Owner sets LOGIN and a generated password on hosted in the SQL editor, and the local seed sets an
-- invented one, so no credential is ever in a migration. BYPASSRLS because the API's server-side checks are the
-- enforcement (ADR 0008 D7); the grants below are the whole boundary of the role, so they stay minimal and each unit
-- widens them in its own migration. Rollout: additive, applied before PR 1 merges; nothing calls the role until
-- Railway is configured.

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'devspace_api') then
    create role devspace_api nologin nosuperuser nocreaterole nocreatedb noreplication bypassrls;
  end if;
end
$$;

-- A local reset can keep roles. A role that is not the one this migration describes is a stop, because the plain
-- `postgres` role cannot alter SUPERUSER or REPLICATION (hosted and local alike); the rest is pinned again here.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'devspace_api' and (rolsuper or rolreplication)) then
    raise exception 'devspace_api exists with SUPERUSER or REPLICATION; stop for an Owner-approved repair';
  end if;
end
$$;
alter role devspace_api nologin nocreaterole nocreatedb bypassrls;

do $$
declare
  parent record;
begin
  for parent in
    select r.rolname
    from pg_auth_members m
    join pg_roles r on r.oid = m.roleid
    where m.member = 'devspace_api'::regrole
  loop
    execute format('revoke %I from devspace_api', parent.rolname);
  end loop;
end
$$;

-- Start from nothing (supabase-migration, trap 2), then grant exactly what the health and session paths read.
revoke all on schema public from devspace_api;
revoke all on all tables in schema public from devspace_api;
revoke all on all sequences in schema public from devspace_api;
revoke all on all functions in schema public from devspace_api;

grant usage on schema public to devspace_api;
-- The session guard reads the caller's role from profiles; no other column or table is granted.
grant select (id, role) on public.profiles to devspace_api;

commit;
