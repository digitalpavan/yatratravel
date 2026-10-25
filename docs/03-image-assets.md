# Yatra Travels: Phase 3, image and visual assets

Status: the asset pipeline is ready, but **the photos and video haven't been sourced yet**. Every photo is listed in
[`content/image-manifest.json`](../content/image-manifest.json) with its prompt or brief, alt text, crop,
responsive sizes, the pages it's used on, and its licence status.

---

## 1. Workflow

```
1. Generate or license the image  →  2. Save the original to assets/source/<category>/<id>.jpg
3. Fill in "rights" in the manifest, setting status to "cleared"  →  4. npm run images
5. npm run images:check  (must pass before launch)
```

`npm run images` creates, for each image:

| Output | Example |
|--------|---------|
| AVIF + WebP at each width in the manifest (never upscaled) | `/images/hero/tirumala-hero-1280.avif`, `…-1280.webp` |
| A canonical WebP at the path in the asset plan (≈1600px) | `/images/hero/tirumala-hero.webp` |
| A blurred placeholder of about 300 bytes, inlined | `placeholder: "data:image/webp;base64,…"` |
| A registry the website reads | `public/images/images.json` |

For the video it creates a 1080p and a 720p H.264 MP4 (muted, at most 15 seconds, faststart) and a poster image.
Source originals stay in `assets/source/` and are never served.

---

## 2. Asset library

```
public/
├── images/
│   ├── branding/      logo-badge-128/256.webp (header logo), favicon-64.png, apple-touch-icon.png, yatra-logo.png (search engines), all made from assets/source/branding/ttd-yatra-logo.jpg
│   ├── hero/          tirumala-hero, travel-hero-mobile, waiting for source
│   ├── destinations/  tirupati-temple, tirumala-hills, kanipakam-temple, srikalahasti-temple, vellore-golden-temple
│   ├── vehicles/      sedan, suv, innova, tempo-traveller
│   ├── packages/      local-darshan, tirumala-trip, multi-temple-tour, airport-railway-transfer*, outstation-journey*
│   ├── backgrounds/   pattern-kolam.svg (decorative), done
│   ├── icons/         43 line icons (24px, currentColor), done
│   └── images.json    generated registry
├── videos/            tirumala-hero.mp4, tirumala-hero-720.mp4 (generated)
└── animations/
```
\* Added beyond the original list, so that every one of the nine services has its own image (see section 4).

---

## 3. Sourcing rules (read before generating anything)

**Real temples must use real photographs.** An AI image generator will invent architecture for Tirupati,
Kanipakam, Srikalahasti, Sripuram and the Tirumala temple. A pilgrim who knows these places will notice, and
showing an invented temple as the real one misrepresents it. For every image marked
`licensed-photo REQUIRED` in the manifest, use one of these:

1. Your own photographs, taken from public areas where photography is allowed.
2. Stock libraries with a commercial licence (Shutterstock, Adobe Stock, Getty/iStock, Alamy).
3. Wikimedia Commons, but only under CC0 / CC BY / CC BY-SA, and with the attribution shown on the site. Record the author, licence and URL in `rights`.

**Photography restrictions:** TTD does not allow photography inside the Tirumala temple, and it restricts drones over the hills.
Other temples have their own rules. Check the current rules before commissioning a shoot or footage, and never
use images taken inside a sanctum.

**AI generation is acceptable for** landscapes with no identifiable temple (the hero, the hills),
generic road and transfer scenes, and vehicles. In those cases:
- **Vehicles:** the alt text and caption must say "Representative image". Replace them with real fleet photos as soon as
  possible, and only show vehicle types the business actually operates (Phase 1, open question 2).
- Remove all brand badges, number plates and signage text, using the prompts in the manifest.
- Keep the generator's terms of service with the rights record (provider, date, prompt).

**Never** generate customer photos, "happy pilgrim" testimonials, or anything implying a real review.

---

## 4. Image per page (no repeated generic hero)

| Page | Image(s) | Loading |
|------|----------|---------|
| Home: hero | `tirumala-hero` (≥768px) / `travel-hero-mobile` (<768px); optional `tirumala-hero.mp4` on desktop | eager, `fetchpriority="high"` |
| Home: destinations | all five `destinations/*` | lazy |
| Home: popular packages | `local-darshan`, `tirumala-trip`, `kanipakam-temple` | lazy |
| Home: custom-trip CTA | `multi-temple-tour` (decorative, `alt=""`) | lazy |
| Packages listing: header | `tirumala-hills` | eager (above the fold) |
| Packages listing: cards | each package's own image (table below) | lazy |
| Package details: hero/gallery | the package image + its destination images | first image eager |
| Package details: vehicles | `vehicles/*` for the vehicles that package offers | lazy |
| Booking form: summary | the chosen package's image (small, 16:9) | lazy |
| Booking confirmation | none. A success icon only, so the reference stays the focus | n/a |
| Admin | none (uses package thumbnails from the media library) | n/a |

