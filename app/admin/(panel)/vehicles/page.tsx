import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Flash, PageTitle } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { formatDate, todayInIndia } from '@/lib/format';
import { createUserClient } from '@/lib/supabase/clients';
import { deleteVehicle } from './actions';

export const metadata: Metadata = { title: 'Vehicles' };

export default async function VehiclesAdmin({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await requireRole('staff');
  const { deleted } = await searchParams;
  const isAdmin = user.role === 'admin';
  const db = await createUserClient();
  const today = todayInIndia();
  const [{ data: vehicles }, { data: blocks }] = await Promise.all([
    db.from('vehicles').select('id, slug, name, passengers, luggage, active, verified, vehicle_internal(fleet_count), package_vehicles(package_id)').order('sort'),
    db.from('vehicle_blocks').select('vehicle_id, start_date, end_date, units').gte('end_date', today),
  ]);

  return (
    <>
      <PageTitle title="Vehicles" sub="Categories shown on the website, the real fleet behind them, and unavailable dates."
        actions={isAdmin && <Link className="btn btn--primary btn--sm" href="/admin/vehicles/new"><Icon name="plus" />Add vehicle</Link>} />
      <Flash ok={deleted ? 'Vehicle removed.' : undefined} />
      <section className="card">
        <div className="table-wrap">
          <table className="table table--stack">
            <caption className="visually-hidden">Vehicle categories</caption>
            <thead><tr><th scope="col">Category</th><th scope="col">Capacity</th><th scope="col">Fleet</th><th scope="col">Unavailable</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {(vehicles ?? []).map(v => {
                const internal = (v.vehicle_internal as unknown as { fleet_count: number } | null);
                const usedBy = (v.package_vehicles as unknown as unknown[]).length;
                const upcoming = (blocks ?? []).filter(b => b.vehicle_id === v.id);
                return (
                  <tr key={v.id}>
                    <td><Link href={`/admin/vehicles/${v.id}`}><strong>{v.name}</strong></Link><br /><span className="text-xs text-muted">{usedBy ? `In ${usedBy} package${usedBy > 1 ? 's' : ''}` : 'Not in any package'}</span></td>
                    <td>{v.passengers} passengers<br /><span className="text-muted">{v.luggage}</span></td>
                    <td>{internal?.fleet_count ? `${internal.fleet_count} vehicle${internal.fleet_count > 1 ? 's' : ''}` : <span className="text-accent">Not recorded</span>}</td>
                    <td data-hide-sm>{upcoming.length ? upcoming.slice(0, 2).map(b => `${formatDate(b.start_date, { day: 'numeric', month: 'short' })}–${formatDate(b.end_date, { day: 'numeric', month: 'short' })}`).join(', ') : '—'}</td>
                    <td>{v.active ? <span className="badge badge--success">Active</span> : <span className="badge">Hidden</span>}{!v.verified && <> <span className="badge badge--pending">Unverified</span></>}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="btn btn--outline btn--sm" href={`/admin/vehicles/${v.id}`}><Icon name="edit" size={16} />{isAdmin ? 'Edit' : 'View'}</Link>
                        {isAdmin && (
                          <ActionForm action={deleteVehicle} className="" confirm={`Remove "${v.name}" permanently?${usedBy ? ` It will also be removed from ${usedBy} package${usedBy > 1 ? 's' : ''}.` : ''} To hide it for now, edit it and untick "Active" instead.`}>
                            <input type="hidden" name="id" value={v.id} />
                            <SubmitButton size="sm" variant="ghost-danger"><Icon name="trash" size={16} />Remove</SubmitButton>
                          </ActionForm>
                        )}
                      </div>
                    </td>
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
