-- Security fix 1: customers must not create bookings directly.
-- Bookings are created only by the service-role RPC create_booking_with_payment
-- (server-side price, capacity check, payment row). A direct client INSERT could
-- forge total_price / status / qr_code and skip payment. Safe to re-run.
--
-- Not affected: the RPC (security definer), staff walk-in bookings and cron jobs
-- (service role bypasses grants/RLS), and customer SELECT / status UPDATE.
begin;

drop policy if exists "bookings: insert own bookings" on public.bookings;

revoke insert, delete on public.bookings from authenticated, anon;

commit;

-- Verify after applying (expect no INSERT/DELETE rows for anon or authenticated):
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'bookings'
--      and grantee in ('anon', 'authenticated') order by 1, 2;
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'bookings';
