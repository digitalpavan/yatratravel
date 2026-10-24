import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDateTime, PageTitle, Pager } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { createUserClient } from '@/lib/supabase/clients';

export const metadata: Metadata = { title: 'Audit log' };
const PAGE_SIZE = 50;
const ENTITIES = ['bookings', 'enquiries', 'packages', 'package_vehicles', 'vehicles', 'vehicle_internal', 'vehicle_blocks', 'destinations', 'site_settings', 'blog_posts', 'profiles', 'media'];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string; page?: string }> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const entity = ENTITIES.includes(sp.entity ?? '') ? sp.entity! : '';
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await createUserClient();
  let q = db.from('audit_log').select('id, actor_email, action, entity, entity_id, details, created_at', { count: 'exact' });
  if (entity) q = q.eq('entity', entity);
  const { data, count } = await q.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const describe = (d: Record<string, unknown>) => {
    if (d.changed) return Object.entries(d.changed as Record<string, unknown>).map(([k, v]) => (Array.isArray(v) ? `${k}: ${v[0] ?? '∅'} → ${v[1] ?? '∅'}` : `${k} changed`)).join('; ');
    if (d.label) return String(d.label);
    return Object.keys(d).length ? JSON.stringify(d) : '';
  };

  return (
    <>
      <PageTitle title="Audit log" sub="Every change to bookings, enquiries, catalogue, content and accounts, plus exports and password resets. Entries can't be edited or deleted." />
      <form className="card card--pad filter-bar">
        <div className="field"><label className="label" htmlFor="entity">Area</label>
          <select className="select" id="entity" name="entity" defaultValue={entity}><option value="">Everything</option>{ENTITIES.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}</select>
        </div>
        <div className="filter-bar__actions"><button className="btn btn--secondary" type="submit">Filter</button></div>
      </form>
      <section className="card">
        <div className="table-wrap">
          <table className="table table--stack">
            <caption className="visually-hidden">Audit entries</caption>
            <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Details</th></tr></thead>
            <tbody>
              {(data ?? []).map(a => (
                <tr key={a.id}>
                  <td className="text-sm">{formatDateTime(a.created_at)}</td>
                  <td className="text-sm">{a.actor_email ?? <span className="text-muted">Website / system</span>}</td>
                  <td className="text-sm"><strong>{a.action}</strong> {a.entity.replace(/_/g, ' ')}{a.entity === 'bookings' && a.entity_id && <> · <Link href={`/admin/bookings/${a.entity_id}`}>open</Link></>}</td>
                  <td className="text-sm audit-details">{describe(a.details as Record<string, unknown>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Pager page={page} pages={Math.ceil((count ?? 0) / PAGE_SIZE)} href={n => `/admin/audit?${new URLSearchParams({ ...(entity && { entity }), ...(n > 1 && { page: String(n) }) })}`} />
    </>
  );
}
