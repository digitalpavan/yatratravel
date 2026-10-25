import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { PageTitle } from '@/components/admin/ui';
import { readPrices } from '@/lib/admin-prices';
import { requireRole } from '@/lib/auth';
import { createUserClient } from '@/lib/supabase/clients';
import { savePrices } from './actions';

export const metadata: Metadata = { title: 'Package prices' };

/** Every package against every vehicle in one table, saved with one button. */
export default async function PricesPage() {
  await requireRole('admin');
  const db = await createUserClient();
  const [prices, { data: packages }, { data: vehicles }] = await Promise.all([
    readPrices(db),
    db.from('packages').select('id, title, published, price_unit').order('popularity', { ascending: false }),
    db.from('vehicles').select('id, name, passengers, active').order('sort'),
  ]);
  const cell = (pid: string, vid: string) => prices.find(r => r.package_id === pid && r.vehicle_id === vid);

  return (
    <>
      <PageTitle back={{ href: '/admin/packages', label: 'Packages' }} title="Package prices"
        sub="Set the price of each package for each vehicle. Leave a price empty to show &quot;Price on request&quot;. Only enter prices the business has confirmed." />

      <ActionForm action={savePrices} className="stack-lg price-form">
        {(vehicles ?? []).map(v => <input key={v.id} type="hidden" name="veh" value={v.id} />)}
        <section className="card">
          <div className="table-wrap">
            <table className="table price-grid">
              <caption className="visually-hidden">Price per vehicle for each package, in rupees</caption>
              <thead>
                <tr>
                  <th scope="col">Package</th>
                  {(vehicles ?? []).map(v => <th scope="col" key={v.id}>{v.name}<br /><span className="text-xs text-muted">up to {v.passengers}{!v.active && ' · hidden'}</span></th>)}
                  <th scope="col">Price basis</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {(packages ?? []).map(p => (
                  <tr key={p.id}>
                    <th scope="row">
                      <input type="hidden" name="pkg" value={p.id} />
                      <Link href={`/admin/packages/${p.id}`}>{p.title}</Link><br />
                      {p.published ? <span className="badge badge--success">Published</span> : <span className="badge">Draft</span>}
                    </th>
                    {(vehicles ?? []).map(v => {
                      const c = cell(p.id, v.id);
                      return (
                        <td key={v.id}>
                          <label className="check text-sm"><input type="checkbox" name={`o:${p.id}:${v.id}`} defaultChecked={!!c} /> Offered</label>
                          <div className="input-group input-group--sm mt-2">
                            <span className="input-group__addon">₹</span>
                            <input className="input" name={`p:${p.id}:${v.id}`} inputMode="decimal" defaultValue={c?.price ?? ''} placeholder="On request" aria-label={`${p.title}, ${v.name} price in rupees`} />
                          </div>
                        </td>
                      );
                    })}
                    <td>
                      <input className="input input--sm" name={`u:${p.id}`} defaultValue={p.price_unit} placeholder="per vehicle, full day" aria-label={`${p.title} price basis`} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <SubmitButton size="sm" variant="primary" name="only" value={p.id}><Icon name="check" size={16} />Save</SubmitButton>
                        <Link className="btn btn--outline btn--sm" href={`/admin/packages/${p.id}`}><Icon name="edit" size={16} />Edit</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="card card--pad sticky-save">
          <span className="text-sm text-muted">Type prices as numbers, for example 2500 (₹, Rs. and commas are fine). Typing a price marks that vehicle as offered; untick and clear it to stop offering it. Save one row with its own button, or every row here.</span>
          <SubmitButton variant="primary"><Icon name="check" size={18} />Save all prices</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
