'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionState } from '@/components/admin/ActionForm';
import { priceColumns, readPrices } from '@/lib/admin-prices';
import { requireRole } from '@/lib/auth';
import { parseRupees } from '@/lib/format';
import { refreshPublicSite } from '@/lib/revalidate';
import { createUserClient } from '@/lib/supabase/clients';

const uuid = z.uuid();

/**
 * Saves the price table: for each package and vehicle, whether it's offered and at what price, plus each package's
 * price basis. Only the cells that changed are written, so the audit log shows exactly what was edited.
 * Typing a price also marks the vehicle as offered. A row's own Save button sends `only=<package id>`,
 * which saves just that package; "Save all prices" saves every row.
 */
export async function savePrices(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  const only = form.get('only');
  const packageIds = form.getAll('pkg').map(String).filter(id => !only || id === only);
  const vehicleIds = form.getAll('veh').map(String);
  if (!packageIds.every(id => uuid.safeParse(id).success) || !vehicleIds.every(id => uuid.safeParse(id).success)) return { error: 'Invalid request.' };

  const db = await createUserClient();
  const [current, pkgRes, vehRes] = await Promise.all([
    readPrices(db),
    db.from('packages').select('id, title, category, published, price_unit').in('id', packageIds),
    db.from('vehicles').select('id, name').in('id', vehicleIds),
  ]);
  if (pkgRes.error || vehRes.error) return { error: 'Could not load the packages. Please try again.' };
  const names = Object.fromEntries((vehRes.data ?? []).map(v => [v.id, v.name]));

  const problems: string[] = [];
  const inserts: { package_id: string; vehicle_id: string; price: number | null }[] = [];
  const updates: typeof inserts = [];
  const deletes: { package_id: string; vehicle_id: string }[] = [];
  const units: { id: string; price_unit: string }[] = [];

  for (const pkg of pkgRes.data ?? []) {
    let offeredCount = 0;
    for (const vid of vehicleIds) {
      const raw = String(form.get(`p:${pkg.id}:${vid}`) ?? '');
      const price = parseRupees(raw);
      const ticked = form.get(`o:${pkg.id}:${vid}`) === 'on';
      if (price === 'invalid') {
        if (ticked || raw.trim()) offeredCount++; // still offered: only the price needs fixing
        problems.push(`${pkg.title}, ${names[vid]}: "${raw.trim()}" isn't a price. Type a number such as 2500, or leave it empty`);
        continue;
      }
      const offered = ticked || price !== null;
      const was = current.find(r => r.package_id === pkg.id && r.vehicle_id === vid);
      if (offered) offeredCount++;
      if (offered && !was) inserts.push({ package_id: pkg.id, vehicle_id: vid, price });
      else if (offered && was && was.price !== price) updates.push({ package_id: pkg.id, vehicle_id: vid, price });
      else if (!offered && was) deletes.push({ package_id: pkg.id, vehicle_id: vid });
    }
    if (pkg.published && pkg.category !== 'custom' && offeredCount === 0) problems.push(`${pkg.title} is published, so it needs at least one vehicle`);
    const unit = String(form.get(`u:${pkg.id}`) ?? '').trim();
    if (unit.length > 80) problems.push(`${pkg.title}: keep the price basis under 80 characters`);
    else if (unit !== pkg.price_unit) units.push({ id: pkg.id, price_unit: unit });
  }
  if (problems.length) return { error: `Nothing was saved. Please fix: ${problems.join('; ')}.` };

  const changes = inserts.length + updates.length + deletes.length + units.length;
  if (!changes) return { ok: 'No changes to save.', at: Date.now() };

  const results = await Promise.all([
    inserts.length ? db.from('package_vehicles').insert(inserts.map(r => ({ package_id: r.package_id, vehicle_id: r.vehicle_id, ...priceColumns(r.price) }))) : null,
    ...updates.map(r => db.from('package_vehicles').update(priceColumns(r.price)).eq('package_id', r.package_id).eq('vehicle_id', r.vehicle_id)),
    ...deletes.map(r => db.from('package_vehicles').delete().eq('package_id', r.package_id).eq('vehicle_id', r.vehicle_id)),
    ...units.map(u => db.from('packages').update({ price_unit: u.price_unit }).eq('id', u.id)),
  ]);
  const failed = results.filter(r => r?.error).length;
  refreshPublicSite('catalog');
  revalidatePath('/admin/packages', 'layout');
  if (failed) return { error: `${changes - failed} of ${changes} changes were saved; ${failed} could not be. Please check the table and save again.` };
  return { ok: `Saved ${changes} change${changes > 1 ? 's' : ''}. The website shows the new prices now.`, at: Date.now() };
}
