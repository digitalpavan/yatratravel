import 'server-only';
import { getSettings } from '@/lib/data';
import { todayInIndia } from '@/lib/format';
import { capturePayment, createOrder, fetchPayment, ledgerMethod, paymentsEnabled, razorpayKeyId, type RazorpayPayment } from '@/lib/server/razorpay';
import { createServiceClient } from '@/lib/supabase/clients';

// Online payment for a booking. The amount always comes from the database (agreed price minus what's been paid),
// never from the browser, and a payment is recorded only after Razorpay itself reports it captured.

export type CheckoutOptions = {
  key: string; orderId: string; amount: number; currency: 'INR'; name: string; description: string;
  prefill: { name: string; contact: string; email?: string };
};

export type PaidBooking = {
  id: string; reference: string; name: string; phone: string; email: string | null; package_title: string; travel_date: string;
  passengers: number; vehicle: string; pickup: string; amountPaise: number; method: string;
};

const BOOKING_COLUMNS = 'id, reference, status, name, phone, email, package_title, travel_date, passengers, vehicle, pickup, quoted_price_paise, amount_paid_paise';
type BookingRow = Omit<PaidBooking, 'amountPaise' | 'method'> & { status: string; quoted_price_paise: number | null; amount_paid_paise: number };

/** Opens (or reuses) a Razorpay order for what's still due on the booking. */
export async function startPayment(reference: string): Promise<{ ok: true; checkout: CheckoutOptions } | { ok: false; error: string }> {
  if (!paymentsEnabled()) return { ok: false, error: 'Online payment is not available right now. Please contact us to pay.' };
  const db = createServiceClient();
  const { data, error } = await db.from('bookings').select(BOOKING_COLUMNS).eq('reference', reference).maybeSingle();
  if (error) throw new Error(error.message);
  const b = data as BookingRow | null;
  if (!b) return { ok: false, error: 'We could not find this booking.' };
  if (b.status === 'cancelled' || b.status === 'completed') return { ok: false, error: 'This booking can no longer be paid online.' };
  if (b.quoted_price_paise === null) return { ok: false, error: 'We confirm the price for this booking with you first.' };
  const due = Number(b.quoted_price_paise) - Number(b.amount_paid_paise);
  if (due <= 0) return { ok: false, error: 'This booking is already paid.' };

  // Reuse a recent unpaid order for the same amount, so reopening checkout doesn't pile up orders.
  const since = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data: open } = await db.from('payment_attempts').select('gateway_order_id')
    .eq('booking_id', b.id).eq('status', 'created').eq('amount_paise', due).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  let orderId = open?.gateway_order_id as string | undefined;
  if (!orderId) {
    const order = await createOrder(due, b.reference, { reference: b.reference });
    const saved = await db.from('payment_attempts').insert({ booking_id: b.id, gateway_order_id: order.id, amount_paise: due });
    if (saved.error) throw new Error(saved.error.message);
    orderId = order.id;
  }

  const { brand } = await getSettings();
  return {
    ok: true,
    checkout: {
      key: razorpayKeyId(), orderId, amount: due, currency: 'INR', name: brand.name, description: `${b.package_title} · ${b.reference}`,
      prefill: { name: b.name, contact: `+91${b.phone}`, ...(b.email && { email: b.email }) },
    },
  };
}

/** The order id belongs to this booking (stops a signed payment for one booking being replayed against another). */
export async function orderBelongsTo(orderId: string, reference: string): Promise<boolean> {
  const { data } = await createServiceClient().from('payment_attempts').select('bookings!inner(reference)').eq('gateway_order_id', orderId).maybeSingle();
  return (data?.bookings as unknown as { reference: string } | undefined)?.reference === reference;
}

/**
 * Records a captured payment in the ledger, once. Called from the checkout callback and from the webhook; whichever
 * comes second finds the payment already recorded. Returns the booking only to the caller that recorded it, so
 * notifications go out exactly once.
 */
export async function recordGatewayPayment(orderId: string, paymentId: string): Promise<{ ok: true; recorded: PaidBooking | null } | { ok: false; error: string }> {
  const db = createServiceClient();
  const { data: attempt } = await db.from('payment_attempts').select('id, booking_id').eq('gateway_order_id', orderId).maybeSingle();
  if (!attempt) return { ok: false, error: 'Unknown order.' };

  let payment: RazorpayPayment = await fetchPayment(paymentId);
  if (payment.order_id !== orderId || payment.currency !== 'INR') return { ok: false, error: 'Payment does not match the order.' };
  if (payment.status === 'authorized') {
    try { payment = await capturePayment(payment.id, payment.amount); } catch { payment = await fetchPayment(paymentId); } // auto-capture may have won
  }
  if (payment.status !== 'captured' && payment.status !== 'refunded') return { ok: false, error: `Payment is ${payment.status}.` };

  const { data: inserted, error } = await db.from('payments').upsert({
    booking_id: attempt.booking_id, kind: 'payment', amount_paise: payment.amount, method: ledgerMethod(payment.method),
    transaction_ref: payment.id, gateway_payment_id: payment.id, received_on: todayInIndia(), notes: `Paid online (Razorpay, ${payment.method})`,
  }, { onConflict: 'gateway_payment_id', ignoreDuplicates: true }).select('id');
  if (error) throw new Error(error.message);
  await db.from('payment_attempts').update({ status: 'paid', gateway_payment_id: payment.id, error: '' }).eq('id', attempt.id);
  if (!inserted?.length) return { ok: true, recorded: null };

  const { data: b } = await db.from('bookings').select(BOOKING_COLUMNS).eq('id', attempt.booking_id).single();
  return { ok: true, recorded: { ...(b as BookingRow), amountPaise: payment.amount, method: payment.method } };
}

/** A failed attempt marks the booking's payment as failed until money actually arrives. */
export async function markAttemptFailed(orderId: string, reason: string): Promise<void> {
  const db = createServiceClient();
  const { data: attempt } = await db.from('payment_attempts').update({ status: 'failed', error: reason.slice(0, 300) })
    .eq('gateway_order_id', orderId).eq('status', 'created').select('booking_id').maybeSingle();
  if (attempt) await db.from('bookings').update({ payment_status: 'failed' }).eq('id', attempt.booking_id).eq('amount_paid_paise', 0);
}
