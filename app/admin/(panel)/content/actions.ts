'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionState } from '@/components/admin/ActionForm';
import { requireRole } from '@/lib/auth';
import { refreshPublicSite } from '@/lib/revalidate';
import { createUserClient } from '@/lib/supabase/clients';

const opt = (max: number) => z.string().trim().max(max).transform(v => v || null);
const digits = z.string().trim().transform(v => v.replace(/\D/g, '')).refine(v => v === '' || /^91[6-9]\d{9}$/.test(v), 'Use the full number with country code: 91 followed by the 10-digit mobile number').transform(v => v || null);
const url = z.string().trim().max(500).refine(v => v === '' || /^https:\/\//.test(v), 'Links must start with https://').transform(v => v || null);
const imageRef = z.string().max(80).regex(/^(media:[0-9a-f-]{36}|[a-z0-9-]*)$/);
const parseJson = (v: FormDataEntryValue | null) => { try { return JSON.parse(String(v ?? '[]')); } catch { return null; } };

// One schema per settings key. Each maps the submitted form to the stored JSON value.
const schemas = {
  brand: (f: FormData) => z.object({
    name: z.string().trim().min(2).max(60),
    tagline: z.string().trim().max(80),
    story: opt(4000),
    serviceArea: z.array(z.string().trim().min(1).max(80)).max(30),
    googleReviewsUrl: url,
    verified: z.boolean(),
  }).safeParse({ ...Object.fromEntries(f), serviceArea: String(f.get('serviceArea') ?? '').split('\n').map(s => s.trim()).filter(Boolean), verified: f.get('verified') === 'on' }),
  contact: (f: FormData) => z.object({
    phone: digits, phoneDisplay: opt(30), whatsapp: digits, email: z.union([z.literal(''), z.email()]).transform(v => v || null),
    address: opt(300), mapsUrl: url, mapsEmbedUrl: url.refine(v => !v || v.startsWith('https://www.google.com/maps/embed'), 'The embed link must come from Google Maps → Share → Embed a map'), hours: opt(120),
  }).safeParse(Object.fromEntries(f)),
  hero: (f: FormData) => z.object({
    eyebrow: z.string().trim().max(80), lines: z.array(z.string().trim().min(1).max(40)).min(1).max(3), text: z.string().trim().max(240),
    image: imageRef, mobileImage: imageRef,
  }).safeParse({ ...Object.fromEntries(f), lines: [f.get('line1'), f.get('line2')].map(v => String(v ?? '').trim()).filter(Boolean) }),
  home: (f: FormData) => z.object({ packageSlugs: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(6), faqs: z.array(z.object({ q: z.string().min(3).max(200), a: z.string().min(3).max(1000) })).max(20) })
    .safeParse({ packageSlugs: f.getAll('packageSlugs').map(String), faqs: parseJson(f.get('faqs')) }),
  testimonials: (f: FormData) => z.object({ items: z.array(z.object({ quote: z.string().min(5).max(500), name: z.string().min(1).max(80), city: z.string().max(60).optional(), package: z.string().max(80).optional() })).max(30) })
    .safeParse({ items: parseJson(f.get('items')) }),
  seo: (f: FormData) => z.object({ title: z.string().trim().min(10).max(70), description: z.string().trim().min(50).max(170) }).safeParse(Object.fromEntries(f)),
  accounting: (f: FormData) => z.object({ revenueReliable: z.boolean() }).safeParse({ revenueReliable: f.get('revenueReliable') === 'on' }),
} as const;

export async function saveSetting(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  const key = String(form.get('_key')) as keyof typeof schemas;
  if (!(key in schemas)) return { error: 'Unknown section.' };
  if (key === 'testimonials' && form.get('consent') !== 'on') return { error: 'Confirm that these are real reviews shared with permission.' };
  const parsed = schemas[key](form);
  if (!parsed.success) return { error: 'Please fix the highlighted details.', fields: Object.fromEntries(parsed.error.issues.map(i => [String(i.path.join('.') || key), i.message])) };

  const db = await createUserClient();
  const { error } = await db.from('site_settings').upsert({ key, value: parsed.data, is_public: key !== 'accounting' });
  if (error) return { error: 'Could not save. Please try again.' };
  refreshPublicSite('settings');
  revalidatePath('/admin', 'layout');
  return { ok: 'Saved. The website has been updated.', at: Date.now() };
}

export async function saveDestination(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  const parsed = z.object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug: lowercase letters, numbers and hyphens'),
    name: z.string().trim().min(2).max(60), detail: z.string().trim().max(120), distance: z.string().trim().max(60),
    image: imageRef, sort: z.coerce.number().int().min(0).max(1000), featured: z.boolean(),
  }).safeParse({ ...Object.fromEntries(form), featured: form.get('featured') === 'on' });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await createUserClient();
  const { error } = await db.from('destinations').upsert(parsed.data);
  if (error) return { error: 'Could not save the destination.' };
  refreshPublicSite('catalog');
  return { ok: `${parsed.data.name} saved.`, at: Date.now() };
}

export async function deleteDestination(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  const slug = z.string().regex(/^[a-z0-9-]+$/).safeParse(form.get('slug'));
  if (!slug.success) return { error: 'Invalid request.' };
  const db = await createUserClient();
  const { error } = await db.from('destinations').delete().eq('slug', slug.data);
  if (error) return { error: 'Could not delete the destination.' };
  refreshPublicSite('catalog');
  revalidatePath('/admin/content');
  return { ok: 'Destination deleted. Packages that listed it will no longer show it.', at: Date.now() };
}
