# Booking workflow

## Steps

| # | Step | Where |
|---|---|---|
| 1 | Customer opens a package | `/packages/[slug]` |
| 2 | Picks a travel date and number of travellers | Package page booking card, carried into `/book` |
| 3 | Completes and submits the request (vehicle, pickup, contact details, consent) | `/book` → `POST /api/bookings` |
| 4 | Server validates every field | `bookingSchema` in `lib/validation.ts` |
| 5 | Server checks the package and the current price against the live database, not the page cache: published, group size within the package limits, vehicle offered and big enough, and the price the form showed still current. If the price has changed, the customer sees the new price and sends again (HTTP 409). | `checkOffer()` in `lib/server/bookings.ts` |
| 6 | Server creates a **pending** booking. The database links it to the package and records the listed price as its first line item. The owner gets an email alert and the customer an acknowledgement at the same time (see Notifications). | `createBooking()`, `notifyNewBooking()` |
| 7 | Customer gets a reference (`YT-YYMMDD-XXXX`) and a private link to their booking page | `/booking-confirmation/[ref]?t=…` |
| 8 | Customer can open WhatsApp with the reference prefilled | Confirmation page |
| 9 | Staff check availability for the date (fleet − blocked − already confirmed) and agree the price | `/admin/bookings/[id]` |
| 10 | Staff update the status: **contacted**, then **confirmed** (only with an agreed price) | Booking page → Status |
| 11 | Customer gets the update: an automatic email if they gave an address; otherwise staff send the prefilled WhatsApp message and tick "I've sent it". Their private page always shows the current status. | `notifyStatusChange()`, booking page → "Tell the customer" |
| 12 | After the trip, staff mark it **completed** (allowed only on or after the travel date) | Booking page → Status |

The rules in steps 10 and 12 are enforced by the database trigger `check_booking_status`, not just the dashboard.

## Statuses

Booking status and payment status are separate.

```
Booking:  pending ─→ contacted ─→ confirmed ─→ completed
             │            │            │
             └────────────┴────────────┴─→ cancelled
```

| Payment | Meaning | Set by |
|---|---|---|
| `unpaid` | Nothing received | Default |
| `pending` | Part paid, or a payment the customer says they made that isn't verified yet | Ledger (part payment) or staff |
| `paid` | Payments cover the agreed price | Ledger |
| `refunded` | Refunds brought the balance back to zero | Ledger |
| `failed` | A payment attempt failed | Staff (later: the payment gateway) |

"Ledger" means the `payments` table: recording a payment or refund on the booking page recalculates the amount paid and the payment status. Changing the agreed price re-checks it too.

## Notifications

Emails go through [Resend](https://resend.com) (`lib/server/notify.ts`), sent after the response so the customer isn't kept waiting. Without `RESEND_API_KEY` nothing is sent and the rest works as before.

| When | Owner | Customer |
|---|---|---|
| New booking request | Alert with all details, a WhatsApp link to the customer, and a dashboard link (to `OWNER_NOTIFY_EMAIL`, or the contact email in /admin/content) | Acknowledgement with the reference and their private booking link, if they gave an email |
| Status changed | – | Status email, if they gave an email; the booking is then marked as notified |

Each email has an idempotency key (reference + event), so retries never send duplicates. Email is optional on the booking form, so WhatsApp stays the main channel for customers without one.

Setup: create a Resend account, verify the business's domain (Resend → Domains, add the DNS records), create an API key, then set `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM` and `OWNER_NOTIFY_EMAIL` in Vercel. Until a domain is verified, Resend's test sender only delivers to the Resend account's own address.

Later: automatic WhatsApp messages need the WhatsApp Business (Cloud) API: a Meta Business account, approved message templates, and a number not used in the regular WhatsApp app.

## WhatsApp

- Links use click-to-chat: `https://wa.me/<number>?text=<encoded message>` (`waLink()` in `lib/whatsapp.ts`). The chat opens with the message typed in. Nothing is sent until the person taps send, which is why staff confirm with "I've sent it".
- The business number comes from **`WHATSAPP_BUSINESS_NUMBER`** (country code + number, digits only, e.g. `919876543210`). If it isn't set, the number saved in /admin/content is used.
- Message text sits in a URL that passes through browsers and WhatsApp's redirect, so it holds only what the chat needs: the reference, package, date, travellers, vehicle and status. **No names, phone numbers, pickup addresses or private booking links.** The customer's phone number appears only as the chat recipient in staff-side links.

## Future: online payments

Add a payment gateway (e.g. Razorpay) only once the manual workflow above has run reliably for a while. When it's added:

1. **Server-generated order.** The server creates the gateway order for the booking's outstanding amount (from `quoted_price_paise − amount_paid_paise`, never from the browser) and stores the order id on a new `payment_attempts` row (`booking_id`, `gateway_order_id` unique, `amount_paise`, `status`: created / authorised / captured / failed).
2. **Signature verification.** After checkout, the browser posts the gateway's payment id and signature to the server, which verifies the HMAC with the server-only key secret. A "success" message from the browser is never treated as proof of payment.
3. **Verified webhooks.** A webhook route verifies the webhook signature on the raw request body before reading it. Webhooks are the source of truth: they catch payments where the customer closed the browser.
4. **Idempotent processing.** `payments` gets a unique `gateway_payment_id`. Each capture is inserted with `on conflict do nothing`, so the browser callback and the webhook (or a retried webhook) can't record the same payment twice. Store processed webhook event ids too.
5. **Transaction records.** Captured payments become rows in the existing `payments` ledger (`method = 'card'/'upi'`, `transaction_ref` = gateway payment id), so totals and payment status update through the existing trigger. Failed attempts set `payment_status = 'failed'`.
6. **Refunds.** Issued through the gateway API from the dashboard (admin only); the refund webhook inserts a `refund` row in the ledger.
7. **Reconciliation.** A daily job lists the gateway's captured payments and refunds and compares them with `payments`, flagging any difference for an admin. Booking status still changes only through the workflow above.
