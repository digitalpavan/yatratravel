-- Yatra Travels: schema, roles, row-level security and audit log.
-- Access model:
--   anon (public website): reads published catalogue/content only. No access to bookings, enquiries or staff data.
--   staff: bookings, enquiries, notes, vehicle availability.
--   admin: everything staff can do, plus catalogue, content, users, exports and the audit log.
-- Public booking/enquiry inserts go through the Next.js API using the secret key, after server-side validation.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- types
create type public.app_role as enum ('admin', 'staff');
create type public.booking_status as enum ('requested', 'confirmed', 'completed', 'cancelled');
create type public.payment_status as enum ('unpaid', 'advance_paid', 'paid', 'refunded', 'not_applicable');
create type public.enquiry_status as enum ('new', 'contacted', 'follow_up', 'converted', 'closed');

-- ---------------------------------------------------------------- staff profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.app_role not null default 'staff',
  active boolean not null default true,
  -- Set for accounts created with a one-time password; the dashboard forces a new password before anything else.
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

-- Role helpers. SECURITY DEFINER so policies can read profiles without recursive RLS.
create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and active
$$;
create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() in ('admin', 'staff'), false)
$$;
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

-- ---------------------------------------------------------------- catalogue
create table public.destinations (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  detail text not null default '',
  distance text not null default '',
  image text not null default '',
  featured boolean not null default true,
  sort integer not null default 0
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  examples text not null default '',
  passengers integer not null check (passengers between 1 and 60),
  luggage text not null default '',
  ac boolean not null default true,
  image text not null default '',
  best_for text not null default '',
  features text[] not null default '{}',
  active boolean not null default true,
  verified boolean not null default false,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Internal fleet facts and pricing rules: never readable by the public.
create table public.vehicle_internal (
  vehicle_id uuid primary key references public.vehicles (id) on delete cascade,
  fleet_count integer not null default 0 check (fleet_count >= 0),
  fleet_details text not null default '',
  per_km_rate numeric(10, 2),
  min_km_per_day integer,
  driver_allowance_per_day numeric(10, 2),
  night_charge numeric(10, 2),
  extra_hour_rate numeric(10, 2),
  pricing_notes text not null default ''
);

create table public.vehicle_blocks (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  units integer not null default 1 check (units >= 1),
  reason text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  category text not null check (category in ('temple-tour', 'transfer', 'package', 'day-tour', 'cab', 'custom')),
  destinations text[] not null default '{}',
  duration_days numeric(4, 1),
  duration_label text not null default '',
  summary text not null default '',
  overview text not null default '',
  image text not null default '',
  gallery text[] not null default '{}',
  passengers_min integer not null default 1,
  passengers_max integer not null default 12,
  price_unit text not null default '',
  itinerary jsonb not null default '[]',
  inclusions text[] not null default '{}',
  exclusions text[] not null default '{}',
  faqs jsonb not null default '[]',
  popularity integer not null default 50,
  featured boolean not null default false,
  published boolean not null default false,
  seo_title text not null default '',
  seo_description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per vehicle offered on a package. price null = "on request".
create table public.package_vehicles (
  package_id uuid not null references public.packages (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  price numeric(10, 2) check (price is null or price >= 0),
  primary key (package_id, vehicle_id)
);

-- Uploaded images (processed into responsive WebP sizes by the admin upload action).
create table public.media (
  id uuid primary key default gen_random_uuid(),
  alt text not null default '',
  width integer not null,
  height integer not null,
  src text not null,
  srcset text not null,
  placeholder text not null default '',
  storage_paths text[] not null default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- content
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  description text not null default '',
  body text not null default '',
  image text not null default '',
  image_alt text not null default '',
  category text not null default 'Travel guide',
  tags text[] not null default '{}',
  published boolean not null default false,
  published_at date,
  seo_title text not null default '',
  seo_description text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- customers
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  idempotency_key uuid not null unique,
  status public.booking_status not null default 'requested',
  name text not null,
  phone text not null,
  email text,
  package_slug text not null,
  package_title text not null,
  travel_date date not null,
  passengers integer not null,
  pickup text not null,
  vehicle text not null,
  requests text,
  consent_at timestamptz not null,
  payment_status public.payment_status not null default 'unpaid',
  amount_quoted numeric(10, 2),
  amount_paid numeric(10, 2),
  assigned_to uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_travel_date_idx on public.bookings (travel_date);
create index bookings_status_idx on public.bookings (status);
create index bookings_created_idx on public.bookings (created_at desc);

create table public.booking_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id),
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  source text not null,
  status public.enquiry_status not null default 'new',
  name text not null,
  phone text not null,
  email text,
  package_slug text,
  travel_date date,
  message text not null,
  consent_at timestamptz not null,
  assigned_to uuid references public.profiles (id),
  next_follow_up date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index enquiries_status_idx on public.enquiries (status, created_at desc);

create table public.enquiry_notes (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id),
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- audit log
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- Records who changed what. Long text values are truncated; personal fields aren't copied, only named as changed.
create function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  changed jsonb := '{}';
  k text;
  private_cols text[] := array['name', 'phone', 'email', 'pickup', 'requests', 'message', 'body', 'overview', 'itinerary', 'faqs'];
  ent_id text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(to_jsonb(new)) loop
      if k not in ('updated_at') and (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k) then
        changed := changed || jsonb_build_object(k,
          case when k = any(private_cols) then '"(changed)"'::jsonb
               else jsonb_build_array(left((to_jsonb(old) ->> k), 200), left((to_jsonb(new) ->> k), 200)) end);
      end if;
    end loop;
    if changed = '{}'::jsonb then return new; end if;
  end if;
  ent_id := coalesce(to_jsonb(coalesce(new, old)) ->> 'id', to_jsonb(coalesce(new, old)) ->> 'key',
                     to_jsonb(coalesce(new, old)) ->> 'slug', to_jsonb(coalesce(new, old)) ->> 'vehicle_id');
  insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()), lower(tg_op), tg_table_name, ent_id,
          case when tg_op = 'UPDATE' then jsonb_build_object('changed', changed)
               when tg_op = 'INSERT' then jsonb_build_object('label', coalesce(to_jsonb(new) ->> 'title', to_jsonb(new) ->> 'name', to_jsonb(new) ->> 'reference', to_jsonb(new) ->> 'key'))
               else jsonb_build_object('label', coalesce(to_jsonb(old) ->> 'title', to_jsonb(old) ->> 'name', to_jsonb(old) ->> 'key')) end);
  return coalesce(new, old);
end $$;

-- Explicit events (exports, invitations) from the app. Only staff can log, always as themselves.
create function public.log_event(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'not allowed'; end if;
  insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'));
end $$;

do $$
declare t text;
begin
  foreach t in array array['bookings', 'enquiries', 'packages', 'package_vehicles', 'vehicles', 'vehicle_internal', 'vehicle_blocks',
                           'destinations', 'site_settings', 'blog_posts', 'profiles', 'media']
  loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- integrity triggers
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();
create trigger enquiries_touch before update on public.enquiries for each row execute function public.touch_updated_at();
create trigger packages_touch before update on public.packages for each row execute function public.touch_updated_at();
create trigger vehicles_touch before update on public.vehicles for each row execute function public.touch_updated_at();
create trigger site_settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();
create trigger blog_posts_touch before update on public.blog_posts for each row execute function public.touch_updated_at();

-- Booking status may only move forward: requested → confirmed → completed, and either open state → cancelled.
create function public.check_booking_status() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and not (
    (old.status = 'requested' and new.status in ('confirmed', 'cancelled')) or
    (old.status = 'confirmed' and new.status in ('completed', 'cancelled'))
  ) then
    raise exception 'Booking status cannot change from % to %', old.status, new.status using errcode = 'check_violation';
  end if;
  -- Customer-submitted fields are never edited from the dashboard.
  if (new.reference, new.idempotency_key, new.consent_at, new.created_at) is distinct from
     (old.reference, old.idempotency_key, old.consent_at, old.created_at) then
    raise exception 'Booking reference and consent fields are read-only' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger bookings_status before update on public.bookings for each row execute function public.check_booking_status();

-- Staff can't change their own role or reactivate themselves; only admins manage profiles.
create function public.guard_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can change staff accounts' using errcode = 'insufficient_privilege';
  end if;
  if auth.uid() = old.id and (new.role <> old.role or new.active <> old.active) then
    raise exception 'You cannot change your own role or deactivate yourself' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile();

-- ---------------------------------------------------------------- row-level security
alter table public.profiles enable row level security;
alter table public.destinations enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_internal enable row level security;
alter table public.vehicle_blocks enable row level security;
alter table public.packages enable row level security;
alter table public.package_vehicles enable row level security;
alter table public.media enable row level security;
alter table public.site_settings enable row level security;
alter table public.blog_posts enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_notes enable row level security;
alter table public.enquiries enable row level security;
alter table public.enquiry_notes enable row level security;
alter table public.audit_log enable row level security;

-- Public catalogue
create policy "read destinations" on public.destinations for select using (true);
create policy "admin writes destinations" on public.destinations for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read active vehicles" on public.vehicles for select using (active or public.is_staff());
create policy "admin writes vehicles" on public.vehicles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "staff read vehicle internals" on public.vehicle_internal for select to authenticated using (public.is_staff());
create policy "admin writes vehicle internals" on public.vehicle_internal for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "staff manage availability" on public.vehicle_blocks for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "read published packages" on public.packages for select using (published or public.is_staff());
create policy "admin writes packages" on public.packages for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read prices of visible packages" on public.package_vehicles for select
  using (exists (select 1 from public.packages p where p.id = package_id and (p.published or public.is_staff())));
create policy "admin writes prices" on public.package_vehicles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read media" on public.media for select using (true);
create policy "admin writes media" on public.media for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read public settings" on public.site_settings for select using (is_public or public.is_staff());
create policy "admin writes settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read published posts" on public.blog_posts for select using (published or public.is_staff());
create policy "admin writes posts" on public.blog_posts for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Customer data: staff only. No anon policies at all, so the public role can't read or write these tables.
create policy "staff read bookings" on public.bookings for select to authenticated using (public.is_staff());
create policy "staff update bookings" on public.bookings for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "staff read booking notes" on public.booking_notes for select to authenticated using (public.is_staff());
create policy "staff add booking notes" on public.booking_notes for insert to authenticated with check (public.is_staff() and author_id = auth.uid());

create policy "staff read enquiries" on public.enquiries for select to authenticated using (public.is_staff());
create policy "staff update enquiries" on public.enquiries for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "staff read enquiry notes" on public.enquiry_notes for select to authenticated using (public.is_staff());
create policy "staff add enquiry notes" on public.enquiry_notes for insert to authenticated with check (public.is_staff() and author_id = auth.uid());

create policy "read own or team profiles" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "admin updates profiles" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin reads audit log" on public.audit_log for select to authenticated using (public.is_admin());

-- Functions: only signed-in users may call the role helpers / logger directly.
revoke execute on function public.log_event(text, text, text, jsonb) from public, anon;
grant execute on function public.log_event(text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------- storage (public images, admin uploads)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
on conflict (id) do nothing;

create policy "public reads media bucket" on storage.objects for select using (bucket_id = 'media');
create policy "admin uploads media" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy "admin updates media" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "admin deletes media" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());
