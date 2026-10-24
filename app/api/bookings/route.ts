import { NextResponse } from 'next/server';
import { bookingSchema, fieldErrors } from '@/lib/validation';
import { getPackage, getVehicles } from '@/lib/data';
import { createBooking, confirmationPath } from '@/lib/server/bookings';
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

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the highlighted fields.', fields: fieldErrors(parsed.error) }, { status: 422 });
  }
  const input = parsed.data;

  // Checks that need server data: the package and vehicle must exist, and the vehicle must be offered for that package.
  const pkg = await getPackage(input.packageSlug);
  if (!pkg) return NextResponse.json({ error: 'Please check the highlighted fields.', fields: { packageSlug: 'Choose a package from the list' } }, { status: 422 });
  if (input.vehicle !== 'any' && (!(await getVehicles()).some(v => v.slug === input.vehicle) || !pkg.vehicles.some(v => v.slug === input.vehicle))) {
    return NextResponse.json({ error: 'Please check the highlighted fields.', fields: { vehicle: 'This vehicle is not offered for the selected package' } }, { status: 422 });
  }

  try {
    const { reference, duplicate } = await createBooking(input, pkg.title);
    if (!duplicate) {
      // TODO (admin phase): notify staff by email/WhatsApp. Log the reference only, never personal details.
      console.info(`[booking] new request ${reference} for ${pkg.slug}`);
    }
    return NextResponse.json({ reference, url: confirmationPath(reference) }, { status: duplicate ? 200 : 201 });
  } catch (e) {
    console.error('[booking] failed to save', e);
    return NextResponse.json({ error: "We couldn't save your request. Please try again, or send it on WhatsApp." }, { status: 500 });
  }
}
