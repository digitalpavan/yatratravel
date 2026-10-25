-- Yatra Travels: money in paise, itinerary days, booking items, payments, reviews, coupons, notifications,
-- explicit grants and restrictive policies.
--
-- Money: every amount is a bigint number of paise (₹1 = 100). Never floats, never rupees with decimals.
-- Grants: nothing in public is exposed by default any more. Supabase grants anon/authenticated everything and
-- relies on RLS alone; here each table gets only the privileges the app needs, and RLS filters rows on top.
-- New tables in later migrations must grant explicitly.

-- ---------------------------------------------------------------- types
create type public.payment_kind as enum ('payment', 'refund');
create type public.payment_method as enum ('cash', 'upi', 'card', 'bank_transfer', 'other');
create type public.booking_item_kind as enum ('package', 'vehicle', 'extra', 'discount');
create type public.discount_type as enum ('percent', 'flat');

-- ---------------------------------------------------------------- money in paise
alter table public.package_vehicles rename column price to price_paise;
alter table public.package_vehicles alter column price_paise type bigint using round(price_paise * 100);

alter table public.vehicle_internal rename column per_km_rate to per_km_rate_paise;
alter table public.vehicle_internal rename column driver_allowance_per_day to driver_allowance_per_day_paise;
alter table public.vehicle_internal rename column night_charge to night_charge_paise;
alter table public.vehicle_internal rename column extra_hour_rate to extra_hour_rate_paise;
alter table public.vehicle_internal
  alter column per_km_rate_paise type bigint using round(per_km_rate_paise * 100),
  alter column driver_allowance_per_day_paise type bigint using round(driver_allowance_per_day_paise * 100),
  alter column night_charge_paise type bigint using round(night_charge_paise * 100),
  alter column extra_hour_rate_paise type bigint using round(extra_hour_rate_paise * 100),
  add check (coalesce(per_km_rate_paise, 0) >= 0 and coalesce(driver_allowance_per_day_paise, 0) >= 0
             and coalesce(night_charge_paise, 0) >= 0 and coalesce(extra_hour_rate_paise, 0) >= 0);

-- "From" price shown on the website: the lowest confirmed vehicle price, kept in step by a trigger below.
alter table public.packages add column base_price_paise bigint check (base_price_paise is null or base_price_paise >= 0);

-- ---------------------------------------------------------------- itinerary days (was packages.itinerary jsonb)
create table public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete cascade,
  day integer not null check (day between 1 and 60),
  title text not null default '' check (length(title) <= 120),
  stops jsonb not null default '[]' check (jsonb_typeof(stops) = 'array'),
  unique (package_id, day)
);

insert into public.itinerary_days (package_id, day, title, stops)
select p.id, coalesce((d.value ->> 'day')::int, d.ord::int), left(coalesce(d.value ->> 'title', ''), 120), coalesce(d.value -> 'stops', '[]')
from public.packages p, jsonb_array_elements(p.itinerary) with ordinality as d(value, ord)
on conflict do nothing;
alter table public.packages drop column itinerary;

-- ---------------------------------------------------------------- bookings: package link, quote, payments
alter table public.bookings add column package_id uuid references public.packages (id) on delete set null;
alter table public.bookings rename column amount_quoted to quoted_price_paise;
alter table public.bookings alter column quoted_price_paise type bigint using round(quoted_price_paise * 100);
alter table public.bookings add check (quoted_price_paise is null or quoted_price_paise >= 0);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  kind public.payment_kind not null default 'payment',
  amount_paise bigint not null check (amount_paise > 0),
  method public.payment_method not null,
  transaction_ref text not null default '' check (length(transaction_ref) <= 100),
  received_on date not null default current_date,
  notes text not null default '' check (length(notes) <= 500),
  recorded_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);

-- Amounts typed into the old "Received" box become one payment each, so the total is unchanged.
insert into public.payments (booking_id, amount_paise, method, received_on, notes, recorded_by)
select id, round(amount_paid * 100), 'other', created_at::date, 'Recorded before payment history was kept', null
from public.bookings where amount_paid > 0;

alter table public.bookings rename column amount_paid to amount_paid_paise;
alter table public.bookings alter column amount_paid_paise type bigint using coalesce(round(amount_paid_paise * 100), 0);
alter table public.bookings alter column amount_paid_paise set default 0, alter column amount_paid_paise set not null;

-- One line per thing being sold. "discount" lines reduce the total; amount_paise is null while the price is on request.
create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind public.booking_item_kind not null default 'extra',
  description text not null check (length(description) between 1 and 200),
  package_id uuid references public.packages (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  quantity integer not null default 1 check (quantity between 1 and 100),
  unit_price_paise bigint check (unit_price_paise is null or unit_price_paise >= 0),
  amount_paise bigint generated always as (quantity * unit_price_paise) stored,
  created_at timestamptz not null default now()
);
create index booking_items_booking_idx on public.booking_items (booking_id);

