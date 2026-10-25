// Catalogue types and pure helpers, safe to import from client components.
import type { ImageEntry } from '@/lib/images';

export type PackageCategory = 'temple-tour' | 'transfer' | 'package' | 'day-tour' | 'cab' | 'custom';
export type Stop = { name: string; note?: string };
export type ItineraryDay = { day: number; title: string; stops: Stop[] };
export type Faq = { q: string; a: string };

export type Destination = { slug: string; name: string; detail: string; distance: string; image: string; imageEntry: ImageEntry | null; featured: boolean; sort: number };

export type Vehicle = {
  id: string;
  slug: string;
  name: string;
  examples: string;
  passengers: number;
  luggage: string;
  ac: boolean;
  image: string;
  imageEntry: ImageEntry | null;
  bestFor: string;
  features: string[];
  active: boolean;
  verified: boolean;
};

export type Package = {
  id: string;
  slug: string;
  title: string;
  category: PackageCategory;
  destinations: string[];
  durationDays: number | null;
  durationLabel: string;
  summary: string;
  overview: string;
  image: string;
  imageEntry: ImageEntry | null;
  gallery: { id: string; entry: ImageEntry | null }[];
  passengers: { min: number; max: number };
  /** Vehicles offered, with the confirmed price or null ("on request"). */
  vehicles: { slug: string; price: number | null }[];
  priceUnit: string;
  /** The listed price can be paid online when booking (false for per-km or on-request pricing). */
  payOnline: boolean;
  itinerary: ItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  faqs: Faq[];
  popularity: number;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
};

export const categoryLabels: Record<PackageCategory, string> = {
  'temple-tour': 'Temple tours',
  package: 'Pilgrimage packages',
  'day-tour': 'Day trips',
  transfer: 'Transfers',
  cab: 'Cabs',
  custom: 'Custom trips',
};

export type DurationBucket = 'half-day' | 'full-day' | 'multi-day' | 'flexible';
export const durationLabels: Record<DurationBucket, string> = {
  'half-day': 'A few hours',
  'full-day': 'Full day',
  'multi-day': '2 days or more',
  flexible: 'Flexible',
};
export function durationBucket(days: number | null): DurationBucket {
  if (days === null) return 'flexible';
  if (days < 1) return 'half-day';
  if (days < 2) return 'full-day';
  return 'multi-day';
}

/** Lowest price the business has confirmed, or null when none are set ("Price on request"). */
export function startingPrice(pkg: Pick<Package, 'vehicles'>): number | null {
  const prices = pkg.vehicles.map(v => v.price).filter((p): p is number => typeof p === 'number');
  return prices.length ? Math.min(...prices) : null;
}

/** Plain, serialisable shape for cards and client components. */
export type PackageSummary = Pick<Package, 'slug' | 'title' | 'category' | 'destinations' | 'durationDays' | 'durationLabel' | 'summary' | 'image' | 'imageEntry' | 'inclusions' | 'exclusions' | 'popularity' | 'priceUnit'> & {
  fromPrice: number | null;
  /** Searchable destination names, e.g. "Srikalahasti Sri Kalahasteeswara Swamy Temple". */
  destinationText: string;
};

export function toSummary(p: Package, destinations: Destination[] = []): PackageSummary {
  const { slug, title, category, durationDays, durationLabel, summary, image, imageEntry, inclusions, exclusions, popularity, priceUnit } = p;
  const destinationText = p.destinations.map(d => { const x = destinations.find(y => y.slug === d); return x ? `${d} ${x.name} ${x.detail}` : d; }).join(' ');
  return { slug, title, category, destinations: p.destinations, durationDays, durationLabel, summary, image, imageEntry, inclusions, exclusions, popularity, priceUnit, fromPrice: startingPrice(p), destinationText };
}
