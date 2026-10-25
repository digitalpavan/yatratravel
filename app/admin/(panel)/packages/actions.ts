'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionState } from '@/components/admin/ActionForm';
import { requireRole } from '@/lib/auth';
import { parseRupees, toPaise } from '@/lib/format';
import { refreshPublicSite } from '@/lib/revalidate';
import { createUserClient } from '@/lib/supabase/clients';

const lines = (v: FormDataEntryValue | null) => String(v ?? '').split('\n').map(s => s.trim()).filter(Boolean);
const json = (v: FormDataEntryValue | null) => { try { return JSON.parse(String(v ?? '[]')); } catch { return null; } };
const imageRef = z.string().max(80).regex(/^(media:[0-9a-f-]{36}|[a-z0-9-]*)$/, 'Invalid image');

const schema = z.object({
  id: z.uuid().optional(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'URL slug: lowercase letters, numbers and hyphens only').max(80),
  title: z.string().trim().min(3, 'Add a title').max(120),
  category: z.enum(['temple-tour', 'transfer', 'package', 'day-tour', 'cab', 'custom']),
  destinations: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(20),
  duration_days: z.number().min(0.1).max(30).nullable(),
  duration_label: z.string().trim().min(1, 'Add a duration label, e.g. "Full day"').max(60),
  summary: z.string().trim().min(10, 'Add a one-line summary').max(300),
  overview: z.string().trim().max(3000),
  image: imageRef,
  gallery: z.array(imageRef).max(6),
  passengers_min: z.number().int().min(1).max(60),
  passengers_max: z.number().int().min(1).max(60),
  price_unit: z.string().trim().max(80),
  pay_online: z.boolean(),
  itinerary: z.array(z.object({
    day: z.number().int().min(1),
    title: z.string().trim().max(120),
    stops: z.array(z.object({ name: z.string().trim().min(1).max(160), note: z.string().trim().max(300).optional() })).max(30),
  })).max(30),
  inclusions: z.array(z.string().max(200)).max(30),
  exclusions: z.array(z.string().max(200)).max(30),
  faqs: z.array(z.object({ q: z.string().trim().min(3).max(200), a: z.string().trim().min(3).max(1000) })).max(30),
  popularity: z.number().int().min(0).max(100),
  featured: z.boolean(),
  published: z.boolean(),
  seo_title: z.string().trim().max(70, 'SEO title: 70 characters or fewer'),
  seo_description: z.string().trim().max(170, 'SEO description: 170 characters or fewer'),
  vehicles: z.array(z.object({ vehicle_id: z.uuid(), price: z.number({ error: 'Type prices as numbers, for example 2500' }).min(0).max(1_000_000).nullable() })),
}).refine(v => v.passengers_max >= v.passengers_min, { path: ['passengers_max'], message: 'Maximum travellers must be at least the minimum' })
  .refine(v => !v.published || v.category === 'custom' || v.vehicles.length > 0, { path: ['vehicles'], message: 'Choose at least one vehicle before publishing' });

const num = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === '' ? null : Number(v));

export async function savePackage(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  const vehicleIds = form.getAll('vehicle_ids').map(String);
  const input = {
    id: form.get('id') || undefined,
    slug: String(form.get('slug') ?? '').trim(),
    title: form.get('title'),
    category: form.get('category'),
    destinations: form.getAll('destinations').map(String),
    duration_days: num(form.get('duration_days')),
    duration_label: form.get('duration_label'),
    summary: form.get('summary'),
    overview: form.get('overview') ?? '',
    image: String(form.get('image') ?? ''),
    gallery: form.getAll('gallery').map(String).filter(Boolean),
    passengers_min: num(form.get('passengers_min')) ?? 1,
    passengers_max: num(form.get('passengers_max')) ?? 12,
    price_unit: form.get('price_unit') ?? '',
    pay_online: form.get('pay_online') === 'on',
    itinerary: json(form.get('itinerary')),
    inclusions: lines(form.get('inclusions')),
    exclusions: lines(form.get('exclusions')),
    faqs: json(form.get('faqs')),
    popularity: num(form.get('popularity')) ?? 50,
    featured: form.get('featured') === 'on',
    published: form.get('published') === 'on',
    seo_title: form.get('seo_title') ?? '',
    seo_description: form.get('seo_description') ?? '',
    vehicles: vehicleIds.map(vid => { const p = parseRupees(String(form.get(`price_${vid}`) ?? '')); return { vehicle_id: vid, price: p === 'invalid' ? Number.NaN : p }; }),
  };
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map(i => [String(i.path.join('.')), i.message]));
    return { error: 'Please fix the highlighted details.', fields };
  }
  const { id, vehicles, itinerary, ...row } = parsed.data;
  const db = await createUserClient();

  const saved = id
    ? await db.from('packages').update(row).eq('id', id).select('id').single()
    : await db.from('packages').insert(row).select('id').single();
  if (saved.error) {
    return { error: saved.error.code === '23505' ? 'Another package already uses this URL slug.' : `Could not save: ${saved.error.message}` };
  }
  const packageId = saved.data.id as string;

  // Replace the vehicle/price list and the itinerary for this package.
  const del = await db.from('package_vehicles').delete().eq('package_id', packageId);
  const ins = vehicles.length
    ? await db.from('package_vehicles').insert(vehicles.map(v => ({ package_id: packageId, vehicle_id: v.vehicle_id, price_paise: toPaise(v.price) })))
    : { error: null };
  if (del.error || ins.error) return { error: 'The package was saved, but its vehicles and prices could not be updated. Please save again.' };
  const delDays = await db.from('itinerary_days').delete().eq('package_id', packageId);
  const insDays = itinerary.length
    ? await db.from('itinerary_days').insert(itinerary.map((d, i) => ({ package_id: packageId, day: i + 1, title: d.title, stops: d.stops })))
    : { error: null };
  if (delDays.error || insDays.error) return { error: 'The package was saved, but its itinerary could not be updated. Please save again.' };

  refreshPublicSite('catalog');
  if (!id) redirect(`/admin/packages/${packageId}?created=1`);
  return { ok: row.published ? 'Saved and live on the website.' : 'Saved as a draft (not visible on the website).', at: Date.now() };
}

export async function deletePackage(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { error: 'Invalid request.' };
  const db = await createUserClient();
  const { error } = await db.from('packages').delete().eq('id', id.data);
  if (error) return { error: 'Could not delete the package.' };
  refreshPublicSite('catalog');
  redirect('/admin/packages?deleted=1');
}
