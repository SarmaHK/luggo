-- Partner portal: public applications to become a hub partner, plus shareable invite links.
-- Safe to re-run. Apply before deploying the matching app code (/partners, /admin/partners).
begin;

-- One-time invite links an admin creates for a specific business.
create table if not exists public.partner_invites (
  id            uuid primary key default uuid_generate_v4(),
  token         text not null unique,
  business_name text,
  note          text,
  created_by    uuid references public.users(id) on delete set null,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- Applications submitted from /partners. Nothing here goes live on its own:
-- an admin approves an application, which creates an inactive hub.
create table if not exists public.partner_applications (
  id               uuid primary key default uuid_generate_v4(),
  business_name    text not null,
  contact_name     text not null,
  phone            text not null,
  email            text not null,
  city             text not null,
  address          text not null,
  business_type    text not null,
  storage_capacity integer,
  open_time        time,
  close_time       time,
  notes            text,
  locale           text,
  ref_code         text,                                   -- from /partners?ref=CODE
  invite_id        uuid references public.partner_invites(id) on delete set null,
  status           text not null default 'new' check (status in ('new', 'approved', 'rejected')),
  admin_note       text,
  hub_id           uuid references public.hubs(id) on delete set null,
  reviewed_by      uuid references public.users(id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_partner_applications_status  on public.partner_applications(status, created_at desc);
create index if not exists idx_partner_applications_ref     on public.partner_applications(ref_code);
create index if not exists idx_partner_invites_token        on public.partner_invites(token);

-- No policies: only the service role (server actions) may read or write these tables.
alter table public.partner_invites      enable row level security;
alter table public.partner_applications enable row level security;

commit;
