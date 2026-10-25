import { NextResponse, type NextRequest } from 'next/server';
import { REFERENCE_PATTERN, verifyAccessToken } from '@/lib/server/bookings';
import { invoiceForBooking } from '@/lib/server/invoice';
import { createServiceClient } from '@/lib/supabase/clients';

// The customer's invoice, from their private booking link (same signed token as the booking page).
export async function GET(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  if (!REFERENCE_PATTERN.test(reference) || !verifyAccessToken(reference, request.nextUrl.searchParams.get('t') ?? undefined)) {
    return new NextResponse('This link is not valid.', { status: 404 });
  }
  const { data: b } = await createServiceClient().from('bookings').select('id').eq('reference', reference).maybeSingle();
  const invoice = b ? await invoiceForBooking(b.id) : null;
  if (!invoice) return new NextResponse('Your invoice will be available once your booking is confirmed.', { status: 404 });
  return new NextResponse(Buffer.from(invoice.pdf), {
    headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${invoice.filename}"`,
      'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
