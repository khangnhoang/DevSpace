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

-- A role that already existed may hold something this migration does not manage: a privilege on another column,
-- table, function, schema or the database, an object it owns (whatever that object's ACL says, a NULL one included),
-- a default privilege. The migration manages schema public and the columns profiles.id and profiles.role only.
-- Revoking anything else silently could break a consumer nobody knows about, and leaving it would make the grants
-- below a lie, so it is a stop, as for SUPERUSER above; the message names the objects (never a secret). pg_shdepend
-- lists, for this database and the shared objects, every object that refers to the role as an ACL member ('a') or as
-- its owner ('o'), so no object kind is chased by its own catalog. A REVOKE removes only the grants the revoking role
-- made, so a privilege another owner granted would survive it unseen; here it is listed all the same. What the role
-- gets through PUBLIC is not an entry of the role and is not looked at here (API-R4 records it). This runs before any
-- revoke, because revoking a table's privileges also revokes its column privileges.
do $$
declare
  stray text;
begin
  select string_agg(description, ', ' order by description) into stray
  from (
    select pg_describe_object(d.classid, d.objid, d.objsubid) as description
    from pg_shdepend d
    where d.refclassid = 'pg_authid'::regclass
      and d.refobjid = 'devspace_api'::regrole::oid
      and d.dbid in (0, (select oid from pg_database where datname = current_database()))
      and not (
        d.deptype = 'a'
        and (
          (d.classid = 'pg_namespace'::regclass and d.objid = 'public'::regnamespace::oid and d.objsubid = 0)
          or (
            d.classid = 'pg_class'::regclass
            and d.objid = 'public.profiles'::regclass::oid
            and d.objsubid in (
              select a.attnum from pg_attribute a
              where a.attrelid = 'public.profiles'::regclass and a.attname in ('id', 'role')
            )
          )
        )
      )
  ) held;
  if stray is not null then
    raise exception 'devspace_api holds privileges or objects outside this migration: %; stop for an Owner-approved repair', stray;
  end if;
end
$$;

-- What the migration does manage starts from nothing (supabase-migration, trap 2) and is then granted exactly. The
-- revokes name those objects only: a sweep over every table, sequence or function of the schema would also reach
-- objects that belong to other roles, which this migration does not own and does not grant on. A new role holds
-- nothing else, so a new role changes no unrelated object (API-R9).
revoke all on schema public from devspace_api;
revoke all (id, role) on public.profiles from devspace_api;

grant usage on schema public to devspace_api;
-- An endpoint's permission check reads the caller's role from profiles with its own query (ADR 0008 D7); the TM-U3
-- proof route is the first reader. The session guard asks Supabase Auth and reads no table. No other column or table
-- is granted.
grant select (id, role) on public.profiles to devspace_api;

commit;
