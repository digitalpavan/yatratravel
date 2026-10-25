import { after, NextResponse } from 'next/server';
import { bookingSchema, fieldErrors } from '@/lib/validation';
import { checkOffer, createBooking, confirmationPath } from '@/lib/server/bookings';
import { notifyNewBooking } from '@/lib/server/notify';
import { startPayment, type CheckoutOptions } from '@/lib/server/payments';
import { paymentsEnabled } from '@/lib/server/razorpay';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';

export async function POST(request: Request) {
  const limited = rateLimit(`booking:${clientIp(request.headers)}`, 5, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many requests from this connection. Please wait a few minutes or contact us on WhatsApp.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // 1. Every field is validated on the server, whatever the browser checked.
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the highlighted fields.', fields: fieldErrors(parsed.error) }, { status: 422 });
  }
  const input = parsed.data;

  try {
    // 2. The package, vehicle, group size and current price are checked against the live catalogue.
    const offer = await checkOffer(input);
    if (!offer.ok) {
      return NextResponse.json({ error: offer.error, fields: offer.fields, listedPricePaise: offer.listedPricePaise }, { status: offer.status });
    }

    // 3. Stored as "pending"; staff confirm it after checking availability. When the listed price is paid online,
    //    that price is the agreed price; otherwise staff agree it with the customer.
    const payNow = paymentsEnabled() && offer.payOnline && offer.listedPricePaise !== null;
    const { reference, duplicate } = await createBooking(input, offer.packageTitle, payNow ? offer.listedPricePaise : null);
    const url = confirmationPath(reference);
    if (!duplicate) {
      console.info(`[booking] new request ${reference} for ${input.packageSlug}`); // reference only, never personal details
      // 4. Owner and customer are emailed together, after the response, so the customer isn't kept waiting.
      after(() => notifyNewBooking({
        reference, confirmationPath: url, name: input.name, phone: input.phone, email: input.email, packageTitle: offer.packageTitle,
        travelDate: input.travelDate, passengers: input.passengers, vehicle: offer.vehicleName, pickup: input.pickup, requests: input.requests,
        listedPricePaise: offer.listedPricePaise,
      }));
    }
    // 5. Checkout opens straight away. If the order can't be created, the booking still stands and the customer
    //    can pay from their booking page.
    let checkout: CheckoutOptions | undefined;
    if (payNow) {
      try {
        const started = await startPayment(reference);
        if (started.ok) checkout = started.checkout;
      } catch (e) {
        console.error(`[payment] ${reference}: could not open an order`, e);
      }
    }
    return NextResponse.json({ reference, url, checkout }, { status: duplicate ? 200 : 201 });
  } catch (e) {
    console.error('[booking] failed to save', e);
    return NextResponse.json({ error: "We couldn't save your request. Please try again, or send it on WhatsApp." }, { status: 500 });
  }
}
