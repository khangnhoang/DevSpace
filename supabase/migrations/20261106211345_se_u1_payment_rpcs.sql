-- security-engineering SE-U1 / SE-P8 to SE-P12 (CP1), Owner decisions D1 to D6.
-- Every payment and coupon-usage change goes through one security definer function per transition. A coupon use
-- is reserved when a code is applied and released when the order is closed, switched to another code, or deleted
-- while pending. Rollout (D2): this migration is additive for the old code's normal paths and is applied before
-- the PR that carries the new actions is merged; the write lock (se_u1_payment_write_lock) follows the deploy.
-- Lock order everywhere: advisory lock of (user, course), then the payment row, then coupon rows by ascending id.

begin;

alter table public.payments
  add column coupon_id bigint references public.coupons(id) on delete restrict;

-- D4: at most one pending order per user and course. Aborts the whole migration if hosted holds duplicates.
create unique index payments_one_pending_per_user_course
  on public.payments (user_id, course_id) where status = 'pending';

create function public.create_pending_payment(p_user_id uuid, p_course_id bigint)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_price integer;
  v_id bigint;
  v_amount integer;
  v_attempt integer;
begin
  select c.price into v_price from public.courses c where c.id = p_course_id;
  if not found or v_price is null then
    return jsonb_build_object('result', 'invalid_course');
  end if;
  if v_price = 0 then
    return jsonb_build_object('result', 'free_course');
  end if;

  -- Serializes with approve_payment of the same learner and course: the enrollment is checked only after the lock,
  -- so a create cannot slip a pending order in after an approval committed.
  perform pg_advisory_xact_lock(hashtextextended('payments:' || p_user_id::text || ':' || p_course_id::text, 0));

  if exists (select 1 from public.enrollments e where e.user_id = p_user_id and e.course_id = p_course_id) then
    return jsonb_build_object('result', 'enrolled');
  end if;

  -- The insert conflicts with a pending order that the old code wrote directly or that an earlier create left. The
  -- conflicting order can be closed between the conflict and the read below, because close_pending_payment takes no
  -- advisory lock; the loop then inserts again. A result never carries a missing payment_id.
  for v_attempt in 1..3 loop
    insert into public.payments (user_id, course_id, amount, status)
    values (p_user_id, p_course_id, v_price, 'pending')
    on conflict (user_id, course_id) where status = 'pending' do nothing
    returning id, amount into v_id, v_amount;
    if found then
      return jsonb_build_object('result', 'created', 'payment_id', v_id, 'amount', v_amount);
    end if;

    select p.id, p.amount into v_id, v_amount
    from public.payments p
    where p.user_id = p_user_id and p.course_id = p_course_id and p.status = 'pending';
    if found then
      return jsonb_build_object('result', 'resumed', 'payment_id', v_id, 'amount', v_amount);
    end if;
  end loop;

  -- Only a create and a close that keep alternating on the same order get here; the caller sees a failed call.
  raise exception 'could not create or resume the pending payment' using errcode = '40001';
end $$;

create function public.apply_payment_coupon(p_payment_id bigint, p_user_id uuid, p_code text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_pay public.payments;
  v_coupon_id bigint;
  v_percent integer;
  v_price integer;
  v_amount integer;
begin
  select p.* into v_pay from public.payments p
  where p.id = p_payment_id and p.user_id = p_user_id and p.status = 'pending'
  for update;
  if not found then
    return jsonb_build_object('error', 'invalid_payment');
  end if;

  select c.id, c.discount_percent into v_coupon_id, v_percent
  from public.coupons c
  where c.code = upper(btrim(p_code)) and c.is_active;
  if not found then
    return jsonb_build_object('error', 'invalid_coupon');
  end if;

  select c.price into v_price from public.courses c where c.id = v_pay.course_id;
  v_price := coalesce(v_price, 0);

  if v_pay.coupon_id is distinct from v_coupon_id then
    -- FOR UPDATE with ORDER BY locks in sorted order, so two orders switching M->N and N->M cannot deadlock.
    perform 1 from public.coupons c
    where c.id in (v_coupon_id, v_pay.coupon_id)
    order by c.id
    for update;

    update public.coupons c
    set used_count = coalesce(c.used_count, 0) + 1
    where c.id = v_coupon_id
      and c.is_active
      and (c.max_uses is null or coalesce(c.used_count, 0) < c.max_uses);
    if not found then
      return jsonb_build_object('error', 'coupon_exhausted');
    end if;

    if v_pay.coupon_id is not null then
      update public.coupons c
      set used_count = greatest(coalesce(c.used_count, 0) - 1, 0)
      where c.id = v_pay.coupon_id;
    end if;
  end if;

  -- numeric: price times (100 - percent) overflows integer above about 23.9 million, and a stored percent can lie
  -- outside 0..100. The result is clamped to 0..price before it goes back to integer.
  v_amount := greatest(0::numeric, least(v_price::numeric, round(v_price::numeric * (100 - v_percent::numeric) / 100)))::integer;
  update public.payments p
  set coupon_id = v_coupon_id, amount = v_amount, updated_at = now()
  where p.id = v_pay.id;

  return jsonb_build_object('amount', v_amount, 'discount_percent', v_percent);
end $$;

-- A null p_user_id is the admin rejection. Returns whether a pending order changed.
create function public.close_pending_payment(p_payment_id bigint, p_user_id uuid)
  returns boolean
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_coupon_id bigint;
begin
  update public.payments p
  set status = 'failed', updated_at = now()
  where p.id = p_payment_id
    and p.status = 'pending'
    and (p_user_id is null or p.user_id = p_user_id)
  returning p.coupon_id into v_coupon_id;
  if not found then
    return false;
  end if;

  if v_coupon_id is not null then
    update public.coupons c
    set used_count = greatest(coalesce(c.used_count, 0) - 1, 0)
    where c.id = v_coupon_id;
  end if;
  return true;
end $$;

create function public.approve_payment(p_payment_id bigint)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_user_id uuid;
  v_course_id bigint;
begin
  select p.user_id, p.course_id into v_user_id, v_course_id
  from public.payments p where p.id = p_payment_id;
  if not found then
    return jsonb_build_object('approved', false);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('payments:' || coalesce(v_user_id::text, '') || ':' || v_course_id::text, 0));

  update public.payments p
  set status = 'success', updated_at = now()
  where p.id = p_payment_id and p.status = 'pending';
  if not found then
    return jsonb_build_object('approved', false);
  end if;

  -- Same transaction as the status change: a failed enrollment write rolls the approval back. The reserved
  -- coupon use stays counted.
  insert into public.enrollments (user_id, course_id)
  values (v_user_id, v_course_id)
  on conflict (user_id, course_id) do nothing;

  return jsonb_build_object('approved', true, 'user_id', v_user_id, 'course_id', v_course_id);
