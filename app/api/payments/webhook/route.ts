import { after, NextResponse } from 'next/server';
import { notifyPaymentReceived } from '@/lib/server/notify';
import { markAttemptFailed, recordGatewayPayment } from '@/lib/server/payments';
import { verifyWebhookSignature } from '@/lib/server/razorpay';
import { createServiceClient } from '@/lib/supabase/clients';

// Razorpay webhook (Razorpay dashboard → Webhooks): the source of truth for payments, including ones where the
// customer closed the browser before returning. Subscribe to payment.captured and payment.failed.
// The signature is checked on the raw body before anything is read. Any non-2xx response makes Razorpay retry,
// and every step is idempotent, so a retry never records or notifies twice.

type PaymentEntity = { id: string; order_id: string | null; error_description?: string | null };

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get('x-razorpay-signature'))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }
  let event: { event: string; payload?: { payment?: { entity?: PaymentEntity } } };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }); }

  const db = createServiceClient();
  const eventId = request.headers.get('x-razorpay-event-id')?.slice(0, 64);
  if (eventId) {
    const { data: seen } = await db.from('gateway_events').select('id').eq('id', eventId).maybeSingle();
    if (seen) return NextResponse.json({ ok: true, duplicate: true });
  }

  const payment = event.payload?.payment?.entity;
  try {
    if (payment?.order_id && (event.event === 'payment.captured' || event.event === 'order.paid')) {
      const result = await recordGatewayPayment(payment.order_id, payment.id);
      // An order this site didn't create (e.g. a payment link made in the Razorpay dashboard) is acknowledged and ignored.
      if (result.ok && result.recorded) {
        console.info(`[payment] ${result.recorded.reference}: payment recorded (webhook)`);
        const recorded = result.recorded;
        after(() => notifyPaymentReceived(recorded));
      }
    } else if (payment?.order_id && event.event === 'payment.failed') {
      await markAttemptFailed(payment.order_id, payment.error_description || 'Payment failed');
    }
  } catch (e) {
    console.error(`[payment] webhook ${event.event} failed`, e);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 }); // Razorpay retries later
  }

  // Remembered only once handled, so a failed attempt is retried.
  if (eventId) await db.from('gateway_events').upsert({ id: eventId, event: event.event }, { onConflict: 'id', ignoreDuplicates: true });
  return NextResponse.json({ ok: true });
}