**Package → image**

| Service | Card image | Gallery adds |
|---------|-----------|--------------|
| Tirupati local temple tour | `local-darshan` | `tirupati-temple` |
| Tirupati to Tirumala transport | `tirumala-trip` | `tirumala-hills` |
| Tirupati pilgrimage package | `tirumala-hills` | `local-darshan`, `tirupati-temple` |
| Kanipakam & Srikalahasti tour | `kanipakam-temple` | `srikalahasti-temple` |
| Vellore Golden Temple tour | `vellore-golden-temple` | n/a |
| Airport & railway transfers | `airport-railway-transfer` | `sedan` |
| Local cab booking | `sedan` | `suv` |
| Outstation travel | `outstation-journey` | `tempo-traveller` |
| Custom itineraries | `multi-temple-tour` | n/a |

---

## 5. Generation prompts

The full prompt for each image is in the manifest's `prompt` field. These are your original prompts, tightened up:

- **The hero** no longer asks for "the Venkateswara temple area", which would produce an invented temple. It focuses on the
  hills and mist, with light coming from the right so the left third stays clear for the headline.
- **The mobile hero** adds a darker lower third so the buttons stay readable.
- **The vehicle prompts** name a class (e.g. "Innova Crysta class, unbadged") rather than a brand. They ask for
  three-quarter front views and no plates or logos, so the four images match as a set.
- **Temple entries** are written as *briefs for a photographer or stock search*, not AI prompts (see section 3).

**Consistent look across the set:** warm, golden-hour or soft daylight; natural colour, not over-saturated; no
heavy HDR; a calm, reverent mood; no text. Ask for the largest size the tool offers (at least 2560px wide for the hero,
1600px for the others).

---

## 6. How the website uses them (Phase 4 reference)

```html
<!-- Hero: art-directed, not lazy-loaded, high priority -->
<picture>
  <source media="(max-width: 767px)" type="image/avif" srcset="…travel-hero-mobile-480.avif 480w, …-750.avif 750w, …-1080.avif 1080w" sizes="100vw">
  <source media="(max-width: 767px)" type="image/webp" srcset="…travel-hero-mobile-480.webp 480w, …" sizes="100vw">
  <source type="image/avif" srcset="…tirumala-hero-768.avif 768w, …-1280.avif 1280w, …-1920.avif 1920w, …-2560.avif 2560w" sizes="100vw">
  <img src="/images/hero/tirumala-hero.webp" srcset="…webp list…" sizes="100vw"
       width="2560" height="1440" alt="Tirumala hills at sunrise, with morning mist over the forested slopes"
       fetchpriority="high" decoding="async">
</picture>

<!-- Card: lazy, sized to the grid -->
<img src="/images/packages/local-darshan.webp" srcset="…" sizes="(min-width:1280px) 400px, (min-width:640px) 50vw, 100vw"
     width="1200" height="800" alt="Sri Padmavathi Ammavari Temple, Tiruchanur, in morning light" loading="lazy" decoding="async"
     style="background:url(<placeholder>) center/cover">

<!-- Video: desktop only, muted, with a still-image fallback -->
<video autoplay muted loop playsinline preload="none" poster="/images/hero/tirumala-hero.webp" aria-hidden="true">
  <source src="/videos/tirumala-hero-720.mp4" media="(max-width:1279px)" type="video/mp4">
  <source src="/videos/tirumala-hero.mp4" type="video/mp4">
</video>
```

Rules:
- Always set `width` and `height`, so the page doesn't shift as images load.
- Only the hero is eager. Everything below the fold is `loading="lazy"`.
- Don't load the video below 1024px, under `prefers-reduced-motion: reduce`, or when `navigator.connection.saveData` is on. Use the poster instead.
- Decorative images (patterns, the CTA background) use `alt=""` or CSS backgrounds. Informational images (a temple or vehicle the customer is choosing) get descriptive alt text from the manifest.
- Targets: hero under 250 KB (AVIF at 1920px), cards under 80 KB, video under 4 MB.

---

## 7. Launch checklist

- [ ] All 16 images present (`npm run images:check` shows no `missing` lines)
- [ ] Every `rights.status` is `"cleared"`, with provider, licence and URL filled in
- [ ] CC BY / BY-SA attributions shown on an image-credits page
- [ ] Temple images checked: is it the right temple, is the alt text correct, and was it photographed where that's allowed?
- [ ] Vehicle images are real fleet photos, or labelled "Representative image"
- [ ] Only vehicle types the business actually operates are shown
- [ ] Hero LCP under 2.5 s on a mid-range phone over 4G (check with Lighthouse)
