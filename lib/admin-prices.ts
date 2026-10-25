import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toPaise, toRupees } from '@/lib/format';

// Package prices per vehicle, in rupees for the dashboard. The database stores whole paise (package_vehicles.price_paise).
// Every dashboard read and write of prices goes through here.

export type PriceRow = { package_id: string; vehicle_id: string; price: number | null };

export async function readPrices(db: SupabaseClient): Promise<PriceRow[]> {
  const { data, error } = await db.from('package_vehicles').select('package_id, vehicle_id, price_paise');
  if (error) throw new Error(`Could not load prices: ${error.message}`);
  return (data as { package_id: string; vehicle_id: string; price_paise: number | null }[])
    .map(r => ({ package_id: r.package_id, vehicle_id: r.vehicle_id, price: toRupees(r.price_paise) }));
}

/** The column values to store for a price in rupees (null = on request). */
export const priceColumns = (price: number | null) => ({ price_paise: toPaise(price) });
