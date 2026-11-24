-- Security fix 3: lock down public.phone_otps (Supabase Security Advisor, 2026-11-24).
-- The table was created by hand in Supabase (no migration in this repo) without RLS,
-- so anyone holding the public anon key could read, change or delete rows through the
-- API: phone numbers, hashed codes, expiry, used flags.
-- The app only touches this table through the service-role client (the phone send and
-- verify routes), and the service role bypasses RLS, so enabling RLS with NO policies
-- is safe: it blocks every client role and breaks nothing. Safe to re-run.
begin;

alter table public.phone_otps enable row level security;
revoke all on public.phone_otps from anon, authenticated;

commit;

-- Verify (expect rowsecurity = true, and no policies and no anon/authenticated grants):
--   select relname, relrowsecurity from pg_class
--    where oid = 'public.phone_otps'::regclass;
--   select policyname from pg_policies where tablename = 'phone_otps';
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name = 'phone_otps' and grantee in ('anon', 'authenticated');
-- Then re-run the Security Advisor; both phone_otps errors should clear.
