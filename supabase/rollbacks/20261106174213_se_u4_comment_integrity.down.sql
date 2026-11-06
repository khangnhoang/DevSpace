-- Rollback for security-engineering SE-U4 / SE-P4 (CP1). Restores the H2-2a policies exactly and drops the function,
-- so code that calls soft_delete_comment must be reverted first or soft delete fails. No data changes.
begin;

drop function public.soft_delete_comment(bigint);

drop policy comments_select_not_deleted on public.comments;
create policy "Public view ALL comments" on public.comments
  for select to public
  using (true);

drop policy comments_insert_enrolled_or_admin on public.comments;
create policy "Authenticated users can comment" on public.comments
  for insert to authenticated
  with check (auth.uid() = user_id);

alter policy "Owners and Admins can update/soft-delete comments" on public.comments
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

commit;