-- ---------------------------------------------------------------- reviews (were the "testimonials" setting)
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  city text not null default '' check (length(city) <= 60),
  quote text not null check (length(quote) between 5 and 500),
  package_label text not null default '' check (length(package_label) <= 80),
  rating smallint check (rating between 1 and 5),
  published boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.reviews (name, city, quote, package_label, published, sort)
select left(t.value ->> 'name', 80), left(coalesce(t.value ->> 'city', ''), 60), left(t.value ->> 'quote', 500),
       left(coalesce(t.value ->> 'package', ''), 80), true, t.ord::int
from public.site_settings s, jsonb_array_elements(s.value -> 'items') with ordinality as t(value, ord)
where s.key = 'testimonials' and length(t.value ->> 'name') > 0 and length(t.value ->> 'quote') >= 5;
delete from public.site_settings where key = 'testimonials';

-- ---------------------------------------------------------------- coupons (admin-managed; checked on the server only)
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{3,30}$'),
  description text not null default '' check (length(description) <= 200),
  discount_type public.discount_type not null,
  percent_off smallint,
  amount_off_paise bigint,
  min_order_paise bigint not null default 0 check (min_order_paise >= 0),
  valid_from date,
  valid_until date,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemptions integer not null default 0 check (redemptions >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((discount_type = 'percent' and percent_off between 1 and 100 and amount_off_paise is null)
      or (discount_type = 'flat' and amount_off_paise > 0 and percent_off is null)),
  check (valid_until is null or valid_from is null or valid_until >= valid_from),
  check (max_redemptions is null or redemptions <= max_redemptions)
);

-- ---------------------------------------------------------------- notifications (one row per staff member)
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc) where read_at is null;

-- ---------------------------------------------------------------- triggers
create trigger coupons_touch before update on public.coupons for each row execute function public.touch_updated_at();

-- Keeps packages.base_price_paise equal to the lowest confirmed vehicle price.
create function public.sync_base_price() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pid uuid := coalesce(new.package_id, old.package_id);
begin
  update public.packages p set base_price_paise = (select min(price_paise) from public.package_vehicles where package_id = pid)
  where p.id = pid and p.base_price_paise is distinct from (select min(price_paise) from public.package_vehicles where package_id = pid);
  return null;
end $$;
create trigger package_vehicles_base_price after insert or update or delete on public.package_vehicles
  for each row execute function public.sync_base_price();

-- Links a new booking to its package by slug.
create function public.link_booking_package() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.package_id := coalesce(new.package_id, (select id from public.packages where slug = new.package_slug));
  return new;
end $$;
create trigger bookings_link_package before insert on public.bookings for each row execute function public.link_booking_package();

-- Records what the customer asked for, at the price listed when they asked (null = on request).
create function public.add_requested_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.booking_items (booking_id, kind, description, package_id, vehicle_id, unit_price_paise)
  select new.id, 'package', left(new.package_title || coalesce(' · ' || v.name, ''), 200), new.package_id, v.id, pv.price_paise
  from (select 1) one
  left join public.vehicles v on v.slug = new.vehicle
  left join public.package_vehicles pv on pv.package_id = new.package_id and pv.vehicle_id = v.id;
  return null;
end $$;
create trigger bookings_requested_item after insert on public.bookings for each row execute function public.add_requested_item();

-- Tells every active staff member about a new booking request or enquiry.
create function public.notify_staff() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_id, kind, title, body, link)
  select p.id,
         case tg_table_name when 'bookings' then 'booking' else 'enquiry' end,
         case tg_table_name when 'bookings' then 'New booking request ' || (to_jsonb(new) ->> 'reference') else 'New ' || (to_jsonb(new) ->> 'source') || ' enquiry' end,
         case tg_table_name when 'bookings' then (to_jsonb(new) ->> 'package_title') || ', ' || (to_jsonb(new) ->> 'travel_date') else '' end,
         '/admin/' || tg_table_name || '/' || new.id
  from public.profiles p where p.active;
  return null;
end $$;
create trigger bookings_notify after insert on public.bookings for each row execute function public.notify_staff();
create trigger enquiries_notify after insert on public.enquiries for each row execute function public.notify_staff();

-- Keeps bookings.amount_paid_paise equal to payments minus refunds, and moves payment_status along with it.
-- "not_applicable" is left alone; it is only ever set by staff.
create function public.sync_booking_payments() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  bid uuid := coalesce(new.booking_id, old.booking_id);
  total bigint;
  refunds boolean;
begin
  select coalesce(sum(case kind when 'refund' then -amount_paise else amount_paise end), 0), bool_or(kind = 'refund')
    into total, refunds from public.payments where booking_id = bid;
  update public.bookings b set
    amount_paid_paise = total,
    payment_status = case
      when b.payment_status = 'not_applicable' then b.payment_status
      when total <= 0 and refunds then 'refunded'
      when total <= 0 then 'unpaid'
      when b.quoted_price_paise is not null and total >= b.quoted_price_paise then 'paid'
      else 'advance_paid' end
  where b.id = bid;
  return null;
end $$;
create trigger payments_sync after insert or delete on public.payments for each row execute function public.sync_booking_payments();

