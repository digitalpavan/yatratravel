# Yatra Travels: Phase 2 design system

Open `index.html` in a browser. No build step is needed.

| Path | What it is |
|------|------------|
| `index.html` | Design-system hub: colours, contrast rules, type, spacing, buttons, forms, cards, all four states, mobile navigation, accessibility checklist |
| `preview.html?s=home` | Any screen shown at desktop (1440), tablet (768) and mobile (375) side by side |
| `screens/*.html` | Wireframes: `home`, `packages`, `package`, `booking`, `confirmation`, `admin` |
| `tokens/tokens.json` | Source of truth for design tokens |
| `tokens/tokens.css` | The same tokens as CSS custom properties |
| `components.css` | Reusable, mobile-first component library |
| `assets/site.js` | Icon sprite, mobile drawer (focus trap, Esc, inert), chips, counters, state previews |

Useful URLs:
- `screens/home.html?menu` opens the page with the mobile drawer already open.
- `screens/packages.html?state=empty` (or `loading` / `error`) previews that state. `booking.html` supports `invalid` and `failed`.

## Rules worth remembering

- **Gold is never used for text on light backgrounds** (2.35:1). Use `--text-accent` (#7D5F26). Gold buttons use navy text.
- Muted text on the warm-white page background uses `--text-muted-on-page`. `--text-muted` (#64748B) is only for white surfaces.
- One gold primary button per view. Navy is the secondary action.
- Every error state offers a WhatsApp or phone fallback.
- Prices are always per vehicle, shown as "From ₹X,XXX" plus a unit.

## Placeholders

Photos are gradient blocks. `₹X,XXX`, `+91 00000 00000`, reviews and statistics are placeholders until the
business confirms them (see `docs/01-requirements.md`). The header and footer are repeated in each
screen file. In Phase 3 they become shared components.
