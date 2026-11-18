-- Security fix 2: hub staff may read only customers who booked at their own hub.
-- The original policy in schema.sql let ANY active staff member read EVERY user row
-- (name, email, phone, nic_passport). supabase/production_fixes_migration.sql already
-- narrowed it; this re-asserts the narrow rule so it holds whichever migrations ran,
-- and keeps schema.sql in sync. Safe to re-run.
--
-- Unchanged: users still read their own row; admins still read all (is_admin());
-- staff pages that show a booking's customer keep working because those customers
-- have a booking at the staff member's hub. Service-role reads are not affected.
begin;

drop policy if exists "users: staff see own hub customers" on public.users;
create policy "users: staff see own hub customers" on public.users
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.user_id = public.users.id
        and public.is_staff_at_hub(b.hub_id)
    )
  );

commit;

-- Verify after applying (policy text must reference bookings and is_staff_at_hub):
--   select policyname, qual from pg_policies
--    where schemaname = 'public' and tablename = 'users';
-- Behaviour check, as a staff member of hub A (use the Supabase "impersonate" feature):
--   select count(*) from public.users;   -- only own row + customers with a hub A booking
