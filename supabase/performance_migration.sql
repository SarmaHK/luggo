-- Performance: indexes for the admin lists, and server-side totals for the admin dashboard.
-- Safe to re-run. The app falls back to its old queries if these functions are missing,
-- so this can be applied before or after the matching app code.
begin;

-- The admin lists sort by created_at; without these Postgres sorts every row on each page view.
create index if not exists idx_bookings_created_at         on public.bookings (created_at desc);
create index if not exists idx_payments_created_at         on public.payments (created_at desc);
create index if not exists idx_payments_status_created_at  on public.payments (status, created_at desc);
create index if not exists idx_users_role_created_at       on public.users (role, created_at desc);
create index if not exists idx_hub_staff_hub_id            on public.hub_staff (hub_id);

-- Dashboard totals computed in the database instead of downloading every payment row.
-- "Today" is Sri Lanka's calendar day, not the server's (UTC on Vercel).
create or replace function public.admin_dashboard_totals()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total_revenue', coalesce((select sum(amount) from public.payments where status = 'paid'), 0),
    'today_revenue', coalesce((select sum(amount) from public.payments
                                where status = 'paid'
                                  and created_at >= (date_trunc('day', now() at time zone 'Asia/Colombo') at time zone 'Asia/Colombo')), 0),
    'total_bookings', (select count(*) from public.bookings)
  );
end;
$$;

-- Bags currently in storage per hub, for the Hubs page.
create or replace function public.admin_hub_bag_counts()
returns table (hub_id uuid, bags bigint) language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select b.hub_id, count(bb.id)
    from public.bookings b
    join public.booking_bags bb on bb.booking_id = b.id
    where b.status in ('active_storage', 'pickup_requested', 'overstayed')
    group by b.hub_id;
end;
$$;

-- Booking count per user, for the Users page.
create or replace function public.admin_user_booking_counts(p_user_ids uuid[])
returns table (user_id uuid, bookings bigint) language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select b.user_id, count(*)
    from public.bookings b
    where b.user_id = any(p_user_ids)
    group by b.user_id;
end;
$$;

-- Signed-in users only; the functions also check is_admin() themselves.
revoke all on function public.admin_dashboard_totals()                from public, anon;
revoke all on function public.admin_hub_bag_counts()                  from public, anon;
revoke all on function public.admin_user_booking_counts(uuid[])       from public, anon;
grant execute on function public.admin_dashboard_totals()             to authenticated;
grant execute on function public.admin_hub_bag_counts()               to authenticated;
grant execute on function public.admin_user_booking_counts(uuid[])    to authenticated;

commit;
