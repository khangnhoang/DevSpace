-- Rollback of se_u1_payment_write_lock: gives the three API roles their table-level INSERT and UPDATE back.
-- The guard trigger of se_u1_payment_rpcs still holds them to the payment contract.

begin;

grant insert, update on public.payments to service_role, anon, authenticated;

commit;
