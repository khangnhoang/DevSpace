-- Rollback for security-engineering SE-U3 / SE-P6. Reopens the previous GraphQL API.
-- This is the exact hosted version, not the managed local stack's 1.6.2 control.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_graphql')
     or not exists(select 1 from pg_available_extension_versions where name='pg_graphql' and version='1.5.11') then
    raise exception 'SE-U3 GraphQL rollback requires absent extension and available version 1.5.11';
  end if;
end;
$$;
create extension pg_graphql with schema graphql version '1.5.11';
do $$
begin
  if not exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace
    where e.extname='pg_graphql' and e.extversion='1.5.11' and n.nspname='graphql'
      and pg_get_userbyid(e.extowner)='supabase_admin')
     or to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)') is null then
    raise exception 'SE-U3 GraphQL rollback did not restore the expected owner/schema/wrapper';
  end if;
  if exists(select 1 from pg_proc p join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid
    join pg_extension e on d.refclassid='pg_extension'::regclass and d.refobjid=e.oid
    where e.extname='pg_graphql' and d.deptype='e' and
      (select array_agg(a::text order by a::text) from unnest(p.proacl) a) is distinct from
      array['=X/supabase_admin','anon=X/supabase_admin','authenticated=X/supabase_admin',
        'postgres=X/supabase_admin','service_role=X/supabase_admin','supabase_admin=X/supabase_admin']) then
    raise exception 'SE-U3 GraphQL rollback function ACL differs from the reviewed snapshot';
  end if;
end;
$$;
commit;
