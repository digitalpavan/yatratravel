'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionState } from '@/components/admin/ActionForm';
import { requireRole } from '@/lib/auth';
import { toPaise } from '@/lib/format';
import { refreshPublicSite } from '@/lib/revalidate';
import { createUserClient } from '@/lib/supabase/clients';

const optPaise = z.union([z.literal(''), z.coerce.number().min(0).max(1_000_000)]).transform(v => toPaise(v === '' ? null : v));
const optInt = z.union([z.literal(''), z.coerce.number().int().min(0).max(5000)]).transform(v => (v === '' ? null : v));

const schema = z.object({
  id: z.union([z.literal(''), z.uuid()]),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug: lowercase letters, numbers and hyphens').max(60),
  name: z.string().trim().min(2, 'Add a name').max(60),
  examples: z.string().trim().max(120),
  passengers: z.coerce.number().int().min(1, 'Passenger capacity must be at least 1').max(60),
  luggage: z.string().trim().max(120),
  image: z.string().max(80),
  best_for: z.string().trim().max(200),
  features: z.array(z.string().max(120)).max(12),
  sort: z.coerce.number().int().min(0).max(1000),
  ac: z.boolean(), active: z.boolean(), verified: z.boolean(),
  fleet_count: z.coerce.number().int().min(0).max(1000),
  fleet_details: z.string().trim().max(3000),
  per_km_rate_paise: optPaise, min_km_per_day: optInt, driver_allowance_per_day_paise: optPaise, night_charge_paise: optPaise, extra_hour_rate_paise: optPaise,
  pricing_notes: z.string().trim().max(2000),
});

export async function saveVehicle(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  const raw = Object.fromEntries(form);
  const parsed = schema.safeParse({
    ...raw,
    features: String(form.get('features') ?? '').split('\n').map(s => s.trim()).filter(Boolean),
    ac: form.get('ac') === 'on', active: form.get('active') === 'on', verified: form.get('verified') === 'on',
  });
  if (!parsed.success) return { error: 'Please fix the highlighted details.', fields: Object.fromEntries(parsed.error.issues.map(i => [String(i.path[0]), i.message])) };
  const { id, fleet_count, fleet_details, per_km_rate_paise, min_km_per_day, driver_allowance_per_day_paise, night_charge_paise, extra_hour_rate_paise, pricing_notes, ...pub } = parsed.data;
  const db = await createUserClient();

  const saved = id
    ? await db.from('vehicles').update(pub).eq('id', id).select('id').single()
    : await db.from('vehicles').insert(pub).select('id').single();
  if (saved.error) return { error: saved.error.code === '23505' ? 'Another vehicle already uses this slug.' : 'Could not save the vehicle.' };
  const internal = await db.from('vehicle_internal').upsert({
    vehicle_id: saved.data.id, fleet_count, fleet_details, per_km_rate_paise, min_km_per_day, driver_allowance_per_day_paise, night_charge_paise, extra_hour_rate_paise, pricing_notes,
  });
  if (internal.error) return { error: 'Vehicle saved, but fleet and pricing details could not be saved. Please try again.' };

  refreshPublicSite('catalog');
  if (!id) redirect(`/admin/vehicles/${saved.data.id}`);
  return { ok: 'Vehicle saved.', at: Date.now() };
}

/**
 * Deletes a vehicle category with its fleet record, unavailable dates and package prices (all cascade).
 * Past bookings keep the vehicle name they were made with. To hide a vehicle temporarily, untick "Active" instead.
 */
export async function deleteVehicle(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { error: 'Invalid request.' };
  const db = await createUserClient();
  const { error } = await db.from('vehicles').delete().eq('id', id.data);
  if (error) return { error: 'Could not delete the vehicle.' };
  refreshPublicSite('catalog');
  revalidatePath('/admin/vehicles', 'layout');
  redirect('/admin/vehicles?deleted=1');
}

// Availability: staff can block dates when vehicles are booked elsewhere or in maintenance.
export async function addBlock(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole('staff');
  const parsed = z.object({
    vehicle_id: z.uuid(), start_date: z.iso.date(), end_date: z.iso.date(),
    units: z.coerce.number().int().min(1).max(100), reason: z.string().trim().max(200),
  }).refine(v => v.end_date >= v.start_date, { message: 'End date must be on or after the start date' }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await createUserClient();
  const { error } = await db.from('vehicle_blocks').insert({ ...parsed.data, created_by: user.id });
  if (error) return { error: 'Could not save the unavailable dates.' };
  revalidatePath('/admin/vehicles', 'layout');
  return { ok: 'Dates blocked.', at: Date.now() };
}

export async function removeBlock(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('staff');
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { error: 'Invalid request.' };
  const db = await createUserClient();
  const { error } = await db.from('vehicle_blocks').delete().eq('id', id.data);
  if (error) return { error: 'Could not remove the block.' };
  revalidatePath('/admin/vehicles', 'layout');
  return { ok: 'Removed.', at: Date.now() };
}
