-- security-engineering SE-U1 / SE-P8 to SE-P12 (CP3), Owner decision D2.
-- Revokes direct INSERT and UPDATE on public.payments from every API role. From here only the security definer
-- functions of se_u1_payment_rpcs (and the table owner) write orders. DELETE stays: test cleanup and the cascades
-- from courses and auth.users still need it. Rollout: applied only after the production deploy of the code that
-- calls those functions is live (Main applies it; the Owner grants it); otherwise the old actions fail.

begin;

revoke insert, update on public.payments from service_role, anon, authenticated;

commit;
