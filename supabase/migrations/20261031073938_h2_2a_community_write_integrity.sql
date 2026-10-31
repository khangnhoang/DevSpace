-- security-hotfix SH-P3/SH-P4, H2-2a (historical P3/P4; B10/B11).
-- Restricts writes without a new application caller. Main confirms deployed callers remain compatible
-- after green CI and independent review, then obtains separate hosted prepare/apply grants.

begin;

drop policy "Only enrolled students can review" on public.reviews;
create policy reviews_insert_own_enrolled on public.reviews
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.enrollments e
      where e.user_id = (select auth.uid()) and e.course_id = reviews.course_id
    )
  );

alter policy "Owners and Admins can update/soft-delete comments" on public.comments
  with check ((select auth.uid()) = user_id or public.is_admin());

-- RLS alone permits admin reassignment and service_role bypasses it entirely.
create function public.prevent_comment_reassign() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id or new.lesson_id is distinct from old.lesson_id then
    raise exception 'comment owner and lesson are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_comment_reassign() from public, anon, authenticated;

create trigger comments_prevent_reassign before update on public.comments
  for each row execute function public.prevent_comment_reassign();

commit;
