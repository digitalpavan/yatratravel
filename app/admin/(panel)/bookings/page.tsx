import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Badge, bookingStatusLabel, PageTitle, Pager, paymentStatusLabel, searchTerm } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { createUserClient } from '@/lib/supabase/clients';

export const metadata: Metadata = { title: 'Bookings' };

const PAGE_SIZE = 25;
const STATUSES = ['requested', 'confirmed', 'completed', 'cancelled'] as const;
type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function BookingsPage({ searchParams }: Props) {
  const user = await requireRole('staff');
  const sp = await searchParams;
  const q = searchTerm(sp.q ?? '');
  const status = STATUSES.includes(sp.status as never) ? sp.status! : '';
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? '') ? sp.from! : '';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? '') ? sp.to! : '';
  const page = Math.max(1, Number(sp.page) || 1);

  const db = await createUserClient();
  let query = db.from('bookings')
    .select('id, reference, status, payment_status, name, phone, package_title, travel_date, passengers, created_at', { count: 'exact' });
  if (q) query = query.or(`reference.ilike.*${q}*,name.ilike.*${q}*,phone.ilike.*${q.replace(/\D/g, '') || q}*`);
  if (status) query = query.eq('status', status);
  if (from) query = query.gte('travel_date', from);
  if (to) query = query.lte('travel_date', to);
  const { data: rows, count, error } = await query
    .order(status === 'confirmed' ? 'travel_date' : 'created_at', { ascending: status === 'confirmed' })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const filters = new URLSearchParams(Object.entries({ q, status, from, to }).filter(([, v]) => v) as [string, string][]);
  const pageHref = (n: number) => { const p = new URLSearchParams(filters); if (n > 1) p.set('page', String(n)); return `/admin/bookings?${p}`; };

  return (
    <>
      <PageTitle title="Bookings" sub={`${count ?? 0} matching`}
        actions={user.role === 'admin' && <a className="btn btn--outline btn--sm" href={`/admin/bookings/export?${filters}`}><Icon name="download" />Export CSV</a>} />

      <form className="card card--pad filter-bar" role="search" aria-label="Filter bookings">
        <div className="field"><label className="label" htmlFor="q">Reference, name or phone</label><input className="input" id="q" name="q" defaultValue={q} placeholder="YT-261024-…" /></div>
        <div className="field"><label className="label" htmlFor="status">Status</label>
          <select className="select" id="status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{bookingStatusLabel[s][1]}</option>)}
          </select>
        </div>
        <div className="field"><label className="label" htmlFor="from">Travel from</label><input className="input" id="from" name="from" type="date" defaultValue={from} /></div>
        <div className="field"><label className="label" htmlFor="to">Travel to</label><input className="input" id="to" name="to" type="date" defaultValue={to} /></div>
        <div className="filter-bar__actions"><button className="btn btn--secondary" type="submit">Apply</button>{filters.size > 0 && <Link className="btn btn--ghost" href="/admin/bookings">Clear</Link>}</div>
      </form>

      <section className="card">
        {error && <p className="alert alert--error" role="alert">Could not load bookings: {error.message}</p>}
        {rows?.length ? (
          <div className="table-wrap">
            <table className="table table--stack">
              <caption className="visually-hidden">Bookings</caption>
              <thead><tr><th scope="col">Reference</th><th scope="col">Customer</th><th scope="col">Package</th><th scope="col">Travel date</th><th scope="col">Status</th><th scope="col">Payment</th><th scope="col">Received</th></tr></thead>
              <tbody>
                {rows.map(b => (
                  <tr key={b.id}>
                    <td><Link className="mono" href={`/admin/bookings/${b.id}`}>{b.reference}</Link></td>
                    <td><strong>{b.name}</strong><br /><span className="text-muted">+91 {b.phone} · {b.passengers} pax</span></td>
                    <td data-hide-sm>{b.package_title}</td>
                    <td>{formatDate(b.travel_date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td><Badge map={bookingStatusLabel} value={b.status} /></td>
                    <td><Badge map={paymentStatusLabel} value={b.payment_status} /></td>
                    <td data-hide-sm className="text-muted">{formatDate(b.created_at.slice(0, 10), { day: 'numeric', month: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !error && (
          <div className="empty-state" style={{ border: 0 }}>
            <span className="empty-state__icon"><Icon name="clipboard" size={28} /></span>
            <h2 className="h4">{filters.size ? 'No bookings match these filters' : 'No bookings yet'}</h2>
            <p>{filters.size ? 'Try a different reference, date range or status.' : 'Booking requests from the website will appear here.'}</p>
          </div>
        )}
      </section>
      <Pager page={page} pages={Math.ceil((count ?? 0) / PAGE_SIZE)} href={pageHref} />
    </>
  );
}