end $$;

-- Holds every role but the table owner postgres (the functions above run as their owner) to the payment contract. It
-- decides by current_user only; it reads no client-settable setting. The service role bypasses RLS but not triggers.
create function public.payments_guard() returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_price integer;
begin
  if current_user = 'postgres' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select coalesce(c.price, 0) into v_price from public.courses c where c.id = new.course_id;
    if new.status is distinct from 'pending' or new.coupon_id is not null or new.amount is distinct from v_price then
      raise exception 'new payments must be pending, at the course price, without a coupon' using errcode = '42501';
    end if;
    return new;
  end if;

  -- tg_argv[0] = 'any' (every update) or 'columns' (update of status, amount, coupon_id: fires on a same-value
  -- assignment too, which is how the old approve re-set a success order).
  if old.coupon_id is not null or new.coupon_id is not null then
    raise exception 'payments that hold a coupon change only through the payment functions' using errcode = '42501';
  end if;
  if tg_argv[0] = 'columns' and old.status is distinct from 'pending' then
    raise exception 'status, amount and coupon of a processed payment do not change' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger payments_guard_insert before insert on public.payments
  for each row execute function public.payments_guard();
create trigger payments_guard_update_any before update on public.payments
  for each row execute function public.payments_guard('any');
create trigger payments_guard_update_columns before update of status, amount, coupon_id on public.payments
  for each row execute function public.payments_guard('columns');

-- Statement-level so a cascade from courses or auth.users releases through the same path. One update per coupon in
-- ascending id keeps concurrent deletes in one lock order (a statement deleting several users still runs several
-- internal statements; the app deletes one at a time). Deleted success orders keep their use (D6).
create function public.payments_release_on_delete() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select d.coupon_id, count(*)::integer as n
    from deleted_payments d
    where d.status = 'pending' and d.coupon_id is not null
    group by d.coupon_id
    order by d.coupon_id
  loop
    update public.coupons c
    set used_count = greatest(coalesce(c.used_count, 0) - r.n, 0)
    where c.id = r.coupon_id;
  end loop;
  return null;
end $$;

create trigger payments_release_on_delete after delete on public.payments
  referencing old table as deleted_payments
  for each statement execute function public.payments_release_on_delete();

-- Default ACLs grant EXECUTE on new functions to anon and authenticated.
revoke execute on function public.create_pending_payment(uuid, bigint) from public, anon, authenticated;
revoke execute on function public.apply_payment_coupon(bigint, uuid, text) from public, anon, authenticated;
revoke execute on function public.close_pending_payment(bigint, uuid) from public, anon, authenticated;
revoke execute on function public.approve_payment(bigint) from public, anon, authenticated;
revoke execute on function public.payments_guard() from public, anon, authenticated, service_role;
revoke execute on function public.payments_release_on_delete() from public, anon, authenticated, service_role;
grant execute on function public.create_pending_payment(uuid, bigint) to service_role;
grant execute on function public.apply_payment_coupon(bigint, uuid, text) to service_role;
grant execute on function public.close_pending_payment(bigint, uuid) to service_role;
grant execute on function public.approve_payment(bigint) to service_role;

commit;
