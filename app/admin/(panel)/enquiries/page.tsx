import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Badge, enquiryStatusLabel, PageTitle, Pager, searchTerm } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { formatDate, todayInIndia } from '@/lib/format';
import { createUserClient } from '@/lib/supabase/clients';

export const metadata: Metadata = { title: 'Enquiries' };
const PAGE_SIZE = 25;
const STATUSES = ['new', 'contacted', 'follow_up', 'converted', 'closed'] as const;
type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function EnquiriesPage({ searchParams }: Props) {
  const user = await requireRole('staff');
  const sp = await searchParams;
  const q = searchTerm(sp.q ?? '');
  const status = STATUSES.includes(sp.status as never) ? sp.status! : '';
  const assigned = ['me', 'unassigned'].includes(sp.assigned ?? '') ? sp.assigned! : '';
  const page = Math.max(1, Number(sp.page) || 1);
  const today = todayInIndia();

  const db = await createUserClient();
  let query = db.from('enquiries').select('id, name, phone, source, status, message, travel_date, next_follow_up, created_at, assigned_to, profiles(full_name, email)', { count: 'exact' });
  if (q) query = query.or(`name.ilike.*${q}*,phone.ilike.*${q.replace(/\D/g, '') || q}*,message.ilike.*${q}*`);
  if (status) query = query.eq('status', status);
  if (assigned === 'me') query = query.eq('assigned_to', user.id);
  if (assigned === 'unassigned') query = query.is('assigned_to', null);
  const { data: rows, count } = await query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const filters = new URLSearchParams(Object.entries({ q, status, assigned }).filter(([, v]) => v) as [string, string][]);
  const pageHref = (n: number) => { const p = new URLSearchParams(filters); if (n > 1) p.set('page', String(n)); return `/admin/enquiries?${p}`; };

  return (
    <>
      <PageTitle title="Enquiries" sub={`${count ?? 0} matching`} />
      <form className="card card--pad filter-bar" role="search" aria-label="Filter enquiries">
        <div className="field"><label className="label" htmlFor="q">Customer name, phone or message</label><input className="input" id="q" name="q" defaultValue={q} /></div>
        <div className="field"><label className="label" htmlFor="status">Status</label>
          <select className="select" id="status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{enquiryStatusLabel[s][1]}</option>)}
          </select>
        </div>
        <div className="field"><label className="label" htmlFor="assigned">Assigned</label>
          <select className="select" id="assigned" name="assigned" defaultValue={assigned}>
            <option value="">Everyone</option><option value="me">Assigned to me</option><option value="unassigned">Unassigned</option>
          </select>
        </div>
        <div className="filter-bar__actions"><button className="btn btn--secondary" type="submit">Apply</button>{filters.size > 0 && <Link className="btn btn--ghost" href="/admin/enquiries">Clear</Link>}</div>
      </form>

      <section className="card">
        {rows?.length ? (
          <div className="table-wrap">
            <table className="table table--stack">
              <caption className="visually-hidden">Enquiries</caption>
              <thead><tr><th scope="col">Customer</th><th scope="col">Message</th><th scope="col">Source</th><th scope="col">Status</th><th scope="col">Follow up</th><th scope="col">Assigned</th></tr></thead>
              <tbody>
                {rows.map(e => {
                  const who = e.profiles as unknown as { full_name: string; email: string } | null;
                  const overdue = e.next_follow_up && e.next_follow_up <= today && !['converted', 'closed'].includes(e.status);
                  return (
                    <tr key={e.id}>
                      <td><Link href={`/admin/enquiries/${e.id}`}><strong>{e.name}</strong></Link><br /><span className="text-muted">+91 {e.phone}</span></td>
                      <td data-hide-sm className="truncate">{e.message}</td>
                      <td data-hide-sm>{e.source}</td>
                      <td><Badge map={enquiryStatusLabel} value={e.status} /></td>
                      <td className={overdue ? 'text-error' : undefined}>{e.next_follow_up ? formatDate(e.next_follow_up, { day: 'numeric', month: 'short' }) : '—'}</td>
                      <td data-hide-sm>{who ? who.full_name || who.email : <span className="text-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ border: 0 }}>
            <span className="empty-state__icon"><Icon name="inbox" size={28} /></span>
            <h2 className="h4">{filters.size ? 'No enquiries match these filters' : 'No enquiries yet'}</h2>
            <p>Enquiries from the contact, package, darshan and vehicle pages appear here.</p>
          </div>
        )}
      </section>
      <Pager page={page} pages={Math.ceil((count ?? 0) / PAGE_SIZE)} href={pageHref} />
    </>
  );
}
