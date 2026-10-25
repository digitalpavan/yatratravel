# Yatra Travels: Phase 4, the website

> **Updated in Phase 6:** content, bookings and enquiries now live in Supabase and are managed at `/admin`. The SQLite storage and the JSON content files described below are replaced. The JSON files are now only used to seed the database. See [06-admin.md](06-admin.md).

Next.js 16 (App Router, TypeScript). The styles come from the Phase 2 design system (`styles/`), the images from the
Phase 3 pipeline (`public/images/images.json`), and the content from `content/`.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start   # production
```

Copy `.env.example` to `.env.local`. `BOOKING_TOKEN_SECRET` is required in production.

## Routes

| Route | Notes |
|-------|-------|
| `/` | Hero (`tirumala-hero`, with a separate mobile crop and optional video), quick booking tabs, packages, destinations, fleet, why us, how it works, reviews, FAQs, contact CTA |
| `/packages` | Search by destination, filter by type and duration, sort, pagination. Filters are kept in the URL |
| `/packages/[slug]` | Hero, overview, day-by-day itinerary, destinations, vehicles and prices, inclusions, FAQs, enquiry form, related packages, sticky summary |
| `/tirupati-darshan` | Travel information, a prominent ticket-responsibility notice, pickups, tours, itineraries, enquiry form |
| `/vehicles` | Vehicle cards (passengers, luggage, AC), quote and availability actions, routes, enquiry form |
| `/book` | 3-step booking request (prefilled from `?package=&vehicle=&date=&passengers=&pickup=`) |
| `/booking-confirmation/[reference]?t=…` | Private link only (see below) |
| `/about`, `/contact`, `/privacy`, `/blog`, `/blog/[slug]` | Content pages. Articles live in `content/blog/*.md` |
| `/api/bookings`, `/api/enquiries` | POST endpoints |

## Where the content lives (no code changes needed)

| File | Controls |
|------|----------|
| `content/site.json` | Phone, WhatsApp, email, address, map, hours, story, review link. Set `verified: true` to launch |
| `content/seed/services.json` | Packages (itinerary, prices, inclusions, FAQs) and vehicles |
| `content/testimonials.json` | Real reviews only. The section shows a neutral message while this is empty |
| `content/blog/*.md` | Travel guides (frontmatter: title, description, date, image, imageAlt, category, tags) |
| `content/image-manifest.json` | Photos (see `docs/03-image-assets.md`) |

The admin phase will move packages, vehicles, bookings and enquiries into the database with an editing UI.

## Bookings: how it works

The full workflow, statuses and WhatsApp rules are in [08-booking-workflow.md](08-booking-workflow.md). On the website side:

1. The form checks each step in the browser, and the API checks everything again on the server (`lib/validation.ts`), then checks the package, group size, vehicle and current price against the live database (`checkOffer()`).
2. Each form session sends a random **idempotency key**. Double clicks and retries return the original booking instead of creating a duplicate, and the button also locks while sending.
3. The server creates the reference `YT-YYMMDD-XXXX` (IST date and 4 unambiguous characters) and stores the booking with status **`pending`**. Nothing is auto-confirmed.
4. The visitor is sent to `/booking-confirmation/<ref>?t=<token>`, where the token is an HMAC of the reference. Without a valid token the page shows the same generic message whether or not the reference exists, so references can't be guessed or enumerated. These pages are `no-store` and `noindex`. The page always shows the booking's current status.
5. The forms include a honeypot field and a per-IP rate limit (5 bookings or 8 enquiries per 10 minutes).

## Animations

They're all CSS, plus one shared IntersectionObserver (`components/motion.tsx`):
- hero headline rise and staggered copy, slow zoom, parallax
- section reveals and staggered cards
- card image zoom
- sliding booking tabs
- header background change on scroll
- package image wipe and scroll-drawn itinerary timeline
- animated FAQs
- form step slides, progress bar and success reveal

Everything is switched off under `prefers-reduced-motion`. Content is only hidden for a reveal once JavaScript has loaded.

## Before launch

- [ ] Fill in `content/site.json` with verified details, then set `verified: true`. That removes the preview banner and the `noindex` tags.
- [ ] Prices confirmed in `services.json` (the site shows "On request" until then)
- [ ] Vehicle capacities and luggage confirmed, then set `verified: true` on each vehicle
- [ ] Photos sourced and `npm run images` run (see `docs/03-image-assets.md`)
- [ ] Privacy policy reviewed (DPDP Act 2023) and retention period set
- [ ] `BOOKING_TOKEN_SECRET` and `NEXT_PUBLIC_SITE_URL` set
- [ ] A database chosen to suit the hosting
- [ ] Staff notifications for new bookings in place
