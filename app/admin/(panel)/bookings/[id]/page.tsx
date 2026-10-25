import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Badge, bookingStatusLabel, formatDateTime, PageTitle, paymentStatusLabel } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/data';
import { formatDate, formatPaise, todayInIndia, toRupees } from '@/lib/format';
import { createUserClient } from '@/lib/supabase/clients';
import { statusUpdateMessage, waLink } from '@/lib/whatsapp';
import { addBookingNote, assignBooking, markCustomerNotified, recordPayment, updateBookingStatus, updatePayment } from '../actions';

export const metadata: Metadata = { title: 'Booking' };
type Props = { params: Promise<{ id: string }> };

const PAYMENT_METHODS: Record<string, string> = { upi: 'UPI', cash: 'Cash', card: 'Card', netbanking: 'Netbanking', wallet: 'Wallet', bank_transfer: 'Bank transfer', other: 'Other' };

const CONFIRM = { status: 'confirmed', label: 'Confirm booking', variant: 'primary', confirm: 'Confirm this booking? Make sure the vehicle is available and you have agreed the price with the customer.' };
const NEXT_STATUS: Record<string, { status: string; label: string; variant: string; confirm?: string }[]> = {
  pending: [
    { status: 'contacted', label: 'Mark contacted', variant: 'secondary' },
    CONFIRM,
    { status: 'cancelled', label: 'Cancel request', variant: 'outline', confirm: 'Cancel this booking request? This cannot be undone.' },
  ],
  contacted: [
    CONFIRM,
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

  const [{ data: b }, items, payments, notes, staff, history, settings] = await Promise.all([
    db.from('bookings').select('*').eq('id', id).maybeSingle(),
    db.from('booking_items').select('id, kind, description, quantity, unit_price_paise, amount_paise').eq('booking_id', id).order('created_at'),
    db.from('payments').select('id, kind, amount_paise, method, transaction_ref, received_on, profiles(full_name, email)').eq('booking_id', id).order('received_on', { ascending: false }),
    db.from('booking_notes').select('id, body, created_at, profiles(full_name, email)').eq('booking_id', id).order('created_at', { ascending: false }),
    db.from('profiles').select('id, full_name, email').eq('active', true).order('full_name'),
    // RLS returns history to admins only.
    db.from('audit_log').select('id, action, actor_email, details, created_at').eq('entity', 'bookings').eq('entity_id', id).order('created_at', { ascending: false }).limit(20),
    getSettings(),
  ]);
  if (!b) notFound();

  // Availability on the travel date, per vehicle category: fleet − blocked units − other confirmed bookings.
  const [fleet, blocks, booked] = await Promise.all([
    db.from('vehicles').select('slug, name, passengers, vehicle_internal(fleet_count)').eq('active', true).order('sort'),
    db.from('vehicle_blocks').select('units, vehicles(slug)').lte('start_date', b.travel_date).gte('end_date', b.travel_date),
    db.from('bookings').select('vehicle').eq('status', 'confirmed').eq('travel_date', b.travel_date).neq('id', b.id),
  ]);
  const availability = (fleet.data ?? []).map(v => {
    const total = (v.vehicle_internal as unknown as { fleet_count: number } | null)?.fleet_count ?? 0;
    const blocked = (blocks.data ?? []).filter(x => (x.vehicles as unknown as { slug: string } | null)?.slug === v.slug).reduce((n, x) => n + x.units, 0);
    const taken = (booked.data ?? []).filter(x => x.vehicle === v.slug).length;
    return { ...v, total, blocked, taken, free: total - blocked - taken };
  });

  const phone = `+91${b.phone}`;
  // Greeting without the customer's name: the message travels in a URL.
  const waText = `Hello, this is ${settings.brand.name} about your booking ${b.reference}.`;
  const updateText = statusUpdateMessage(settings.brand.name, b.status, { ...b, quoted_price: b.quoted_price_paise === null ? null : formatPaise(b.quoted_price_paise) });
  const customerBehind = b.customer_notified_status !== b.status;

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
            {!!items.data?.length && (
              <ul className="list mt-4" aria-label="Requested items">
                {items.data.map(it => (
                  <li key={it.id}>
                    <div><strong>{it.description}</strong><span>{it.quantity > 1 ? `${it.quantity} × ` : ''}{it.kind === 'package' ? 'Listed price when requested' : it.kind}</span></div>
                    <span>{it.amount_paise === null ? <span className="text-muted">On request</span> : `${it.kind === 'discount' ? '−' : ''}${formatPaise(it.amount_paise)}`}</span>
                  </li>
                ))}
              </ul>
            )}
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
            <p className="text-sm text-muted mt-4">
              {b.status === 'confirmed'
                ? 'Mark the trip completed after the service, on or after the travel date.'
                : <>Confirm only after checking availability below and agreeing the price with the customer.{b.quoted_price_paise === null && <> <strong>Add the agreed price under Payment first.</strong></>}</>}
            </p>

            <div className={`alert ${customerBehind ? 'alert--info' : 'alert--success'} mt-4`} role="status">
              <Icon name={customerBehind ? 'alert' : 'check-circle'} />
              <div className="stack">
                {customerBehind ? <>
                  <strong>Tell the customer: this booking is now {bookingStatusLabel[b.status]?.[1].toLowerCase()}.</strong>
                  <p className="text-sm pre">{updateText}</p>
                  <div className="flex flex-wrap gap-2">
                    <a className="btn btn--whatsapp btn--sm" href={waLink(`91${b.phone}`, updateText)} target="_blank" rel="noopener"><Icon name="whatsapp" />Open in WhatsApp</a>
                    {b.email && <a className="btn btn--ghost btn--sm" href={`mailto:${b.email}?subject=${encodeURIComponent(`Your booking ${b.reference}`)}&body=${encodeURIComponent(updateText)}`}><Icon name="mail" />Email instead</a>}
                    <ActionForm action={markCustomerNotified} className="">
                      <input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value={b.status} />
                      <SubmitButton size="sm" variant="outline">I've sent it</SubmitButton>
                    </ActionForm>
                  </div>
                  <p className="text-xs text-muted">WhatsApp opens with the message ready; it isn't sent until you tap send. Their private booking page already shows the new status.</p>
                </> : <span className="text-sm">Customer told about "{bookingStatusLabel[b.status]?.[1]}"{b.customer_notified_at && <> on {formatDateTime(b.customer_notified_at)}</>}.</span>}
              </div>
            </div>
          </section>

          {(b.status === 'pending' || b.status === 'contacted') && (
            <section className="card" aria-labelledby="avail-title">
              <div className="card__head"><h2 id="avail-title">Availability on {formatDate(b.travel_date, { weekday: 'short', day: 'numeric', month: 'short' })}</h2></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th scope="col">Vehicle</th><th scope="col" className="num">Fleet</th><th scope="col" className="num">Blocked</th><th scope="col" className="num">Confirmed</th><th scope="col" className="num">Free</th></tr></thead>
                  <tbody>
                    {availability.map(v => (
                      <tr key={v.slug}>
                        <td><strong>{v.name}</strong>{v.slug === b.vehicle && <> <span className="badge badge--info">Requested</span></>}{v.passengers < b.passengers && <> <span className="text-muted text-sm">· seats {v.passengers}</span></>}</td>
                        <td className="num">{v.total || <span className="text-accent">Not recorded</span>}</td>
                        <td className="num">{v.blocked}</td>
                        <td className="num">{v.taken}</td>
                        <td className="num"><strong className={v.free > 0 ? undefined : 'text-accent'}>{Math.max(v.free, 0)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted card--pad">Based on fleet counts and blocked dates under Vehicles. Check with drivers before confirming.</p>
            </section>
          )}

          <section className="card card--pad" aria-labelledby="pay-title">
            <h2 id="pay-title" className="h4">Payment</h2>
            <ActionForm action={updatePayment} className="form-grid form-grid--3 mt-4">
              <input type="hidden" name="id" value={b.id} />
              <div className="field"><label className="label" htmlFor="payment_status">Payment status</label>
                <select className="select" id="payment_status" name="payment_status" defaultValue={b.payment_status}>
                  {Object.entries(paymentStatusLabel).map(([v, [, l]]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field"><label className="label" htmlFor="quoted">Agreed price (₹)</label><input className="input" id="quoted" name="quoted" inputMode="decimal" defaultValue={toRupees(b.quoted_price_paise) ?? ''} /></div>
              <div className="field"><span className="label">Received</span><p className="mt-2"><strong>{formatPaise(b.amount_paid_paise)}</strong>
                {b.quoted_price_paise !== null && Number(b.amount_paid_paise) < Number(b.quoted_price_paise) && <span className="text-muted"> · {formatPaise(Number(b.quoted_price_paise) - Number(b.amount_paid_paise))} due</span>}</p></div>
              <div className="span-all"><SubmitButton size="sm">Save</SubmitButton></div>
            </ActionForm>

            <h3 className="label mt-6">Record a payment</h3>
            <ActionForm action={recordPayment} resetOnSuccess className="form-grid form-grid--3 mt-2">
              <input type="hidden" name="booking_id" value={b.id} />
              <div className="field"><label className="label" htmlFor="pay-amount">Amount (₹)</label><input className="input" id="pay-amount" name="amount_paise" inputMode="decimal" required /></div>
              <div className="field"><label className="label" htmlFor="pay-method">Method</label>
                <select className="select" id="pay-method" name="method" defaultValue="upi">
                  {Object.entries(PAYMENT_METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field"><label className="label" htmlFor="pay-date">Date</label><input className="input" id="pay-date" name="received_on" type="date" max={todayInIndia()} defaultValue={todayInIndia()} required /></div>
              <div className="field"><label className="label" htmlFor="pay-kind">Type</label>
                <select className="select" id="pay-kind" name="kind" defaultValue="payment"><option value="payment">Payment received</option><option value="refund">Refund given</option></select>
              </div>
              <div className="field span-2"><label className="label" htmlFor="pay-ref">UPI / transaction reference<span className="opt"> (optional)</span></label><input className="input" id="pay-ref" name="transaction_ref" maxLength={100} /></div>
              <div className="span-all"><SubmitButton size="sm" variant="outline">Record</SubmitButton></div>
            </ActionForm>
            {!!payments.data?.length && (
              <ul className="list mt-4" aria-label="Payments">
                {payments.data.map(p => {
                  const by = p.profiles as unknown as { full_name: string; email: string } | null;
                  return (
                    <li key={p.id}>
                      <div><strong>{p.kind === 'refund' ? 'Refund' : 'Payment'} · {PAYMENT_METHODS[p.method]}</strong><span>{formatDate(p.received_on, { day: 'numeric', month: 'short', year: 'numeric' })}{p.transaction_ref && ` · ${p.transaction_ref}`}{by && ` · ${by.full_name || by.email}`}</span></div>
                      <span>{p.kind === 'refund' ? '−' : ''}{formatPaise(p.amount_paise)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-sm text-muted mt-4">Payments can't be edited. To correct a mistake, record a refund, or ask an administrator.</p>
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
