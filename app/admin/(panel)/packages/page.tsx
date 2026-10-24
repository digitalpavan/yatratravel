import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Flash, PageTitle } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { categoryLabels, type PackageCategory } from '@/lib/catalog';
import { formatPrice } from '@/lib/format';
import { createUserClient } from '@/lib/supabase/clients';

export const metadata: Metadata = { title: 'Packages' };

export default async function PackagesAdmin({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  await requireRole('admin');
  const { deleted } = await searchParams;
  const db = await createUserClient();
  const { data } = await db.from('packages').select('id, slug, title, category, published, featured, popularity, updated_at, package_vehicles(price)').order('popularity', { ascending: false });

  return (
    <>
      <PageTitle title="Packages" sub="Changes go live on the website as soon as you save a published package."
        actions={<Link className="btn btn--primary btn--sm" href="/admin/packages/new"><Icon name="plus" />New package</Link>} />
      <Flash ok={deleted ? 'Package deleted.' : undefined} />
      <section className="card">
        <div className="table-wrap">
          <table className="table table--stack">
            <caption className="visually-hidden">Packages</caption>
            <thead><tr><th scope="col">Package</th><th scope="col">Type</th><th scope="col">Prices</th><th scope="col" className="num">From</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {(data ?? []).map(p => {
                const prices = (p.package_vehicles as { price: number | null }[]).map(v => v.price).filter((x): x is number => x !== null);
                const total = (p.package_vehicles as unknown[]).length;
                return (
                  <tr key={p.id}>
                    <td><Link href={`/admin/packages/${p.id}`}><strong>{p.title}</strong></Link><br /><span className="text-muted mono">/packages/{p.slug}</span></td>
                    <td data-hide-sm>{categoryLabels[p.category as PackageCategory]}</td>
                    <td>{total === 0 ? <span className="text-muted">No vehicles</span> : <span className={prices.length < total ? 'text-accent' : undefined}>{prices.length} of {total} set</span>}</td>
                    <td className="num">{prices.length ? formatPrice(Math.min(...prices)) : <span className="text-muted">On request</span>}</td>
                    <td>{p.published ? <span className="badge badge--success">Published</span> : <span className="badge">Draft</span>}{p.featured && <> <span className="badge badge--gold">Featured</span></>}</td>
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
