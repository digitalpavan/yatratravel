import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { PageTitle } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { formatDate, todayInIndia } from '@/lib/format';
import { createUserClient } from '@/lib/supabase/clients';

export const metadata: Metadata = { title: 'Vehicles' };

export default async function VehiclesAdmin() {
  const user = await requireRole('staff');
  const db = await createUserClient();
  const today = todayInIndia();
  const [{ data: vehicles }, { data: blocks }] = await Promise.all([
    db.from('vehicles').select('id, slug, name, passengers, luggage, active, verified, vehicle_internal(fleet_count, per_km_rate)').order('sort'),
    db.from('vehicle_blocks').select('vehicle_id, start_date, end_date, units').gte('end_date', today),
  ]);

  return (
    <>
      <PageTitle title="Vehicles" sub="Categories shown on the website, the real fleet behind them, and unavailable dates."
        actions={user.role === 'admin' && <Link className="btn btn--primary btn--sm" href="/admin/vehicles/new"><Icon name="plus" />Add category</Link>} />
      <section className="card">
        <div className="table-wrap">
          <table className="table table--stack">
            <caption className="visually-hidden">Vehicle categories</caption>
            <thead><tr><th scope="col">Category</th><th scope="col">Capacity</th><th scope="col">Fleet</th><th scope="col">Unavailable</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {(vehicles ?? []).map(v => {
                const internal = (v.vehicle_internal as unknown as { fleet_count: number; per_km_rate: number | null } | null);
                const upcoming = (blocks ?? []).filter(b => b.vehicle_id === v.id);
                return (
                  <tr key={v.id}>
                    <td><Link href={`/admin/vehicles/${v.id}`}><strong>{v.name}</strong></Link></td>
                    <td>{v.passengers} passengers<br /><span className="text-muted">{v.luggage}</span></td>
                    <td>{internal?.fleet_count ? `${internal.fleet_count} vehicle${internal.fleet_count > 1 ? 's' : ''}` : <span className="text-accent">Not recorded</span>}</td>
                    <td data-hide-sm>{upcoming.length ? upcoming.slice(0, 2).map(b => `${formatDate(b.start_date, { day: 'numeric', month: 'short' })}–${formatDate(b.end_date, { day: 'numeric', month: 'short' })}`).join(', ') : '—'}</td>
                    <td>{v.active ? <span className="badge badge--success">Active</span> : <span className="badge">Hidden</span>}{!v.verified && <> <span className="badge badge--pending">Unverified</span></>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
