-- Yatra Travels: booking workflow.
--   Booking status:  pending → contacted → confirmed → completed, and any open state → cancelled.
--   Payment status:  unpaid, pending (payment started or part paid), paid, refunded, failed. Kept separate from the booking status.
-- Old values are mapped: requested → pending, advance_paid → pending, not_applicable → unpaid.

-- ---------------------------------------------------------------- status types (recreated so old values can go)
alter table public.bookings alter column status drop default, alter column payment_status drop default;

alter type public.booking_status rename to booking_status_old;
create type public.booking_status as enum ('pending', 'contacted', 'confirmed', 'completed', 'cancelled');
alter table public.bookings alter column status type public.booking_status
  using (case status::text when 'requested' then 'pending' else status::text end)::public.booking_status;
drop type public.booking_status_old;

alter type public.payment_status rename to payment_status_old;
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'refunded', 'failed');
alter table public.bookings alter column payment_status type public.payment_status
  using (case payment_status::text when 'advance_paid' then 'pending' when 'not_applicable' then 'unpaid' else payment_status::text end)::public.payment_status;
drop type public.payment_status_old;

alter table public.bookings alter column status set default 'pending', alter column payment_status set default 'unpaid';

-- Which status the customer was last told about (click-to-chat can't confirm delivery, so staff mark it).
alter table public.bookings
  add column status_changed_at timestamptz not null default now(),
  add column customer_notified_status public.booking_status default 'pending',  -- the confirmation page tells them on submit
  add column customer_notified_at timestamptz default now();
grant update (customer_notified_status, customer_notified_at) on public.bookings to authenticated;

-- ---------------------------------------------------------------- workflow rules
create or replace function public.check_booking_status() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('contacted', 'confirmed', 'cancelled')) or
      (old.status = 'contacted' and new.status in ('confirmed', 'cancelled')) or
      (old.status = 'confirmed' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'Booking status cannot change from % to %', old.status, new.status using errcode = 'check_violation';
    end if;
    -- Staff confirm only after agreeing the price with the customer.
    if new.status = 'confirmed' and new.quoted_price_paise is null then
      raise exception 'Add the agreed price before confirming the booking' using errcode = 'check_violation';
    end if;
    -- A trip is completed after it has happened.
    if new.status = 'completed' and new.travel_date > (now() at time zone 'Asia/Kolkata')::date then
      raise exception 'A trip can be marked completed only on or after its travel date' using errcode = 'check_violation';
    end if;
    new.status_changed_at := now();
  end if;
  -- Customer-submitted fields are never edited from the dashboard.
  if (new.reference, new.idempotency_key, new.consent_at, new.created_at) is distinct from
     (old.reference, old.idempotency_key, old.consent_at, old.created_at) then
    raise exception 'Booking reference and consent fields are read-only' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- Payment status follows the ledger: part paid → pending, the agreed price covered → paid, refunded to zero → refunded.
-- "failed" (set by staff, later by a payment gateway) stays until money actually arrives.
create function public.derive_payment_status(current public.payment_status, paid bigint, quote bigint, refunds boolean)
returns public.payment_status language sql immutable set search_path = '' as $$
  select case
    when paid <= 0 and refunds then 'refunded'
    when paid <= 0 and current = 'failed' then 'failed'
    when paid <= 0 then 'unpaid'
    when quote is not null and paid >= quote then 'paid'
    else 'pending' end::public.payment_status
$$;

create or replace function public.sync_booking_payments() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  bid uuid := coalesce(new.booking_id, old.booking_id);
  total bigint;
  refunds boolean;
begin
  select coalesce(sum(case kind when 'refund' then -amount_paise else amount_paise end), 0), coalesce(bool_or(kind = 'refund'), false)
    into total, refunds from public.payments where booking_id = bid;
  update public.bookings b set amount_paid_paise = total, payment_status = public.derive_payment_status(b.payment_status, total, b.quoted_price_paise, refunds)
  where b.id = bid;
  return null;
end $$;

-- A new or corrected agreed price re-checks whether the booking is now fully paid.
create function public.recheck_payment_on_quote() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.amount_paid_paise > 0 then
    new.payment_status := public.derive_payment_status(new.payment_status, new.amount_paid_paise, new.quoted_price_paise,
      exists (select 1 from public.payments where booking_id = new.id and kind = 'refund'));
  end if;
  return new;
end $$;
create trigger bookings_quote_payment before update of quoted_price_paise on public.bookings
  for each row when (new.quoted_price_paise is distinct from old.quoted_price_paise) execute function public.recheck_payment_on_quote();

revoke execute on function public.derive_payment_status(public.payment_status, bigint, bigint, boolean), public.recheck_payment_on_quote() from public, anon, authenticated;
grant execute on function public.derive_payment_status(public.payment_status, bigint, bigint, boolean), public.recheck_payment_on_quote() to service_role;

-- Existing bookings were handled by phone before this tracking existed: treat their current status as already told.
alter table public.bookings disable trigger user;
update public.bookings set customer_notified_status = status, customer_notified_at = updated_at;
alter table public.bookings enable trigger user;

create index bookings_vehicle_date_idx on public.bookings (vehicle, travel_date) where status = 'confirmed';
