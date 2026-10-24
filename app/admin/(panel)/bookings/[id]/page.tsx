import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Badge, bookingStatusLabel, formatDateTime, PageTitle, paymentStatusLabel } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { createUserClient } from '@/lib/supabase/clients';
import { addBookingNote, assignBooking, updateBookingStatus, updatePayment } from '../actions';

export const metadata: Metadata = { title: 'Booking' };
type Props = { params: Promise<{ id: string }> };

const NEXT_STATUS: Record<string, { status: string; label: string; variant: string; confirm?: string }[]> = {
  requested: [
    { status: 'confirmed', label: 'Confirm booking', variant: 'primary', confirm: 'Confirm this booking? Make sure you have agreed the price and vehicle with the customer.' },
    { status: 'cancelled', label: 'Cancel request', variant: 'outline', confirm: 'Cancel this booking request? This cannot be undone.' },
  ],
  confirmed: [
    { status: 'completed', label: 'Mark trip completed', variant: 'secondary' },
    { status: 'cancelled', label: 'Cancel booking', variant: 'outline', confirm: 'Cancel this confirmed booking? This cannot be undone.' },
  ],
};

export default async function BookingDetail({ params }: Props) {
  const user = await requireRole('staff');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createUserClient();

  const [{ data: b }, notes, staff, history] = await Promise.all([
    db.from('bookings').select('*').eq('id', id).maybeSingle(),
    db.from('booking_notes').select('id, body, created_at, profiles(full_name, email)').eq('booking_id', id).order('created_at', { ascending: false }),
    db.from('profiles').select('id, full_name, email').eq('active', true).order('full_name'),
    // RLS returns history to admins only.
    db.from('audit_log').select('id, action, actor_email, details, created_at').eq('entity', 'bookings').eq('entity_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  if (!b) notFound();

  const phone = `+91${b.phone}`;
  const waText = `Hello ${b.name.split(' ')[0]}, this is Yatra Travels about your booking ${b.reference} (${b.package_title}, ${formatDate(b.travel_date)}).`;

  return (
    <>
      <PageTitle back={{ href: '/admin/bookings', label: 'Bookings' }} title={b.reference}
        sub={<>Received {formatDateTime(b.created_at)} · <Badge map={bookingStatusLabel} value={b.status} /> <Badge map={paymentStatusLabel} value={b.payment_status} /></>} />

      <div className="admin-grid">
        <div className="stack-lg">
          <section className="card card--pad" aria-labelledby="trip-title">
            <h2 id="trip-title" className="h4">Trip</h2>
            <dl className="details-list mt-4">
              <div><dt>Package</dt><dd>{b.package_title}</dd></div>
              <div><dt>Travel date</dt><dd>{formatDate(b.travel_date)}</dd></div>
              <div><dt>Travellers</dt><dd>{b.passengers}</dd></div>
              <div><dt>Vehicle</dt><dd>{b.vehicle === 'any' ? 'Customer asked us to suggest' : b.vehicle}</dd></div>
              <div style={{ gridColumn: '1 / -1' }}><dt>Pickup</dt><dd>{b.pickup}</dd></div>
              {b.requests && <div style={{ gridColumn: '1 / -1' }}><dt>Special requests</dt><dd className="pre">{b.requests}</dd></div>}
            </dl>
          </section>

          <section className="card card--pad" aria-labelledby="status-title">
            <h2 id="status-title" className="h4">Status</h2>
            {NEXT_STATUS[b.status] ? (
              <div className="flex flex-wrap gap-3 mt-4">
                {NEXT_STATUS[b.status].map(s => (
                  <ActionForm key={s.status} action={updateBookingStatus} confirm={s.confirm} className="">
                    <input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value={s.status} />
                    <SubmitButton variant={s.variant}>{s.label}</SubmitButton>
                  </ActionForm>
                ))}
              </div>
            ) : <p className="text-sm text-muted mt-2">This booking is {b.status}. No further status changes are possible.</p>}
            <p className="text-sm text-muted mt-4">Confirm only after you've agreed the vehicle, pickup time and price with the customer.</p>
          </section>

          <section className="card card--pad" aria-labelledby="pay-title">
            <h2 id="pay-title" className="h4">Payment</h2>
            <ActionForm action={updatePayment} className="form-grid form-grid--3 mt-4">
              <input type="hidden" name="id" value={b.id} />
              <div className="field"><label className="label" htmlFor="payment_status">Payment status</label>
                <select className="select" id="payment_status" name="payment_status" defaultValue={b.payment_status}>
                  {Object.entries(paymentStatusLabel).map(([v, [, l]]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field"><label className="label" htmlFor="amount_quoted">Quoted (₹)</label><input className="input" id="amount_quoted" name="amount_quoted" inputMode="decimal" defaultValue={b.amount_quoted ?? ''} /></div>
              <div className="field"><label className="label" htmlFor="amount_paid">Received (₹)</label><input className="input" id="amount_paid" name="amount_paid" inputMode="decimal" defaultValue={b.amount_paid ?? ''} /></div>
              <div className="span-all"><SubmitButton size="sm">Save payment</SubmitButton></div>
            </ActionForm>
          </section>

          <section className="card card--pad" aria-labelledby="notes-title">
            <h2 id="notes-title" className="h4">Internal notes</h2>
            <p className="text-sm text-muted">Only staff can see these. Notes can't be edited or deleted.</p>
            <ActionForm action={addBookingNote} resetOnSuccess className="stack mt-4">
              <input type="hidden" name="id" value={b.id} />
              <label className="visually-hidden" htmlFor="note">New note</label>
              <textarea className="textarea" id="note" name="body" maxLength={2000} placeholder="e.g. Called customer, agreed ₹X,XXX for Innova, pickup 6 AM" required />
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
            <h2 id="cust-title" className="h4">Customer</h2>
            <p className="mt-2"><strong>{b.name}</strong></p>
            <p className="text-sm">{phone}{b.email && <><br />{b.email}</>}</p>
            <p className="text-xs text-muted mt-2">Consent given {formatDateTime(b.consent_at)}</p>
            <div className="stack mt-4">
              <a className="btn btn--whatsapp btn--block" href={`https://wa.me/91${b.phone}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener"><Icon name="whatsapp" />WhatsApp customer</a>
              <a className="btn btn--outline btn--block" href={`tel:${phone}`}><Icon name="phone" />Call {phone}</a>
              {b.email && <a className="btn btn--ghost btn--block" href={`mailto:${b.email}?subject=${encodeURIComponent(`Your booking ${b.reference}`)}`}><Icon name="mail" />Email</a>}
            </div>
          </section>

          <section className="card card--pad" aria-labelledby="assign-title">
            <h2 id="assign-title" className="h4">Handled by</h2>
            <ActionForm action={assignBooking} className="stack mt-4">
              <input type="hidden" name="id" value={b.id} />
              <label className="visually-hidden" htmlFor="assigned_to">Staff member</label>
              <select className="select" id="assigned_to" name="assigned_to" defaultValue={b.assigned_to ?? ''}>
                <option value="">Unassigned</option>
                {(staff.data ?? []).map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}{s.id === user.id ? ' (me)' : ''}</option>)}
              </select>
              <div><SubmitButton size="sm" variant="outline">Save</SubmitButton></div>
            </ActionForm>
          </section>

          {user.role === 'admin' && (
            <section className="card card--pad" aria-labelledby="hist-title">
              <h2 id="hist-title" className="h4">History</h2>
              <ul className="history">
                {(history.data ?? []).map(h => (
                  <li key={h.id}>
                    <strong>{h.action === 'insert' ? 'Request received' : Object.keys((h.details as { changed?: object }).changed ?? {}).join(', ') || h.action}</strong>
                    <span>{h.actor_email ?? 'Website'} · {formatDateTime(h.created_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
