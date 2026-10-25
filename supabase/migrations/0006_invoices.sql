-- Yatra Travels: invoices for confirmed bookings.
--   One invoice per booking, numbered consecutively per Indian financial year (April–March): YT/2026-27/0001.
--   Issued when staff confirm a booking (it needs an agreed price) and never renumbered or changed afterwards;
--   the PDF is rebuilt from this record and the payments ledger whenever it's sent or downloaded.

create table public.invoice_counters (
  financial_year text primary key check (financial_year ~ '^\d{4}-\d{2}$'),
  last_number integer not null default 0
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  number text not null unique,
  financial_year text not null,
  total_paise bigint not null check (total_paise >= 0),
  issued_at timestamptz not null default now()
);

-- Issues the booking's invoice, or returns the one it already has. The booking row is locked first, so two
-- simultaneous calls can't both take a number.
create function public.issue_invoice(p_booking uuid) returns public.invoices
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices;
  b record;
  fy text;
  n integer;
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select id, status, quoted_price_paise into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'Booking not found' using errcode = 'no_data_found'; end if;
  select * into inv from public.invoices where booking_id = p_booking;
  if found then return inv; end if;
  if b.status not in ('confirmed', 'completed') or b.quoted_price_paise is null then
    raise exception 'An invoice needs a confirmed booking with an agreed price' using errcode = 'check_violation';
  end if;

  fy := case when extract(month from today) >= 4
    then extract(year from today)::text || '-' || right((extract(year from today) + 1)::text, 2)
    else (extract(year from today) - 1)::text || '-' || right(extract(year from today)::text, 2) end;
  insert into public.invoice_counters (financial_year, last_number) values (fy, 1)
    on conflict (financial_year) do update set last_number = public.invoice_counters.last_number + 1
    returning last_number into n;
  insert into public.invoices (booking_id, number, financial_year, total_paise)
    values (p_booking, 'YT/' || fy || '/' || lpad(n::text, 4, '0'), fy, b.quoted_price_paise)
    returning * into inv;
  return inv;
end $$;

alter table public.invoice_counters enable row level security;
alter table public.invoices enable row level security;
create policy "staff read invoices" on public.invoices for select to authenticated using (public.is_staff());

revoke all on public.invoice_counters, public.invoices from anon, authenticated;
grant all on public.invoice_counters, public.invoices to service_role;
grant select on public.invoices to authenticated;
revoke execute on function public.issue_invoice(uuid) from public, anon, authenticated;
grant execute on function public.issue_invoice(uuid) to service_role;

create trigger invoices_audit after insert or update or delete on public.invoices for each row execute function public.audit_row();
