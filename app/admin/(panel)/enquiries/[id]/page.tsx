import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Badge, enquiryStatusLabel, formatDateTime, PageTitle } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { createUserClient } from '@/lib/supabase/clients';
import { addEnquiryNote, updateEnquiry } from '../actions';

export const metadata: Metadata = { title: 'Enquiry' };
type Props = { params: Promise<{ id: string }> };

export default async function EnquiryDetail({ params }: Props) {
  const user = await requireRole('staff');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createUserClient();
  const [{ data: e }, notes, staff] = await Promise.all([
    db.from('enquiries').select('*').eq('id', id).maybeSingle(),
    db.from('enquiry_notes').select('id, body, created_at, profiles(full_name, email)').eq('enquiry_id', id).order('created_at', { ascending: false }),
    db.from('profiles').select('id, full_name, email').eq('active', true).order('full_name'),
  ]);
  if (!e) notFound();
  // No name in the greeting: click-to-chat text travels in a URL (see lib/whatsapp.ts).
  const waText = 'Hello, this is Yatra Travels replying to your enquiry.';

  return (
    <>
      <PageTitle back={{ href: '/admin/enquiries', label: 'Enquiries' }} title={e.name}
        sub={<>{e.source} enquiry · {formatDateTime(e.created_at)} · <Badge map={enquiryStatusLabel} value={e.status} /></>} />
      <div className="admin-grid">
        <div className="stack-lg">
          <section className="card card--pad" aria-labelledby="msg-title">
            <h2 id="msg-title" className="h4">Message</h2>
            <p className="pre mt-4">{e.message}</p>
            <dl className="details-list mt-5">
              {e.package_slug && <div><dt>About</dt><dd><Link href={`/packages/${e.package_slug}`} target="_blank">{e.package_slug}</Link></dd></div>}
              {e.travel_date && <div><dt>Travel date</dt><dd>{formatDate(e.travel_date)}</dd></div>}
            </dl>
          </section>

          <section className="card card--pad" aria-labelledby="follow-title">
            <h2 id="follow-title" className="h4">Follow-up</h2>
            <ActionForm action={updateEnquiry} className="form-grid form-grid--3 mt-4">
              <input type="hidden" name="id" value={e.id} />
              <div className="field"><label className="label" htmlFor="status">Status</label>
                <select className="select" id="status" name="status" defaultValue={e.status}>
                  {Object.entries(enquiryStatusLabel).map(([v, [, l]]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field"><label className="label" htmlFor="next_follow_up">Next follow-up</label><input className="input" type="date" id="next_follow_up" name="next_follow_up" defaultValue={e.next_follow_up ?? ''} /></div>
              <div className="field"><label className="label" htmlFor="assigned_to">Assigned to</label>
                <select className="select" id="assigned_to" name="assigned_to" defaultValue={e.assigned_to ?? ''}>
                  <option value="">Unassigned</option>
                  {(staff.data ?? []).map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}{s.id === user.id ? ' (me)' : ''}</option>)}
                </select>
              </div>
              <div className="span-all"><SubmitButton size="sm">Save follow-up</SubmitButton></div>
            </ActionForm>
          </section>

          <section className="card card--pad" aria-labelledby="notes-title">
            <h2 id="notes-title" className="h4">Follow-up notes</h2>
            <ActionForm action={addEnquiryNote} resetOnSuccess className="stack mt-4">
              <input type="hidden" name="id" value={e.id} />
              <label className="visually-hidden" htmlFor="note">New note</label>
              <textarea className="textarea" id="note" name="body" maxLength={2000} placeholder="e.g. Sent quote on WhatsApp, customer will confirm by Friday" required />
              <div><SubmitButton size="sm">Add note</SubmitButton></div>
            </ActionForm>
            <ul className="notes">
              {(notes.data ?? []).map(n => {
                const author = n.profiles as unknown as { full_name: string; email: string } | null;
                return <li key={n.id}><p className="pre">{n.body}</p><span>{author?.full_name || author?.email} · {formatDateTime(n.created_at)}</span></li>;
              })}
            </ul>
          </section>
        </div>

        <aside className="stack-lg">
          <section className="card card--pad" aria-labelledby="cust-title">
            <h2 id="cust-title" className="h4">Contact</h2>
            <p className="text-sm mt-2">+91 {e.phone}{e.email && <><br />{e.email}</>}</p>
            <p className="text-xs text-muted mt-2">Consent given {formatDateTime(e.consent_at)}</p>
            <div className="stack mt-4">
              <a className="btn btn--whatsapp btn--block" href={`https://wa.me/91${e.phone}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener"><Icon name="whatsapp" />Open WhatsApp chat</a>
              <a className="btn btn--outline btn--block" href={`tel:+91${e.phone}`}><Icon name="phone" />Call</a>
              {e.email && <a className="btn btn--ghost btn--block" href={`mailto:${e.email}`}><Icon name="mail" />Email</a>}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
