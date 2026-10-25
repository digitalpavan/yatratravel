import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { getSettings, getVehicles } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { siteUrl } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/clients';

// Invoice PDF for a confirmed booking. The invoice number and total are fixed when it is issued (issue_invoice in
// the database); payments come from the ledger each time the PDF is built, so a later copy shows later payments.
//
//   INVOICE_GSTIN   Optional. Printed on the invoice when the business is GST-registered.

export type InvoiceData = {
  number: string;
  issuedAt: string;
  business: { name: string; address: string | null; phone: string | null; email: string | null; website: string; gstin: string | null };
  customer: { name: string; phone: string; email: string | null };
  trip: { reference: string; packageTitle: string; travelDate: string; passengers: number; vehicle: string; pickup: string };
  totalPaise: number;
  payments: { date: string; kind: 'payment' | 'refund'; method: string; reference: string; amountPaise: number }[];
};

const METHOD: Record<string, string> = { upi: 'UPI', card: 'Card', netbanking: 'Netbanking', wallet: 'Wallet', cash: 'Cash', bank_transfer: 'Bank transfer', other: 'Other' };

/** Issues the booking's invoice if it has none yet (confirmed or completed bookings only) and builds the PDF. */
export async function invoiceForBooking(bookingId: string): Promise<{ number: string; filename: string; pdf: Uint8Array } | null> {
  const db = createServiceClient();
  const { data: b } = await db.from('bookings')
    .select('id, status, reference, name, phone, email, package_title, travel_date, passengers, vehicle, pickup, quoted_price_paise')
    .eq('id', bookingId).maybeSingle();
  if (!b || !['confirmed', 'completed'].includes(b.status) || b.quoted_price_paise === null) return null;

  const issued = await db.rpc('issue_invoice', { p_booking: bookingId });
  if (issued.error) throw new Error(issued.error.message);
  const invoice = issued.data as { number: string; total_paise: number; issued_at: string };

  const [{ data: payments }, { brand, contact }, vehicles] = await Promise.all([
    db.from('payments').select('kind, amount_paise, method, transaction_ref, received_on').eq('booking_id', bookingId).order('received_on').order('created_at'),
    getSettings(),
    getVehicles(),
  ]);
  const pdf = await renderInvoicePdf({
    number: invoice.number,
    issuedAt: invoice.issued_at,
    business: { name: brand.name, address: contact.address, phone: contact.phoneDisplay, email: contact.email, website: siteUrl.replace(/^https?:\/\//, ''), gstin: process.env.INVOICE_GSTIN?.trim() || null },
    customer: { name: b.name, phone: `+91 ${b.phone}`, email: b.email },
    trip: {
      reference: b.reference, packageTitle: b.package_title, travelDate: b.travel_date, passengers: b.passengers, pickup: b.pickup,
      vehicle: vehicles.find(v => v.slug === b.vehicle)?.name ?? 'As arranged',
    },
    totalPaise: Number(invoice.total_paise),
    payments: (payments ?? []).map(p => ({
      date: p.received_on, kind: p.kind, method: METHOD[p.method] ?? p.method, reference: p.transaction_ref, amountPaise: Number(p.amount_paise),
    })),
  });
  return { number: invoice.number, filename: `Invoice-${invoice.number.replace(/\//g, '-')}.pdf`, pdf };
}

// ---------------------------------------------------------------- PDF layout (A4, standard fonts)

const NAVY = rgb(0.063, 0.11, 0.173);
const GOLD = rgb(0.788, 0.643, 0.361);
const INK = rgb(0.1, 0.14, 0.2);
const MUTED = rgb(0.36, 0.4, 0.46);
const RULE = rgb(0.86, 0.87, 0.89);
const TINT = rgb(0.97, 0.96, 0.94);

// The built-in PDF fonts cover Latin-1 only: common typographic characters are mapped and anything else (e.g. Telugu
// script) is left out, so an unusual character in a name or address can never stop the invoice being made.
const MAP: Record<string, string> = { '\u20B9': 'Rs.', '\u2013': '-', '\u2014': '-', '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"', '\u2026': '...', '\u2022': '\u00B7' };
const clean = (s: string) => s.replace(/[\u20B9\u2013\u2014\u2018\u2019\u201C\u201D\u2026\u2022]/g, c => MAP[c]).replace(/[^\x20-\x7E\xA0-\xFF\s]/g, '').replace(/\s+/g, ' ').trim();
const rs = (paise: number) => `Rs. ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paise / 100)}`;
const day = (iso: string) => formatDate(iso.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' });
const issuedDay = (ts: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(ts));

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of clean(text).split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderInvoicePdf(d: InvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${d.number}`);
  doc.setAuthor(clean(d.business.name));
  doc.setCreator(clean(d.business.name));
  const page: PDFPage = doc.addPage([595.28, 841.89]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width: PW, height: PH } = page.getSize();
  const M = 48;
  const R = PW - M;

  const put = (s: string, x: number, y: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean } = {}) => {
    const size = o.size ?? 10, font = o.font ?? regular, t = clean(s);
    page.drawText(t, { x: o.right ? x - font.widthOfTextAtSize(t, size) : x, y, size, font, color: o.color ?? INK });
  };
  const rule = (y: number, color = RULE, thickness = 0.8) => page.drawLine({ start: { x: M, y }, end: { x: R, y }, thickness, color });

  // Header band
  page.drawRectangle({ x: 0, y: PH - 96, width: PW, height: 96, color: NAVY });
  put(d.business.name, M, PH - 52, { size: 22, font: bold, color: rgb(1, 1, 1) });
  put(d.business.website, M, PH - 72, { size: 10, color: GOLD });
  put('INVOICE', R, PH - 52, { size: 22, font: bold, color: GOLD, right: true });
  put(d.number, R, PH - 72, { size: 10, color: rgb(1, 1, 1), right: true });

  // From / invoice details
  let y = PH - 130;
  put('FROM', M, y, { size: 8, font: bold, color: MUTED });
  put('INVOICE DETAILS', R - 200, y, { size: 8, font: bold, color: MUTED });
  y -= 16;
  const from = [d.business.name, ...(d.business.address ? wrap(d.business.address, regular, 10, 240) : []),
    ...(d.business.phone ? [`Phone: ${d.business.phone}`] : []), ...(d.business.email ? [`Email: ${d.business.email}`] : []),
    ...(d.business.gstin ? [`GSTIN: ${d.business.gstin}`] : [])];
  const paid = d.payments.reduce((sum, p) => sum + (p.kind === 'refund' ? -p.amountPaise : p.amountPaise), 0);
  const due = d.totalPaise - paid;
  const details: [string, string][] = [
    ['Invoice no.', d.number], ['Invoice date', issuedDay(d.issuedAt)], ['Booking ref.', d.trip.reference],
    ['Status', due <= 0 ? 'Paid in full' : paid > 0 ? 'Part paid' : 'Payment due'],
  ];
  from.forEach((line, i) => put(line, M, y - i * 14, { font: i === 0 ? bold : regular }));
  details.forEach(([k, v], i) => { put(k, R - 200, y - i * 14, { color: MUTED }); put(v, R, y - i * 14, { font: bold, right: true }); });
  y -= Math.max(from.length, details.length) * 14 + 14;

  // Bill to
  rule(y + 6);
  y -= 14;
  put('BILL TO', M, y, { size: 8, font: bold, color: MUTED });
  y -= 16;
  [clean(d.customer.name) || 'Customer', d.customer.phone, ...(d.customer.email ? [d.customer.email] : [])]
    .forEach((line, i) => put(line, M, y - i * 14, { font: i === 0 ? bold : regular }));
  y -= (d.customer.email ? 3 : 2) * 14 + 14;

  // Trip
  const pickup = wrap(d.trip.pickup, regular, 10, R - M - 132);
  const trip: [string, string[]][] = [
    ['Package', [d.trip.packageTitle]], ['Travel date', [day(d.trip.travelDate)]], ['Travellers', [String(d.trip.passengers)]],
    ['Vehicle', [d.trip.vehicle]], ['Pickup', pickup],
  ];
  const tripHeight = trip.reduce((h, [, v]) => h + v.length * 14, 0) + 20;
  page.drawRectangle({ x: M, y: y - tripHeight + 10, width: R - M, height: tripHeight, color: TINT });
  y -= 6;
  for (const [k, lines] of trip) {
    put(k, M + 12, y, { color: MUTED });
    lines.forEach((l, i) => put(l, M + 120, y - i * 14, { font: k === 'Package' ? bold : regular }));
    y -= lines.length * 14;
  }
  y -= 28;

  // Charges
  page.drawRectangle({ x: M, y: y - 6, width: R - M, height: 22, color: NAVY });
  put('DESCRIPTION', M + 12, y, { size: 8, font: bold, color: rgb(1, 1, 1) });
  put('AMOUNT', R - 12, y, { size: 8, font: bold, color: rgb(1, 1, 1), right: true });
  y -= 26;
  wrap(`${d.trip.packageTitle} · ${d.trip.vehicle}`, bold, 10, R - M - 160).forEach((l, i) => put(l, M + 12, y - i * 14, { font: bold }));
  put(rs(d.totalPaise), R - 12, y, { right: true });
  y -= 14;
  put(`${day(d.trip.travelDate)} · ${d.trip.passengers} traveller${d.trip.passengers === 1 ? '' : 's'} · Booking ${d.trip.reference}`, M + 12, y, { size: 9, color: MUTED });
  y -= 14;
  rule(y);
  y -= 18;
  put('Total', R - 160, y, { font: bold });
  put(rs(d.totalPaise), R - 12, y, { font: bold, size: 12, right: true });
  y -= 34;

  // Payments
  put('PAYMENTS RECEIVED', M, y, { size: 8, font: bold, color: MUTED });
  y -= 8;
  rule(y);
  y -= 16;
  if (!d.payments.length) { put('No payments recorded yet.', M, y, { color: MUTED }); y -= 16; }
  for (const p of d.payments.slice(0, 12)) {
    put(day(p.date), M, y);
    put(p.kind === 'refund' ? `Refund (${p.method})` : p.method, M + 110, y);
    put(p.reference.slice(0, 32), M + 220, y, { color: MUTED, size: 9 });
    put(`${p.kind === 'refund' ? '- ' : ''}${rs(p.amountPaise)}`, R - 12, y, { right: true });
    y -= 16;
  }
  rule(y + 6);
  y -= 12;
  put('Total paid', R - 160, y);
  put(rs(paid), R - 12, y, { right: true });
  y -= 20;
  page.drawRectangle({ x: R - 172, y: y - 8, width: 172, height: 26, color: due > 0 ? TINT : NAVY });
  put('Balance due', R - 160, y, { font: bold, color: due > 0 ? INK : rgb(1, 1, 1) });
  put(rs(Math.max(due, 0)), R - 12, y, { font: bold, right: true, color: due > 0 ? INK : GOLD });

  // Footer
  rule(92);
  put(`Thank you for travelling with ${d.business.name}.`, M, 74, { font: bold });
  put('Please quote your booking reference when you contact us. This is a computer-generated invoice and does not need a signature.', M, 58, { size: 8, color: MUTED });
  put([d.business.phone, d.business.email, d.business.website].filter(Boolean).join('  ·  '), M, 44, { size: 8, color: MUTED });

  return doc.save();
}
