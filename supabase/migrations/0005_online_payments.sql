-- Yatra Travels: online payments (Razorpay) and automatic WhatsApp messages (Meta WhatsApp Cloud API).
--   The customer pays the listed price when booking. The server creates each gateway order for the outstanding amount,
--   verifies every payment with Razorpay before recording it, and records each gateway payment once only.
--   Booking status still changes only through the staff workflow; payment status follows the ledger as before.

-- Packages priced per km or on request can't be paid for upfront; admins switch this per package.
alter table public.packages add column pay_online boolean not null default true;
update public.packages set pay_online = false where price_unit ilike '%per km%' or category = 'custom';

alter type public.payment_method add value if not exists 'netbanking';
alter type public.payment_method add value if not exists 'wallet';

-- One ledger row per gateway payment: the checkout callback and the webhook can both report it, only one insert wins.
alter table public.payments add column gateway_payment_id text unique check (length(gateway_payment_id) <= 64);

-- Each gateway order created for a booking. Written by the server only (secret key); staff can read them.
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  gateway text not null default 'razorpay',
  gateway_order_id text not null unique check (length(gateway_order_id) <= 64),
  amount_paise bigint not null check (amount_paise > 0),
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  gateway_payment_id text check (length(gateway_payment_id) <= 64),
  error text not null default '' check (length(error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_attempts_booking_idx on public.payment_attempts (booking_id, created_at desc);
create trigger payment_attempts_touch before update on public.payment_attempts for each row execute function public.touch_updated_at();

-- Webhook events already handled (Razorpay retries deliveries until it gets a 2xx).
create table public.gateway_events (
  id text primary key check (length(id) <= 64),
  event text not null,
  received_at timestamptz not null default now()
);

-- Automatic WhatsApp messages. The row is written before sending, so the same message is never sent twice.
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  event text not null check (length(event) <= 60),
  recipient text not null check (recipient in ('customer', 'owner')),
  to_number text not null check (to_number ~ '^\d{10,15}$'),
  template text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  provider_message_id text,
  error text not null default '' check (length(error) <= 300),
  created_at timestamptz not null default now(),
  unique (booking_id, event, to_number)
);

alter table public.payment_attempts enable row level security;
alter table public.gateway_events enable row level security;
alter table public.whatsapp_messages enable row level security;
create policy "staff read payment attempts" on public.payment_attempts for select to authenticated using (public.is_staff());
create policy "staff read whatsapp messages" on public.whatsapp_messages for select to authenticated using (public.is_staff());
-- gateway_events: no policies, server only.

revoke all on public.payment_attempts, public.gateway_events, public.whatsapp_messages from anon, authenticated;
grant all on public.payment_attempts, public.gateway_events, public.whatsapp_messages to service_role;
grant select on public.payment_attempts, public.whatsapp_messages to authenticated;
