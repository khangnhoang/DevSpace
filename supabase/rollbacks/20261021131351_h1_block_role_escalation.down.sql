-- Rollback for 20261021131351_h1_block_role_escalation.sql.
-- Restores the original (vulnerable) definitions; only use to undo a bad deploy.

begin;

drop trigger if exists prevent_role_escalation on public.profiles;
drop function if exists public.prevent_role_escalation();

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
as $function$
begin
  insert into public.profiles (id, email, full_name, avatar_url, phone, gender, role)
  values (
    new.id, new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'gender',
    coalesce(new.raw_user_meta_data->>'role', 'user')
  );
  return new;
end;
$function$;

create or replace function public.is_admin()
 returns boolean
 language plpgsql
 security definer
as $function$
begin
  return exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
end;
$function$;

alter function public.update_updated_at_column() reset search_path;

grant execute on function public.handle_new_user() to public, anon, authenticated;

commit;
