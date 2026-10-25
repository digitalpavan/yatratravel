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
| 7a | **When online payment is on and the package has a fixed price for the chosen vehicle:** that price becomes the agreed price, Razorpay checkout opens, and the customer pays the full amount (see Online payments). Owner and customer get a WhatsApp message and email once it's paid. If they close checkout, their booking page shows **Pay now**. | `/book`, `/api/payments/*` |
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

| Online payment received | WhatsApp (to `WHATSAPP_ADMIN_NUMBERS`) and email, with the trip, pickup and customer's number | WhatsApp, and email if they gave one, with the amount and their booking link |

Automatic WhatsApp messages go through Meta's WhatsApp Cloud API (`lib/server/whatsapp-cloud.ts`). Each message is logged in `whatsapp_messages` before it is sent, one per booking, event and number, so a retried webhook never sends it twice. Without `WHATSAPP_CLOUD_TOKEN` nothing is sent.

## WhatsApp

- Links use click-to-chat: `https://wa.me/<number>?text=<encoded message>` (`waLink()` in `lib/whatsapp.ts`). The chat opens with the message typed in. Nothing is sent until the person taps send, which is why staff confirm with "I've sent it".
- The business number comes from **`WHATSAPP_BUSINESS_NUMBER`** (country code + number, digits only, e.g. `919876543210`). If it isn't set, the number saved in /admin/content is used.
- Message text sits in a URL that passes through browsers and WhatsApp's redirect, so it holds only what the chat needs: the reference, package, date, travellers, vehicle and status. **No names, phone numbers, pickup addresses or private booking links.** The customer's phone number appears only as the chat recipient in staff-side links.

## Online payments

Razorpay Standard Checkout (`lib/server/razorpay.ts`, `lib/server/payments.ts`, `components/Razorpay.tsx`). It offers **UPI** (UPI apps on phones, a **QR code to scan** on computers, or a UPI ID), **debit and credit cards**, **netbanking** and wallets, whichever are enabled on the Razorpay account. Card and bank details are entered in Razorpay's window and never reach this site.

### Who pays what

- The customer pays the **full listed price** for the package and vehicle when booking.
- Only packages with **"Customers pay online when booking"** ticked (Packages → edit → Prices) and a price for the chosen vehicle. It is off for per-km and on-request packages (Outstation, Customised itinerary); those stay requests.
- "Suggest for me" has no price, so it stays a request.
- When staff agree a price on any other booking, the customer's booking page shows **Pay now** for the amount due.

### How a payment is checked

1. **Server-made order.** `startPayment()` creates the Razorpay order for `quoted_price_paise − amount_paid_paise`, read from the database, never from the browser. It is stored in `payment_attempts`. Reopening checkout within 6 hours reuses the unpaid order.
2. **Signature check.** After checkout, the browser posts the payment id and signature to `/api/payments/verify`. The server checks the HMAC with the key secret, checks that the order belongs to that booking, then **fetches the payment from Razorpay** and records it only if Razorpay says it is captured (an authorised payment is captured first).
3. **Webhook.** `/api/payments/webhook` checks the webhook signature on the raw body, then handles `payment.captured` (record the payment) and `payment.failed` (mark the attempt failed and the booking's payment `failed` until money arrives). It catches payments where the customer closed the browser before returning.
4. **Recorded once.** `payments.gateway_payment_id` is unique, so the checkout callback and the webhook can't both record a payment. Only the call that records it sends the notifications. Handled webhook event ids are kept in `gateway_events`.
5. **Ledger.** Each payment is a normal `payments` row (method `upi`, `card`, `netbanking` or `wallet`; reference = Razorpay payment id; note "Paid online"). The existing trigger updates the amount paid and the payment status. The booking status still changes only when staff move it.
6. **Refunds** are issued in the Razorpay dashboard, then recorded on the booking page as a refund.

### Setting up Razorpay

1. Create a Razorpay account and complete KYC (business PAN, bank account, website URL).
2. Settings → Payment methods: make sure UPI, Cards and Netbanking are on. Settings → Payment capture: **Automatic**.
3. Test first: switch the dashboard to **Test mode**, then Settings → API keys → Generate key. Put the key id and secret in Vercel as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
4. Settings → Webhooks → Add: URL `https://<your domain>/api/payments/webhook`, a secret of your choice (the same value goes in `RAZORPAY_WEBHOOK_SECRET`), events **payment.captured** and **payment.failed**.
5. Redeploy and book a trip using Razorpay's test UPI ID or test card. Check that the booking shows **Paid** in the dashboard.
6. Going live: repeat steps 3 and 4 in **Live mode** (live keys and a live webhook) and redeploy.

### Setting up WhatsApp messages (Meta WhatsApp Cloud API)

1. Create a Meta Business account and verify the business (business.facebook.com → Settings → Business info).
2. developers.facebook.com → Create app → Business type → add **WhatsApp**. Add a phone number that is **not** used in the WhatsApp or WhatsApp Business app, and verify it.
3. Create a system user with the `whatsapp_business_messaging` permission and generate a **permanent token**. Set `WHATSAPP_CLOUD_TOKEN`, and `WHATSAPP_PHONE_NUMBER_ID` from WhatsApp → API setup.
4. Set `WHATSAPP_ADMIN_NUMBERS` to the owner's number(s), e.g. `919490996614`.
5. In WhatsApp Manager → Message templates, create these two templates, category **Utility**, language **English** (`en`). The names and the number and order of `{{n}}` placeholders must match.

**`booking_payment_received`** (to the customer):

> Namaste {{1}}, we have received your payment of {{2}} for booking {{3}} ({{4}} on {{5}}). We will send your driver's name, number and vehicle on WhatsApp before your trip. View your booking: {{6}} Thank you for travelling with us.

(Meta rejects a template that starts or ends with a placeholder, so keep the closing sentence.)

Placeholders: first name, amount, reference, package, travel date, private booking link.

**`new_paid_booking`** (to the owner):

> New paid booking {{1}}: {{2}} on {{3}}. Vehicle: {{4}}, {{5}} travellers. Paid {{6}} online. Customer: {{7}}, {{8}}. Pickup: {{9}}. Please assign a driver and confirm in the dashboard.

Placeholders: reference, package, travel date, vehicle, travellers, amount, customer name, customer mobile, pickup.

Meta usually approves Utility templates within minutes to a day. Until they are approved, messages fail and are logged as `failed` in `whatsapp_messages`; email still goes out.
