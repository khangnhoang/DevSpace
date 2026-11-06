-- security-engineering SE-U4 / SE-P4 (CP1), Owner decisions D2 and D3.
-- Soft-deleted comments are hidden from every API role, admin included; their content stays in the table, and
-- only trusted database maintenance can read or restore it. New comments need enrollment in the lesson's course
-- or admin. Rollout: applied together with se_u4_avatar_path_ownership right after the production deploy of the
-- code that calls soft_delete_comment (Main applies it; the Owner grants it).

begin;

-- Permissive policies are OR-ed, so each replaced policy is dropped by its exact hosted name.
drop policy "Public view ALL comments" on public.comments;
create policy comments_select_not_deleted on public.comments
  for select to public
  using (deleted_at is null);

drop policy "Authenticated users can comment" on public.comments;
create policy comments_insert_enrolled_or_admin on public.comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and deleted_at is null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.lessons l
        join public.enrollments e on e.course_id = l.course_id
        where l.id = comments.lesson_id
          and e.user_id = (select auth.uid())
      )
    )
  );

-- A deleted row must not be reachable by an UPDATE that references no column; the WITH CHECK from H2-2a stays.
alter policy "Owners and Admins can update/soft-delete comments" on public.comments
  using (
    deleted_at is null
    and (
      auth.uid() = user_id
      or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
    )
  );

-- The soft delete itself moves the row out of the SELECT policy, which PostgreSQL refuses for an invoker UPDATE,
-- so it runs as the owner. It changes one non-deleted row for its author or an admin and returns whether it did.
create function public.soft_delete_comment(comment_id bigint) returns boolean
  language plpgsql security definer set search_path = '' as $$
declare
  changed integer;
begin
  update public.comments
     set deleted_at = now()
   where id = comment_id
     and deleted_at is null
     and (user_id = auth.uid() or public.is_admin());
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke execute on function public.soft_delete_comment(bigint) from public, anon, authenticated;
grant execute on function public.soft_delete_comment(bigint) to authenticated;

commit;
