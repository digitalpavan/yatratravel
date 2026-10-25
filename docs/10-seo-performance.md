# SEO and performance

## Landing pages

Seven pages, one per service people search for. Content lives in [`lib/landing-pages.ts`](../lib/landing-pages.ts) and renders through `app/(site)/[landing]/page.tsx`. Only the slugs listed there exist; any other top-level path is a 404.

| URL | Search intent | Books |
|---|---|---|
| `/tirupati-travel-services` | Tirupati travel services (hub) | All services |
| `/tirupati-to-tirumala-taxi` | Tirupati to Tirumala transportation | Tirumala transport |
| `/tirupati-pilgrimage-packages` | Tirupati pilgrimage packages | Pilgrimage package, custom itinerary |
| `/tirupati-local-temple-tours` | Tirupati local temple tours | Local temple tour |
| `/tirupati-to-kanipakam-srikalahasti` | Tirupati to Kanipakam and Srikalahasti | Kanipakam & Srikalahasti tour |
| `/tirupati-to-vellore-golden-temple` | Tirupati to Vellore Golden Temple | Vellore Golden Temple tour |
| `/tirupati-cab-booking` | Cab booking and outstation travel | Local cab, outstation, transfers |

Rules for the content:

- Publish a page only for a service the business provides. Remove it from the list if the service stops.
- Facts (distances, customs, rules) must match the travel guides in `content/blog`. No invented prices, timings or claims: prices come live from the packages.
- Each page has a unique title (under about 45 characters before the "| Yatra Travels" suffix) and description (140–160 characters).
- Each page links to the packages that deliver it, and the footer links every landing page from every page.

## What's in place

| Requirement | Where |
|---|---|
| Unique titles and descriptions | Each page's `metadata`; checked by the audit below |
| Clean URLs, canonical URLs | `alternates.canonical` on every page, including the homepage |
| XML sitemap | `app/sitemap.ts`: pages, landing pages, packages and posts |
| robots.txt | `app/robots.ts`. **Blocks everything until the business is marked verified** in /admin/content (Business & launch) |
| Open Graph / Twitter | Site default (hero image) in `app/(site)/layout.tsx`; pages override with their own photo |
| Image alt text | `alt` in `content/image-manifest.json`; uploaded images get alt text in the dashboard |
| Breadcrumbs | Visible on inner pages, plus `BreadcrumbList` structured data |
| Structured data | `TravelAgency` (home), `Service` + `FAQPage` (landing pages), `TouristTrip` (packages), `BlogPosting` (guides) |
| Search Console | Set `GOOGLE_SITE_VERIFICATION` (see below) |
| Optimised images | AVIF/WebP at several widths (`npm run images`); above-the-fold photos are preloaded |
| Real-user metrics | Vercel Speed Insights, behind `NEXT_PUBLIC_SPEED_INSIGHTS=1` |

## Going live in search

1. **Mark the business verified.** In /admin/content → Business & launch, check every detail, then tick "verified". This removes the preview banner, the `noindex` tag and the `Disallow: /` in robots.txt. Until then, Google won't index anything.
2. **Google Search Console.** Add the property `https://yatratravel.vercel.app` (or your own domain) as a URL-prefix property. Choose the **HTML tag** method, copy the `content="…"` value, set it as `GOOGLE_SITE_VERIFICATION` in Vercel, redeploy, then click Verify. Submit `/sitemap.xml` under Sitemaps.
3. **Google Business Profile.** Create or claim the profile at business.google.com with the same name, phone number (+91 94909 96614) and address as the website (Contact page). Add the website URL, service area (Tirupati, Tirumala and the routes above), hours and real photos of the vehicles. Ask happy customers for Google reviews, then paste the reviews link into /admin/content (Business & launch).
4. **Own domain (recommended).** A domain such as `yatratravels.in` builds more trust than `vercel.app`. Add it in Vercel → Domains, set `NEXT_PUBLIC_SITE_URL` to it, and use it in Search Console and the Business Profile.

## Performance

Targets (Core Web Vitals, 75th percentile of real visits): **LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.**

### Lab results (25 Oct 2026, Lighthouse 12.8, mobile, slow 4G, 4× CPU slowdown, median of 3)

| Page | LCP before | LCP after | CLS | TBT |
|---|---|---|---|---|
| Home | 3.3 s | 2.6 s | 0 | < 10 ms |
| Package page | 4.5 s | 2.1 s | 0 | < 10 ms |
| Landing page | – | 2.0–2.3 s | 0 | < 10 ms |

What changed:

- **Intro animations are CSS, not JavaScript.** The hero and page headings used to start invisible until the animation library loaded, which held the LCP back by about 2 seconds. They now animate from the first frame (`.intro` in `styles/site.css`).
- **Above-the-fold photos are preloaded** at high priority, with separate mobile and desktop versions (`components/Photo.tsx`).
- **Hero images are compressed harder** (they sit under a dark overlay): mobile 66 → 34 KB, desktop 161 → 90 KB (per-image `quality` in the manifest).
- **The body font isn't preloaded,** so it doesn't compete with the hero photo; headings (Manrope) still are.

### Measuring real visitors

Lab tests are a guide; Google ranks on field data from real Chrome users.

1. Vercel → Project → **Speed Insights** → Enable.
2. Set `NEXT_PUBLIC_SPEED_INSIGHTS=1` in Vercel and redeploy. LCP, INP and CLS per page appear in the Speed Insights tab after a few days of visits.
3. Once the site has enough traffic, PageSpeed Insights (pagespeed.web.dev) and Search Console → Core Web Vitals also show Chrome's field data.

Re-test after big changes, especially new animations, videos or large images. A quick lab check:

```bash
npx lighthouse https://yatratravel.vercel.app/ --throttling-method=devtools --only-categories=performance --view
```
