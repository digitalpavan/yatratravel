# Yatra Travels

Website and admin dashboard for Yatra Travels: Tirupati temple tours, Tirumala transport, day trips and cabs.

**Live site:** https://yatratravel.vercel.app
**Admin:** https://yatratravel.vercel.app/admin/login

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Supabase: Postgres with row-level security, auth, and image storage
- Motion for animations, zod for validation, lucide-react icons
- Hosted on Vercel

## Pages

| Public | |
|---|---|
| `/` | Home |
| `/packages`, `/packages/[slug]` | Packages with search and filters, and package details |
| `/tirupati-darshan` | Tirumala darshan travel guide |
| `/vehicles` | Fleet and capacities |
| `/book` | Booking request form → `/booking-confirmation/[reference]` (private signed link) |
| `/about`, `/contact`, `/privacy` | Company pages |
| `/blog`, `/blog/[slug]` | Travel guides (Markdown in `content/blog`) |

| Admin (sign-in required) | |
|---|---|
| `/admin` | Dashboard |
| `/admin/bookings`, `/admin/enquiries` | Manage bookings (CSV export) and enquiries |
| `/admin/packages`, `/admin/vehicles` | Edit packages, prices and vehicles |
| `/admin/content`, `/admin/blog` | Site content, contact details and blog posts |
| `/admin/users` | Staff accounts and roles (admin only) |
| `/admin/audit` | Audit log of every change (admin only) |
| `/admin/account` | Change your password |

Roles: **admin** (everything) and **staff** (bookings, enquiries, content). Every page and action checks the role on the server, and the database enforces it again with RLS.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the Supabase keys
npm run dev                  # http://localhost:3000
```

No Supabase project yet? Set `YATRA_DEMO_DATA=1` in `.env.local` to run with built-in sample data.

## Environment variables

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Public site address (canonical links, sitemap, email links) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public key, safe in the browser |
| `SUPABASE_SECRET_KEY` | Server-only, full database access |
| `BOOKING_TOKEN_SECRET` | Signs booking confirmation links (`openssl rand -hex 32`) |
| `WHATSAPP_BUSINESS_NUMBER` | Business WhatsApp number for click-to-chat links, digits with country code (e.g. `919876543210`) |
| `GOOGLE_SITE_VERIFICATION` | Optional. Search Console HTML-tag verification code |
| `NEXT_PUBLIC_SPEED_INSIGHTS` | Optional. `1` turns on real-user Core Web Vitals (enable Speed Insights in Vercel first) |
| `GMAIL_USER` | Gmail address that sends booking emails (confirmation with invoice PDF, alerts) |
| `GMAIL_APP_PASSWORD` | 16-character Google App Password for that account (not the normal password) |
| `RESEND_API_KEY` | Optional alternative to Gmail for booking emails |
| `NOTIFY_EMAIL_FROM` | Sender for those emails, on a domain verified in Resend |
| `OWNER_NOTIFY_EMAIL` | Who gets new-booking alerts (comma-separated); defaults to the contact email in /admin/content |
| `RAZORPAY_KEY_ID` | Optional. Turns on online payment when booking (UPI and QR, cards, netbanking); `rzp_test_…` or `rzp_live_…` |
| `RAZORPAY_KEY_SECRET` | Server-only secret for the Razorpay API and checkout signatures |
| `RAZORPAY_WEBHOOK_SECRET` | Secret of the Razorpay webhook (`/api/payments/webhook`) |
| `WHATSAPP_CLOUD_TOKEN` | Optional. Meta WhatsApp Cloud API token: turns on automatic WhatsApp messages after payment |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number id from WhatsApp Manager → API setup |
| `WHATSAPP_ADMIN_NUMBERS` | Who gets owner WhatsApp alerts (comma-separated, with country code); defaults to the business WhatsApp number |
| `INVOICE_GSTIN` | Optional. GSTIN printed on invoice PDFs |
| `SUPABASE_DB_URL` | Only for the database scripts below, not needed on Vercel |

Never commit `.env.local`. It is git-ignored.

## Database

```bash
npm run db:migrate                                    # apply supabase/migrations
npm run db:seed                                       # load packages, vehicles, settings and blog from content/
npm run admin:create -- you@example.com "Your Name"   # first admin, prints a one-time password
npm run test:rls                                      # check grants and row-level security for every role
```

Tables, the access each role has, and how money is stored (paise) are described in [docs/07-database.md](docs/07-database.md).

## Deploy

The Vercel project `yatratravel` serves the site. Set the environment variables above in Vercel → Settings → Environment Variables, then deploy with `npx vercel deploy --prod`, or push to `main` if the GitHub integration is connected.

In Supabase → Authentication → URL Configuration, set the Site URL to the live address so password-reset emails link to the right place.

## Other scripts

- `npm run images`: rebuild optimised images from `assets/` (`images:check` only checks them)
- `npm run typecheck`: TypeScript check

## Docs

- [Requirements](docs/01-requirements.md)
- [Design system](design/README.md)
- [Image assets](docs/03-image-assets.md)
- [Website](docs/04-website.md)
- [Motion](docs/05-motion.md)
- [Admin dashboard](docs/06-admin.md)
- [Database](docs/07-database.md)
- [Booking workflow and payments](docs/08-booking-workflow.md)
- [SEO and performance](docs/10-seo-performance.md)
