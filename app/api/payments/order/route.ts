import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/server/bookings';
import { startPayment } from '@/lib/server/payments';
import { clientIp, rateLimit } from '@/lib/server/rate-limit';

// Opens checkout from the customer's booking page ("Pay now"). Only the holder of the private booking link can start it.
const body = z.object({ reference: z.string().max(20), token: z.string().max(100) });

export async function POST(request: Request) {
  if (!rateLimit(`pay-order:${clientIp(request.headers)}`, 10, 10 * 60_000).ok) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !verifyAccessToken(parsed.data.reference, parsed.data.token)) {
    return NextResponse.json({ error: 'This payment link is not valid.' }, { status: 403 });
  }
  try {
    const started = await startPayment(parsed.data.reference);
    return started.ok ? NextResponse.json({ checkout: started.checkout }) : NextResponse.json({ error: started.error }, { status: 409 });
  } catch (e) {
    console.error(`[payment] ${parsed.data.reference}: could not open an order`, e);
    return NextResponse.json({ error: "We couldn't start the payment. Please try again in a moment." }, { status: 502 });
  }
}
