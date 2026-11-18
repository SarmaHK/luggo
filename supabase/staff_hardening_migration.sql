-- Staff / hub-side hardening. Safe to re-run. Apply together with the matching app code.
begin;

-- 1. Supervisors. The old rule required an account to be BOTH hub staff and an admin, which no
--    account can be, so every supervisor action (late-fee waiver, ID override, phone-dead pickup,
--    supervisor check-in, resolving incidents) always failed. A supervisor is now a staff member
--    flagged here; an admin switches it on from Admin > Staff.
alter table public.hub_staff add column if not exists is_supervisor boolean not null default false;

-- 2. Staff may close their own hub for the day, but may only reopen a hub THEY paused.
--    A hub an admin has not switched on (for example a newly approved partner) stays off.
alter table public.hubs add column if not exists staff_paused boolean not null default false;

-- 3. Hub revenue totals computed in the database instead of downloading every payment row.
create or replace function public.hub_revenue_totals(p_hub_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (coalesce(public.is_staff_at_hub(p_hub_id), false) or coalesce(public.is_admin(), false)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total',         coalesce(sum(p.amount), 0),
      'recent_total',  coalesce(sum(p.amount) filter (where p.created_at >= now() - interval '30 days'), 0),
      'payment_count', count(*),
      'by_type',       coalesce((
        select jsonb_object_agg(t.type, t.amount)
        from (
          select p2.type::text as type, sum(p2.amount) as amount
          from public.payments p2
          join public.bookings b2 on b2.id = p2.booking_id
          where b2.hub_id = p_hub_id and p2.status = 'paid'
          group by p2.type
        ) t
      ), '{}'::jsonb)
    )
    from public.payments p
    join public.bookings b on b.id = p.booking_id
    where b.hub_id = p_hub_id and p.status = 'paid'
  );
end;
$$;
revoke all on function public.hub_revenue_totals(uuid) from public, anon;
grant execute on function public.hub_revenue_totals(uuid) to authenticated;

commit;

-- After applying, make your real supervisors (replace the email), for example:
--   update public.hub_staff set is_supervisor = true
--   where user_id = (select id from public.users where email = 'supervisor@example.com');
