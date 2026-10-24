import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/clients';
import { getImage, type ImageEntry } from '@/lib/images';
import type { Destination, Faq, ItineraryDay, Package, PackageCategory, Vehicle } from '@/lib/catalog';
import { DEMO, demoCatalog, demoPosts, demoSettings } from '@/lib/demo-data';

// Public website data. Read with the anonymous key (so RLS returns only published rows), cached, and refreshed
// instantly when the admin saves (see lib/revalidate.ts). Tags: catalog, settings, blog, media.

export const TAGS = { catalog: 'catalog', settings: 'settings', blog: 'blog', media: 'media' } as const;
const REVALIDATE = 3600; // safety net; admin edits invalidate immediately

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Could not load ${what}: ${res.error.message}`);
  return res.data as T;
}

// ---------------------------------------------------------------- media
export type MediaEntry = ImageEntry & { id: string };

const loadMedia = unstable_cache(async (): Promise<Record<string, ImageEntry>> => {
  if (DEMO) return {};
  const rows = check(await createPublicClient().from('media').select('id, alt, width, height, src, srcset, placeholder'), 'media') as
    { id: string; alt: string; width: number; height: number; src: string; srcset: string; placeholder: string }[];
  return Object.fromEntries(rows.map(r => [r.id, { src: r.src, alt: r.alt, width: r.width, height: r.height, aspect: `${r.width}:${r.height}`, placeholder: r.placeholder, srcset: { webp: r.srcset } }]));
}, ['media'], { tags: [TAGS.media], revalidate: REVALIDATE });

/** Image references are either a Phase 3 asset id ("tirumala-hero") or an uploaded file ("media:<uuid>"). */
export function resolveImage(ref: string, media: Record<string, ImageEntry>): ImageEntry | null {
  if (!ref) return null;
  if (ref.startsWith('media:')) return media[ref.slice(6)] ?? null;
  return getImage(ref);
}

// ---------------------------------------------------------------- catalogue
type Catalog = { packages: Package[]; vehicles: Vehicle[]; destinations: Destination[] };

const loadCatalog = unstable_cache(async (): Promise<Catalog> => {
  if (DEMO) return demoCatalog();
  const db = createPublicClient();
  const [pk, vh, ds, media] = await Promise.all([
    db.from('packages').select('*, package_vehicles(price, vehicles(slug, sort))').eq('published', true).order('popularity', { ascending: false }),
    db.from('vehicles').select('*').eq('active', true).order('sort'),
    db.from('destinations').select('*').order('sort'),
    loadMedia(),
  ]);
  type PkgRow = Record<string, unknown> & { package_vehicles: { price: number | null; vehicles: { slug: string; sort: number } | null }[] };
  const packages = (check(pk, 'packages') as PkgRow[]).map((r): Package => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    category: r.category as PackageCategory,
    destinations: r.destinations as string[],
    durationDays: r.duration_days === null ? null : Number(r.duration_days),
    durationLabel: r.duration_label as string,
    summary: r.summary as string,
    overview: r.overview as string,
    image: r.image as string,
    imageEntry: resolveImage(r.image as string, media),
    gallery: (r.gallery as string[]).map(id => ({ id, entry: resolveImage(id, media) })),
    passengers: { min: r.passengers_min as number, max: r.passengers_max as number },
    vehicles: r.package_vehicles
      .filter(v => v.vehicles)
      .sort((a, b) => a.vehicles!.sort - b.vehicles!.sort)
      .map(v => ({ slug: v.vehicles!.slug, price: v.price === null ? null : Number(v.price) })),
    priceUnit: r.price_unit as string,
    itinerary: r.itinerary as ItineraryDay[],
    inclusions: r.inclusions as string[],
    exclusions: r.exclusions as string[],
    faqs: r.faqs as Faq[],
    popularity: r.popularity as number,
    featured: r.featured as boolean,
    seoTitle: r.seo_title as string,
    seoDescription: r.seo_description as string,
  }));
  const vehicles = (check(vh, 'vehicles') as Record<string, unknown>[]).map((r): Vehicle => ({
    id: r.id as string, slug: r.slug as string, name: r.name as string, examples: r.examples as string, passengers: r.passengers as number,
    luggage: r.luggage as string, ac: r.ac as boolean, image: r.image as string, imageEntry: resolveImage(r.image as string, media),
    bestFor: r.best_for as string, features: r.features as string[], active: r.active as boolean, verified: r.verified as boolean,
  }));
  const destinations = (check(ds, 'destinations') as Record<string, unknown>[]).map((r): Destination => ({
    slug: r.slug as string, name: r.name as string, detail: r.detail as string, distance: r.distance as string, image: r.image as string,
    imageEntry: resolveImage(r.image as string, media), featured: r.featured as boolean, sort: r.sort as number,
  }));
  return { packages, vehicles, destinations };
}, ['catalog'], { tags: [TAGS.catalog, TAGS.media], revalidate: REVALIDATE });

export const getPackages = async () => (await loadCatalog()).packages;
export const getPackage = async (slug: string) => (await loadCatalog()).packages.find(p => p.slug === slug);
export const getVehicles = async () => (await loadCatalog()).vehicles;
export const getDestinations = async () => (await loadCatalog()).destinations;

export async function relatedPackages(pkg: Package, count = 3): Promise<Package[]> {
  const score = (p: Package) => p.destinations.filter(d => pkg.destinations.includes(d)).length * 2 + (p.category === pkg.category ? 1 : 0) + p.popularity / 100;
  return (await getPackages()).filter(p => p.slug !== pkg.slug).sort((a, b) => score(b) - score(a)).slice(0, count);
}

// ---------------------------------------------------------------- settings
export type Contact = { phone: string | null; phoneDisplay: string | null; whatsapp: string | null; email: string | null; address: string | null; mapsUrl: string | null; mapsEmbedUrl: string | null; hours: string | null };
export type Settings = {
  brand: { name: string; tagline: string; story: string | null; serviceArea: string[]; googleReviewsUrl: string | null; verified: boolean };
  contact: Contact;
  hero: { eyebrow: string; lines: string[]; text: string; image: string; mobileImage: string };
  home: { packageSlugs: string[]; faqs: Faq[] };
  seo: { title: string; description: string };
  testimonials: { items: { quote: string; name: string; city?: string; package?: string }[] };
};

const DEFAULTS: Settings = {
  brand: { name: 'Yatra Travels', tagline: 'Tirupati pilgrim tours', story: null, serviceArea: [], googleReviewsUrl: null, verified: false },
  contact: { phone: null, phoneDisplay: null, whatsapp: null, email: null, address: null, mapsUrl: null, mapsEmbedUrl: null, hours: null },
  hero: { eyebrow: '', lines: ['Your Journey.', 'Our Commitment.'], text: '', image: 'tirumala-hero', mobileImage: 'travel-hero-mobile' },
  home: { packageSlugs: [], faqs: [] },
  seo: { title: 'Yatra Travels', description: '' },
  testimonials: { items: [] },
};

export const getSettings = unstable_cache(async (): Promise<Settings> => {
  if (DEMO) return demoSettings();
  const rows = check(await createPublicClient().from('site_settings').select('key, value'), 'settings') as { key: keyof Settings; value: unknown }[];
  const out = structuredClone(DEFAULTS) as Record<string, unknown>;
  for (const r of rows) if (r.key in DEFAULTS) out[r.key] = { ...(DEFAULTS[r.key] as object), ...(r.value as object) };
  return out as Settings;
}, ['settings'], { tags: [TAGS.settings], revalidate: REVALIDATE });

// ---------------------------------------------------------------- blog
export type Post = {
  slug: string; title: string; description: string; date: string; image: string; imageEntry: ImageEntry | null; imageAlt: string;
  category: string; tags: string[]; readingMinutes: number; body: string; seoTitle: string; seoDescription: string;
};

export const getPosts = unstable_cache(async (): Promise<Post[]> => {
  if (DEMO) return demoPosts();
  const [res, media] = await Promise.all([
    createPublicClient().from('blog_posts').select('*').eq('published', true).order('published_at', { ascending: false }),
    loadMedia(),
  ]);
  return (check(res, 'posts') as Record<string, unknown>[]).map(r => ({
    slug: r.slug as string, title: r.title as string, description: r.description as string, date: (r.published_at as string) ?? '',
    image: r.image as string, imageEntry: resolveImage(r.image as string, media), imageAlt: r.image_alt as string,
    category: r.category as string, tags: r.tags as string[], body: r.body as string,
    readingMinutes: Math.max(1, Math.round((r.body as string).split(/\s+/).length / 200)),
    seoTitle: r.seo_title as string, seoDescription: r.seo_description as string,
  }));
}, ['blog'], { tags: [TAGS.blog, TAGS.media], revalidate: REVALIDATE });

export const getPost = async (slug: string) => (await getPosts()).find(p => p.slug === slug);

/** Resolves a single image reference (asset id or "media:<uuid>"), e.g. the hero image chosen in /admin/content. */
export async function resolveImageRef(ref: string): Promise<ImageEntry | null> {
  return resolveImage(ref, await loadMedia());
}
