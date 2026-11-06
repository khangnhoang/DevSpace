-- Rollback of se_u1_payment_rpcs. Refuses while a pending order holds a coupon, so no reservation loses its link;
-- the runbook closes those orders through the functions first. Drops the coupon_id history of closed orders.

begin;

do $$
begin
  if exists (select 1 from public.payments where status = 'pending' and coupon_id is not null) then
    raise exception 'pending payments still hold a coupon: approve or reject them first';
  end if;
end $$;

drop trigger payments_release_on_delete on public.payments;
drop trigger payments_guard_update_columns on public.payments;
drop trigger payments_guard_update_any on public.payments;
drop trigger payments_guard_insert on public.payments;
drop function public.payments_release_on_delete();
drop function public.payments_guard();
drop function public.approve_payment(bigint);
drop function public.close_pending_payment(bigint, uuid);
drop function public.apply_payment_coupon(bigint, uuid, text);
drop function public.create_pending_payment(uuid, bigint);
drop index public.payments_one_pending_per_user_course;
alter table public.payments drop column coupon_id;

commit;
