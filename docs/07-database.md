# Database

Supabase Postgres. The schema lives in `supabase/migrations/` and is applied in order by `npm run db:migrate`. Never edit a migration that has already run on the live database; add a new one.

## Tables

| Table | Holds | Public website | Staff | Admin |
|---|---|---|---|---|
| `profiles` | Staff accounts and roles | – | read | read, change role/active |
| `destinations` | Places shown on the site | read | read | write |
| `packages` | Tour packages (title, slug, description, duration, `base_price_paise`, inclusions, exclusions, images, `published`) | read published | read all | write |
| `itinerary_days` | Day-by-day plan per package | read (published packages) | read | write |
| `package_vehicles` | Vehicles offered per package, `price_paise` (null = on request) | read (published packages) | read | write |
| `vehicles` | Category, passenger and luggage capacity | read active | read | write |
| `vehicle_internal` | Fleet details and pricing rules (per km, minimum km, driver allowance, night charge, extra hour) | – | read | write |
| `vehicle_blocks` | Availability: dates when vehicles are out | – | read, write | read, write |
| `bookings` | Booking requests: reference, customer, package, travel date, travellers, pickup, `quoted_price_paise`, status, payment status, timestamps | – | read; update status, payment status, quote, assignee | same |
| `booking_items` | Line items per booking; the first is added automatically with the price listed at request time | – | read, write | read, write |
| `payments` | Payment and refund ledger; keeps `bookings.amount_paid_paise` and payment status up to date | – | read, add | read, add, delete |
| `payment_attempts` | Razorpay orders opened for a booking (server only; see [08](08-booking-workflow.md#online-payments)) | – | read | read |
| `whatsapp_messages` | Automatic WhatsApp messages sent per booking, logged before sending so none go twice | – | read | read |
| `gateway_events` | Razorpay webhook events already handled | – | – | – |
| `invoices` | One per confirmed booking: number (`YT/2026-27/0001`), total and issue time; issued by `issue_invoice()` on the server | – | read | read |
| `invoice_counters` | Last invoice number per financial year | – | – | – |
| `booking_notes`, `enquiry_notes` | Internal notes (can't be edited) | – | read, add | read, add |
| `enquiries` | Contact and WhatsApp enquiries | – | read; update status, follow-up, assignee | same |
| `reviews` | Customer reviews | read published | read | write |
| `coupons` | Discount codes | – | – | write |
| `site_settings` | Website content (brand, contact, hero, home, SEO, accounting) | read public keys | read | write |
| `blog_posts`, `media` | Blog and uploaded images | read published | read | write |
| `notifications` | One row per staff member for each new booking or enquiry | – | read own, mark read | read own, mark read |
| `audit_log` | Every change to the tables above, plus exports | – | – | read (nobody can edit or delete) |

The Phase 7 spec named some tables differently. They already existed under these names: `tour_packages` → `packages`, `vehicle_availability` → `vehicle_blocks`, `site_content` → `site_settings`, `audit_logs` → `audit_log`.

## Money

Every amount is a whole number of **paise** in a `bigint` column whose name ends in `_paise` (₹2,500 = `250000`). Forms take rupees and convert with `toPaise()`; pages show amounts with `formatPaise()` (`lib/format.ts`). The CSV export gives rupees.

## Security model

- **Grants first, then RLS.** `anon` and `authenticated` get only the privileges the app uses (migration `0002`). Updates to bookings, enquiries, profiles and notifications are limited to specific columns, so customer details, amounts paid and notification text can't be changed through the API at all.
- **Row-level security** is on for every table. Permissive policies give staff and admins their access; **restrictive** policies on customer, fleet and admin tables also require an active staff member (or admin). A future policy written too loosely still can't expose them.
- **Customer bookings stay private.** The public role has no access to `bookings`, `enquiries`, `payments` or `booking_items`. The website creates bookings through `/api/bookings`, which validates the request with zod and then inserts with the server-only secret key. The confirmation page needs a signed link.
- **Server-only credentials.** `SUPABASE_SECRET_KEY` is only read in `lib/supabase/clients.ts` (`server-only`). Admin pages use the signed-in user's session, so RLS applies on top of the role checks in `lib/auth.ts`.
- **Audit log.** A trigger records who changed what on every business table. Personal fields are recorded as "(changed)", never copied.
- **New tables must grant explicitly.** Default privileges were revoked, so a new table is invisible to the website and dashboard until a migration grants access, adds RLS policies and adds the audit trigger.

## Before production

```bash
npm run test:rls     # applies all migrations to an in-memory Postgres and checks anon, staff, deactivated staff and admin
```

Run it after every schema change. Then, on the real project:

1. Back up the database (Supabase → Database → Backups).
2. `npm run db:migrate`, then deploy straight away. Migrations `0002` (price columns) and `0003` (booking and payment status values) change names the old site code uses, so it stops working until the new code is live.
3. Sign in as a staff account and an admin account and try a booking, a payment and a content edit.
