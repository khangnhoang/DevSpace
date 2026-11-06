-- security-engineering SE-U3 / SE-P6: remove unused GraphQL without deleting dependents.
-- Apply M1/M2/M3 before merge, after whole-set readiness, review and separate hosted grants.
-- Hosted rollback is pinned to 1.5.11. Version 1.6.2 is accepted only for the existing managed local stack.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  installed_version text;
begin
  select e.extversion into installed_version from pg_extension e join pg_namespace n on n.oid=e.extnamespace
    where e.extname='pg_graphql' and n.nspname='graphql' and pg_get_userbyid(e.extowner)='supabase_admin';
  if installed_version is null or installed_version not in ('1.5.11', '1.6.2')
     or not exists(select 1 from pg_available_extension_versions where name='pg_graphql' and version=installed_version) then
    raise exception 'SE-U3 GraphQL version/owner/schema or rollback availability differs from the reviewed environment';
  end if;
  if (select count(*) from pg_depend d join pg_extension e on e.oid=d.refobjid
      where e.extname='pg_graphql' and d.refclassid='pg_extension'::regclass and d.deptype='e') <> 10
     or exists(select 1 from pg_depend d join pg_extension e on e.oid=d.refobjid
       where e.extname='pg_graphql' and d.refclassid='pg_extension'::regclass and d.deptype='e'
         and pg_describe_object(d.classid,d.objid,d.objsubid) not in (
           'function graphql.exception(text)', 'function graphql.comment_directive(text)',
           'sequence graphql.seq_schema_version', 'function graphql.increment_schema_version()',
           'function graphql.get_schema_version()', 'event trigger graphql_watch_ddl',
           'event trigger graphql_watch_drop', 'function graphql._internal_resolve(text,jsonb,text,jsonb)',
           'function graphql.resolve(text,jsonb,text,jsonb)', 'function graphql_public.graphql(text,text,jsonb,jsonb)')) then
    raise exception 'SE-U3 GraphQL extension member inventory changed';
  end if;
  if exists (
    with ext as (select oid from pg_extension where extname='pg_graphql'), members as (
      select d.classid,d.objid from pg_depend d join ext on d.refobjid=ext.oid
      where d.refclassid='pg_extension'::regclass and d.deptype='e'
    ), roots as (select * from members union all select 'pg_extension'::regclass,oid from ext)
    select 1 from pg_depend d join roots r on d.refclassid=r.classid and d.refobjid=r.objid
    where not exists(select 1 from members m where m.classid=d.classid and m.objid=d.objid)
      and not (d.classid='pg_extension'::regclass and d.objid in(select oid from ext))
  ) then
    raise exception 'SE-U3 GraphQL has external database dependents; stop for Owner review';
  end if;
  -- Function bodies can contain dynamic references that pg_depend cannot record.
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind in ('f','p') and p.prosrc ilike '%graphql%') then
    raise exception 'SE-U3 public function references GraphQL; stop for Owner review';
  end if;
  if not exists(select 1 from pg_event_trigger where evtname='issue_pg_graphql_access' and evtenabled='O')
     or not exists(select 1 from pg_event_trigger where evtname='issue_graphql_placeholder' and evtenabled='O') then
    raise exception 'SE-U3 GraphQL platform hooks differ from the reviewed environment';
  end if;
  -- A custom ACL cannot be reconstructed by the version-pinned rollback. Refuse it before removal.
  if exists(select 1 from pg_proc p join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid
    join pg_extension e on d.refclassid='pg_extension'::regclass and d.refobjid=e.oid
    where e.extname='pg_graphql' and d.deptype='e' and
      (select array_agg(a::text order by a::text) from unnest(p.proacl) a) is distinct from
      array['=X/supabase_admin','anon=X/supabase_admin','authenticated=X/supabase_admin',
        'postgres=X/supabase_admin','service_role=X/supabase_admin','supabase_admin=X/supabase_admin']) then
    raise exception 'SE-U3 GraphQL function ACL differs from the reviewed snapshot';
  end if;
  if (select array_agg(a::text order by a::text) from pg_class c, lateral unnest(c.relacl) a
      where c.oid=to_regclass('graphql.seq_schema_version')) is distinct from
      array['anon=rwU/supabase_admin','authenticated=rwU/supabase_admin','postgres=rwU/supabase_admin',
        'service_role=rwU/supabase_admin','supabase_admin=rwU/supabase_admin']
     or (select count(*) from pg_namespace n where n.nspname in('graphql','graphql_public')
       and pg_get_userbyid(n.nspowner)='supabase_admin'
       and (select array_agg(a::text order by a::text) from unnest(n.nspacl) a) =
         array['anon=U/supabase_admin','authenticated=U/supabase_admin','postgres=U*/supabase_admin',
           'service_role=U/supabase_admin','supabase_admin=UC/supabase_admin']) <> 2 then
    raise exception 'SE-U3 GraphQL sequence/schema ACL differs from the reviewed snapshot';
  end if;
end;
$$;

-- The extension removes its own members. PostgreSQL refuses any outside dependency.
-- Keep the schemas and managed hooks; the latter install the disabled-extension wrapper.
drop extension pg_graphql;
commit;
