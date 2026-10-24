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
| `SUPABASE_DB_URL` | Only for the database scripts below, not needed on Vercel |

Never commit `.env.local`. It is git-ignored.

## Database

```bash
npm run db:migrate                                    # apply supabase/migrations
npm run db:seed                                       # load packages, vehicles, settings and blog from content/
npm run admin:create -- you@example.com "Your Name"   # first admin, prints a one-time password
npm run test:rls                                      # check row-level security rules
```

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
