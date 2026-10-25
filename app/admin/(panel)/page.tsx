import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Badge, bookingStatusLabel, enquiryStatusLabel, PageTitle } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { formatDate, formatPaise, todayInIndia } from '@/lib/format';
import { createUserClient } from '@/lib/supabase/clients';

type Props = { searchParams: Promise<{ denied?: string; password?: string }> };

export default async function Dashboard({ searchParams }: Props) {
  const user = await requireRole('staff');
  const { denied, password } = await searchParams;
  const db = await createUserClient();
  const today = todayInIndia();
  const weekAhead = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const count = (q: PromiseLike<{ count: number | null }>) => q.then(r => r.count ?? 0);

  // Every figure is counted from the database at request time.
  const [total, pending, confirmed, upcoming, newEnquiries, upcomingTrips, latest, followUps, accounting] = await Promise.all([
    count(db.from('bookings').select('id', { count: 'exact', head: true })),
    count(db.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    count(db.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed')),
    count(db.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed').gte('travel_date', today)),
    count(db.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new')),
    db.from('bookings').select('id, reference, name, package_title, travel_date, vehicle, passengers').eq('status', 'confirmed').gte('travel_date', today).lte('travel_date', weekAhead).order('travel_date').limit(8),
    db.from('bookings').select('id, reference, name, package_title, travel_date, status, created_at').in('status', ['pending', 'contacted']).order('created_at', { ascending: false }).limit(6),
    db.from('enquiries').select('id, name, source, status, next_follow_up, created_at').or(`status.eq.new,next_follow_up.lte.${today}`).not('status', 'in', '(converted,closed)').order('created_at', { ascending: false }).limit(6),
    db.from('site_settings').select('value').eq('key', 'accounting').maybeSingle(),
  ]);

  // Revenue only when the admin has marked payment records as reliable, and only for admins.
  const revenueReliable = (accounting.data?.value as { revenueReliable?: boolean } | undefined)?.revenueReliable === true;
  let revenue: { month: number; total: number } | null = null;
  if (revenueReliable && user.role === 'admin') {
    const { data } = await db.from('bookings').select('amount_paid_paise, travel_date').gt('amount_paid_paise', 0);
    const rows = (data ?? []) as { amount_paid_paise: number; travel_date: string }[];
    const sum = (rs: typeof rows) => rs.reduce((s, r) => s + Number(r.amount_paid_paise), 0);
    revenue = { total: sum(rows), month: sum(rows.filter(r => r.travel_date >= monthStart)) };
  }

  const kpis = [
    { label: 'Total bookings', value: total, href: '/admin/bookings' },
    { label: 'Pending requests', value: pending, href: '/admin/bookings?status=pending', attention: pending > 0 },
    { label: 'Confirmed trips', value: confirmed, href: '/admin/bookings?status=confirmed' },
    { label: 'Upcoming trips', value: upcoming, href: `/admin/bookings?status=confirmed&from=${today}` },
    { label: 'New enquiries', value: newEnquiries, href: '/admin/enquiries?status=new', attention: newEnquiries > 0 },
  ];

  return (
    <>
      <PageTitle title={`Hello${user.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}`} sub={formatDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      {password && <div className="alert alert--success" role="status"><Icon name="check-circle" /><div>Your password has been changed.</div></div>}
      {denied && <div className="alert alert--error" role="alert"><Icon name="alert" /><div>That section is for administrators only.</div></div>}

      <section className="kpis kpis--5" aria-label="Key figures">
        {kpis.map(k => (
          <Link key={k.label} href={k.href} className={`card kpi kpi--link${k.attention ? ' kpi--attention' : ''}`}>
            <div className="kpi__label">{k.label}</div>
            <div className="kpi__value">{k.value}</div>
          </Link>
        ))}
      </section>

      {user.role === 'admin' && (
        <section className="card card--pad" aria-labelledby="revenue-title">
          <h2 id="revenue-title" className="h4">Revenue</h2>
          {revenue ? (
            <dl className="details-list mt-4">
              <div><dt>Recorded payments, trips this month</dt><dd>{formatPaise(revenue.month)}</dd></div>
              <div><dt>Recorded payments, all time</dt><dd>{formatPaise(revenue.total)}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-muted mt-2">Hidden until payment records are complete. When every booking's payment is being recorded, turn on "Revenue figures are reliable" in <Link href="/admin/content?tab=accounting">Website content → Accounting</Link>.</p>
          )}
        </section>
      )}

      <div className="admin-grid">
        <section className="card" aria-labelledby="upcoming-title">
          <div className="card__head"><h2 id="upcoming-title">Trips in the next 7 days</h2><Link className="btn btn--ghost btn--sm" href={`/admin/bookings?status=confirmed&from=${today}`}>All upcoming</Link></div>
          {upcomingTrips.data?.length ? (
            <div className="table-wrap">
              <table className="table table--stack">
                <thead><tr><th scope="col">Date</th><th scope="col">Reference</th><th scope="col">Customer</th><th scope="col">Package</th></tr></thead>
                <tbody>
                  {upcomingTrips.data.map(b => (
                    <tr key={b.id}>
                      <td>{formatDate(b.travel_date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td><Link className="mono" href={`/admin/bookings/${b.id}`}>{b.reference}</Link></td>
                      <td>{b.name} · {b.passengers} pax</td>
                      <td data-hide-sm>{b.package_title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="empty-row">No confirmed trips in the next 7 days.</p>}
        </section>

        <section className="card" aria-labelledby="latest-title">
          <div className="card__head"><h2 id="latest-title">Waiting for confirmation</h2><Link className="btn btn--ghost btn--sm" href="/admin/bookings?status=pending">All</Link></div>
          {latest.data?.length ? (
            <ul className="list">
              {latest.data.map(b => (
                <li key={b.id}>
                  <div><Link href={`/admin/bookings/${b.id}`}><strong>{b.reference} · {b.name}</strong></Link><span>{b.package_title} · {formatDate(b.travel_date, { day: 'numeric', month: 'short' })}</span></div>
                  <Badge map={bookingStatusLabel} value={b.status} />
                </li>
              ))}
            </ul>
          ) : <p className="empty-row">Nothing waiting. Every request has been handled.</p>}
        </section>

        <section className="card" aria-labelledby="follow-title">
          <div className="card__head"><h2 id="follow-title">Enquiries to follow up</h2><Link className="btn btn--ghost btn--sm" href="/admin/enquiries">All</Link></div>
          {followUps.data?.length ? (
            <ul className="list">
              {followUps.data.map(e => (
                <li key={e.id}>
                  <div><Link href={`/admin/enquiries/${e.id}`}><strong>{e.name}</strong></Link><span>{e.source} enquiry{e.next_follow_up ? ` · follow up ${formatDate(e.next_follow_up, { day: 'numeric', month: 'short' })}` : ''}</span></div>
                  <Badge map={enquiryStatusLabel} value={e.status} />
                </li>
              ))}
            </ul>
          ) : <p className="empty-row">No enquiries need attention.</p>}
        </section>
      </div>
    </>
  );
}
