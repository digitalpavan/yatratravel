import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Flash, PageTitle } from '@/components/admin/ui';
import { readPrices } from '@/lib/admin-prices';
import { requireRole } from '@/lib/auth';
import { categoryLabels, type PackageCategory } from '@/lib/catalog';
import { formatPrice } from '@/lib/format';
import { createUserClient } from '@/lib/supabase/clients';
import { deletePackage } from './actions';

export const metadata: Metadata = { title: 'Packages' };

export default async function PackagesAdmin({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  await requireRole('admin');
  const { deleted } = await searchParams;
  const db = await createUserClient();
  const [{ data }, { data: vehicles }, prices] = await Promise.all([
    db.from('packages').select('id, slug, title, category, published, featured, price_unit').order('popularity', { ascending: false }),
    db.from('vehicles').select('id, name, sort').order('sort'),
    readPrices(db),
  ]);
  const vehicleName = (id: string) => vehicles?.find(v => v.id === id)?.name ?? 'Vehicle';
  const vehicleSort = (id: string) => vehicles?.find(v => v.id === id)?.sort ?? 0;

  return (
    <>
      <PageTitle title="Packages" sub="Changes go live on the website as soon as you save a published package."
        actions={<>
          <Link className="btn btn--outline btn--sm" href="/admin/packages/prices"><Icon name="rupee" />Edit all prices</Link>
          <Link className="btn btn--primary btn--sm" href="/admin/packages/new"><Icon name="plus" />Add package</Link>
        </>} />
      <Flash ok={deleted ? 'Package removed.' : undefined} />
      <section className="card">
        <div className="table-wrap">
          <table className="table table--stack">
            <caption className="visually-hidden">Packages</caption>
            <thead><tr><th scope="col">Package</th><th scope="col">Type</th><th scope="col">Price per vehicle</th><th scope="col" className="num">From</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {(data ?? []).map(p => {
                const offers = prices.filter(r => r.package_id === p.id).sort((a, b) => vehicleSort(a.vehicle_id) - vehicleSort(b.vehicle_id));
                const set = offers.map(o => o.price).filter((x): x is number => x !== null);
                return (
                  <tr key={p.id}>
                    <td><Link href={`/admin/packages/${p.id}`}><strong>{p.title}</strong></Link><br /><span className="text-muted mono">/packages/{p.slug}</span></td>
                    <td data-hide-sm>{categoryLabels[p.category as PackageCategory]}</td>
                    <td>
                      {offers.length === 0 ? <span className="text-muted">No vehicles</span> : (
                        <ul className="price-list">
                          {offers.map(o => <li key={o.vehicle_id}>{vehicleName(o.vehicle_id)}: {o.price !== null ? <strong>{formatPrice(o.price)}</strong> : <span>on request</span>}</li>)}
                        </ul>
                      )}
                      {p.price_unit && <span className="text-xs text-muted">{p.price_unit}</span>}
                    </td>
                    <td className="num">{set.length ? <strong>{formatPrice(Math.min(...set))}</strong> : <span className="text-muted">On request</span>}</td>
                    <td>{p.published ? <span className="badge badge--success">Published</span> : <span className="badge">Draft</span>}{p.featured && <> <span className="badge badge--gold">Featured</span></>}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="btn btn--outline btn--sm" href={`/admin/packages/${p.id}`}><Icon name="edit" size={16} />Edit</Link>
                        <ActionForm action={deletePackage} className="" confirm={`Remove "${p.title}" permanently? It disappears from the website; existing bookings keep their package name. To hide it for now, edit it and untick "Published" instead.`}>
                          <input type="hidden" name="id" value={p.id} />
                          <SubmitButton size="sm" variant="ghost-danger"><Icon name="trash" size={16} />Remove</SubmitButton>
                        </ActionForm>
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
