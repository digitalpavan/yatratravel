import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/server/bookings';
import { notifyPaymentReceived } from '@/lib/server/notify';
import { orderBelongsTo, recordGatewayPayment } from '@/lib/server/payments';
import { paymentsEnabled, verifyCheckoutSignature } from '@/lib/server/razorpay';

// Checkout's success callback. The signature proves Razorpay issued this payment for this order; the payment itself
// is then fetched from Razorpay before anything is recorded. The webhook records the same payment if this call never arrives.
const body = z.object({
  reference: z.string().max(20),
  token: z.string().max(100),
  razorpay_order_id: z.string().regex(/^order_\w{1,40}$/),
  razorpay_payment_id: z.string().regex(/^pay_\w{1,40}$/),
  razorpay_signature: z.string().regex(/^[0-9a-f]{64}$/i),
});

export async function POST(request: Request) {
  if (!paymentsEnabled()) return NextResponse.json({ error: 'Online payment is not available.' }, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payment details.' }, { status: 400 });
  const { reference, token, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;

  if (!verifyAccessToken(reference, token) || !verifyCheckoutSignature(orderId, paymentId, signature) || !(await orderBelongsTo(orderId, reference))) {
    console.warn(`[payment] ${reference}: rejected checkout callback`);
    return NextResponse.json({ error: 'We could not verify this payment.' }, { status: 400 });
  }
  try {
    const result = await recordGatewayPayment(orderId, paymentId);
    if (!result.ok) return NextResponse.json({ error: `We could not confirm this payment yet (${result.error}). If money left your account, it will be matched automatically.` }, { status: 409 });
    if (result.recorded) {
      console.info(`[payment] ${reference}: payment recorded (checkout)`);
      const recorded = result.recorded;
      after(() => notifyPaymentReceived(recorded));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[payment] ${reference}: verify failed`, e);
    return NextResponse.json({ error: 'We could not confirm the payment just now. If money left your account, it will be matched automatically.' }, { status: 502 });
  }
}
