import { NextResponse } from 'next/server';
import { enquirySchema, fieldErrors } from '@/lib/validation';
import { createEnquiry } from '@/lib/server/bookings';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';

export async function POST(request: Request) {
  const limited = rateLimit(`enquiry:${clientIp(request.headers)}`, 8, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many messages from this connection. Please wait a few minutes or contact us on WhatsApp.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = enquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the highlighted fields.', fields: fieldErrors(parsed.error) }, { status: 422 });
  }

  try {
    const { duplicate } = await createEnquiry(parsed.data);
    if (!duplicate) console.info(`[enquiry] new ${parsed.data.source} enquiry`);
    return NextResponse.json({ ok: true }, { status: duplicate ? 200 : 201 });
  } catch (e) {
    console.error('[enquiry] failed to save', e);
    return NextResponse.json({ error: "We couldn't send your message. Please try again, or contact us on WhatsApp." }, { status: 500 });
  }
}
