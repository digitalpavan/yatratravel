import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRole } from '@/lib/auth';
import { invoiceForBooking } from '@/lib/server/invoice';

// Staff download of a booking's invoice PDF (issued on first download if the confirmation email didn't issue it).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkRole('staff');
  if ('status' in auth) return new NextResponse('Sign in required', { status: auth.status });
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new NextResponse('Not found', { status: 404 });
  const invoice = await invoiceForBooking(id.data);
  if (!invoice) return new NextResponse('Invoices are made for confirmed bookings with an agreed price.', { status: 404 });
  return new NextResponse(Buffer.from(invoice.pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${invoice.filename}"`, 'Cache-Control': 'private, no-store' },
  });
}