-- Backfill quietly (no audit noise): base prices, package links and the requested item for existing bookings.
alter table public.packages disable trigger user;
update public.packages p set base_price_paise = (select min(price_paise) from public.package_vehicles where package_id = p.id);
alter table public.packages enable trigger user;
alter table public.bookings disable trigger user;
update public.bookings b set package_id = p.id from public.packages p where p.slug = b.package_slug;
alter table public.bookings enable trigger user;
insert into public.booking_items (booking_id, kind, description, package_id, vehicle_id, unit_price_paise, created_at)
select b.id, 'package', left(b.package_title || coalesce(' · ' || v.name, ''), 200), b.package_id, v.id, pv.price_paise, b.created_at
from public.bookings b
left join public.vehicles v on v.slug = b.vehicle
left join public.package_vehicles pv on pv.package_id = b.package_id and pv.vehicle_id = v.id;

-- ---------------------------------------------------------------- audit log
-- Same as before, with the new private columns (stops, transaction_ref, notes) listed.
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  changed jsonb := '{}';
  k text;
  private_cols text[] := array['name', 'phone', 'email', 'pickup', 'requests', 'message', 'body', 'overview', 'faqs', 'stops', 'transaction_ref', 'notes'];
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
               when tg_op = 'INSERT' then jsonb_build_object('label', coalesce(to_jsonb(new) ->> 'title', to_jsonb(new) ->> 'name', to_jsonb(new) ->> 'reference', to_jsonb(new) ->> 'key', to_jsonb(new) ->> 'code', to_jsonb(new) ->> 'amount_paise'))
               else jsonb_build_object('label', coalesce(to_jsonb(old) ->> 'title', to_jsonb(old) ->> 'name', to_jsonb(old) ->> 'key', to_jsonb(old) ->> 'code', to_jsonb(old) ->> 'amount_paise')) end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['itinerary_days', 'booking_items', 'payments', 'reviews', 'coupons']
  loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- row-level security for the new tables
alter table public.itinerary_days enable row level security;
alter table public.booking_items enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.coupons enable row level security;
alter table public.notifications enable row level security;

create policy "read itinerary of visible packages" on public.itinerary_days for select
  using (exists (select 1 from public.packages p where p.id = package_id and (p.published or public.is_staff())));
create policy "admin writes itinerary" on public.itinerary_days for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read published reviews" on public.reviews for select using (published or public.is_staff());
create policy "admin writes reviews" on public.reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "staff manage booking items" on public.booking_items for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Payments are a ledger: staff add entries as themselves; a wrong entry is corrected with a refund, or deleted by an admin.
create policy "staff read payments" on public.payments for select to authenticated using (public.is_staff());
create policy "staff record payments" on public.payments for insert to authenticated with check (public.is_staff() and recorded_by = auth.uid());
create policy "admin deletes payments" on public.payments for delete to authenticated using (public.is_admin());

create policy "admin manages coupons" on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read own notifications" on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy "mark own notifications read" on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Restrictive policies are ANDed with every permissive one: even a future policy written too loosely
-- can't open customer, fleet or admin data to anyone but an active staff member (or admin).
do $$
declare t text;
begin
  foreach t in array array['bookings', 'booking_notes', 'booking_items', 'payments', 'enquiries', 'enquiry_notes', 'vehicle_internal', 'vehicle_blocks', 'notifications']
  loop
    execute format('create policy "active staff only" on public.%I as restrictive for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
  foreach t in array array['audit_log', 'coupons']
  loop
    execute format('create policy "admins only" on public.%I as restrictive for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- explicit grants
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Public website: read-only catalogue and content (RLS hides drafts and private settings).
grant select on public.destinations, public.vehicles, public.packages, public.package_vehicles, public.itinerary_days,
                public.media, public.site_settings, public.blog_posts, public.reviews to anon, authenticated;

-- Dashboard (RLS decides staff vs admin).
grant insert, update, delete on public.destinations, public.vehicles, public.packages, public.package_vehicles, public.itinerary_days,
                                public.media, public.site_settings, public.blog_posts, public.reviews to authenticated;
grant select, insert, update, delete on public.vehicle_internal, public.vehicle_blocks, public.booking_items, public.coupons to authenticated;
grant select on public.profiles, public.bookings, public.enquiries, public.booking_notes, public.enquiry_notes,
                public.payments, public.notifications, public.audit_log to authenticated;
grant insert on public.booking_notes, public.enquiry_notes, public.payments to authenticated;
grant delete on public.payments to authenticated;
-- Column-level: customer-submitted details, amounts paid and staff flags can't be changed through the API at all.
grant update (status, payment_status, quoted_price_paise, assigned_to) on public.bookings to authenticated;
grant update (status, next_follow_up, assigned_to) on public.enquiries to authenticated;
grant update (full_name, role, active) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Policies call the role helpers, so both roles need them; only signed-in staff may log events.
grant execute on function public.current_app_role(), public.is_staff(), public.is_admin() to anon, authenticated;
grant execute on function public.log_event(text, text, text, jsonb) to authenticated;
