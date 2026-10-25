import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import services from '@/content/seed/services.json';
import defaults from '@/content/seed/settings.json';
import site from '@/content/site.json';
import { getImage } from '@/lib/images';
import type { Destination, Package, PackageCategory, Vehicle } from '@/lib/catalog';
import type { Post, Settings } from '@/lib/data';

/**
 * Local preview without a database: YATRA_DEMO_DATA=1 serves the public site from the seed files in content/.
 * Opt-in only, never used in production unless explicitly set, and the preview banner always shows.
 * The admin dashboard still requires Supabase.
 */
export const DEMO = process.env.YATRA_DEMO_DATA === '1';
if (DEMO) console.warn('[yatra] Demo-data mode: public pages use content/ seed files; bookings are kept in memory.');

type SeedPackage = (typeof services.packages)[number] & { prices: Record<string, number | null> };

export function demoCatalog(): { packages: Package[]; vehicles: Vehicle[]; destinations: Destination[] } {
  const vehicles: Vehicle[] = services.vehicles.map((v, i) => ({
    id: `demo-v-${i}`, slug: v.slug, name: v.name, examples: v.examples, passengers: v.passengers, luggage: v.luggage, ac: v.ac,
    image: v.image, imageEntry: getImage(v.image), bestFor: v.bestFor, features: v.features, active: true, verified: v.verified,
  }));
  const packages: Package[] = (services.packages as unknown as SeedPackage[]).filter(p => p.published).map((p, i) => ({
    id: `demo-p-${i}`, slug: p.slug, title: p.title, category: p.category as PackageCategory, destinations: p.destinations,
    durationDays: p.durationDays, durationLabel: p.durationLabel, summary: p.summary, overview: p.overview,
    image: p.image, imageEntry: getImage(p.image), gallery: p.gallery.map(id => ({ id, entry: getImage(id) })),
    passengers: p.passengers, vehicles: p.vehicles.map(slug => ({ slug, price: p.prices?.[slug] ?? null })), priceUnit: p.priceUnit, payOnline: false,
    itinerary: p.itinerary, inclusions: p.inclusions, exclusions: p.exclusions, faqs: p.faqs, popularity: p.popularity,
    featured: ['temple-tour', 'transfer', 'package'].includes(p.category), seoTitle: '', seoDescription: '',
  })).sort((a, b) => b.popularity - a.popularity);
  const destinations: Destination[] = defaults.destinations.map((d, i) => ({ ...d, imageEntry: getImage(d.image), featured: true, sort: i }));
  return { packages, vehicles, destinations };
}

export function demoSettings(): Settings {
  return {
    brand: { name: site.name, tagline: site.tagline, story: site.story, serviceArea: site.serviceArea, googleReviewsUrl: site.googleReviewsUrl, verified: false },
    contact: { phone: site.phone, phoneDisplay: site.phoneDisplay, whatsapp: site.whatsapp, email: site.email, address: site.address, mapsUrl: site.mapsUrl, mapsEmbedUrl: site.mapsEmbedUrl, hours: site.hours },
    hero: defaults.hero,
    home: defaults.home,
    seo: defaults.seo,
    testimonials: { items: [] },
  };
}

export function demoPosts(): Post[] {
  const dir = path.join(process.cwd(), 'content', 'blog');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)!;
    const meta: Record<string, string> = {};
    for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1'); }
    const body = m[2].trim();
    return {
      slug: f.replace(/\.md$/, ''), title: meta.title, description: meta.description, date: meta.date, image: meta.image, imageEntry: getImage(meta.image),
      imageAlt: meta.imageAlt ?? '', category: meta.category ?? 'Travel guide', tags: (meta.tags ?? '').split(',').map(t => t.trim()).filter(Boolean),
      readingMinutes: Math.max(1, Math.round(body.split(/\s+/).length / 200)), body, seoTitle: '', seoDescription: '',
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}
