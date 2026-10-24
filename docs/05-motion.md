# Yatra Travels: Phase 5, motion and animation

All animation runs on **Motion for React** (`motion/react`). GSAP isn't used, because nothing needs it yet.
CSS handles only hover and focus feedback and colour changes, which are cheaper as plain transitions.

## Building blocks

| File | What it is |
|------|-----------|
| `lib/motion.ts` | `motionTokens` (fast 0.18s, normal 0.3s, slow 0.55s, hero 0.75s, ease `[0.22, 1, 0.36, 1]`), shared variants, `stagger()`, `isLowPowerDevice()` |
| `components/motion/MotionProvider.tsx` | `LazyMotion` (domAnimation features only) and `MotionConfig reducedMotion="user"` around the whole app |
| `components/motion.tsx` | `Reveal`, `RevealGroup`, `Intro`/`IntroItem`, `Parallax`, `Timeline`, `ImageSettle`, `PageTransition` |
| `app/(site)/template.tsx`, `app/admin/(panel)/template.tsx` | Page transitions for the site and the dashboard |
| `components/useDialogBehaviour.ts` | Focus, Tab trapping, Escape and scroll lock for the site and dashboard menus |

## Where each effect is used

- **Hero:** eyebrow, headline lines, text, then buttons fade up in sequence (`Intro`). The background drifts at most about 70px (`Parallax`) and stays static on low-power devices and under reduced motion. The hero video is desktop-only.
- **Scroll reveals** (once per page view): section headings, package, destination and fleet cards, reviews, features, and vehicle capacity and features (`Reveal`, `RevealGroup`).
- **Page transitions:** a 0.3s crossfade with an 8px rise between pages and between dashboard sections. The first load is never faded, so the main image paints immediately.
- **Package details:** the hero image settles from a slight zoom without ever being hidden. The itinerary line draws as you scroll, and stops appear in order. FAQs open and close smoothly.
- **Booking:** steps slide 24px in the direction of travel, the progress bar fills, and focus moves to each new step's heading. The success badge pops in.
- **Packages list:** filtered results crossfade in, staggered.
- **Cards:** on hover or keyboard focus, the image scales to 1.03 with a 3px lift and a deeper shadow. Arrow icons in buttons nudge 3px.
- **Mobile menus:** the panel slides in, links stagger in, focus moves inside and is trapped, Escape closes it, and page scroll is locked. The panel is removed from the page when closed.

## Rules

- Animate **opacity and transform** only. The FAQ height animation is the one deliberate exception.
- **Reduced motion:** movement is switched off and only short fades remain. Nothing essential depends on an animation finishing.
- **No JavaScript:** a `<noscript>` rule shows every animated element (`[data-reveal]`).
- No continuous animations on large backgrounds, no video on mobile, and a single animation library.
- Child variants must not set an explicit `delay` (use `transition()` from `lib/motion.ts`). An explicit delay overrides the parent's stagger.

## Previewing without Supabase

`YATRA_DEMO_DATA=1 npm run dev` serves the public site from `content/` seed files, with bookings kept in memory.
The preview banner always shows in this mode, and the dashboard still needs Supabase. Never set it in production.
