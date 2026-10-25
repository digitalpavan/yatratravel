import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { getSettings, getVehicles } from '@/lib/data';
import { formatDate, formatPaise } from '@/lib/format';
import { confirmationPath } from '@/lib/server/bookings';
import { invoiceForBooking } from '@/lib/server/invoice';
import type { PaidBooking } from '@/lib/server/payments';
import { adminWhatsappNumbers, sendWhatsappTemplate } from '@/lib/server/whatsapp-cloud';
import { contactLinks, siteUrl } from '@/lib/site';
import { statusUpdateMessage, waLink } from '@/lib/whatsapp';

// Automatic email notifications. They go through Gmail when GMAIL_USER and GMAIL_APP_PASSWORD are set, otherwise
// through Resend (https://resend.com) when RESEND_API_KEY is set; with neither, nothing is sent and the booking flow
// works as before. Logs carry the booking reference only, never personal details.
//
//   GMAIL_USER           The Gmail address emails are sent from (and replies come back to)
//   GMAIL_APP_PASSWORD   A 16-character App Password for that account (Google Account → Security → App passwords;
//                        needs 2-Step Verification). Not the normal Gmail password.
//   RESEND_API_KEY       Alternative to Gmail: API key from Resend
//   NOTIFY_EMAIL_FROM    Resend sender, e.g. "Yatra Travels <bookings@yourdomain.in>" (the domain must be verified in Resend)
//   OWNER_NOTIFY_EMAIL   Where new-booking alerts go (comma-separated for several); falls back to the contact email in
//                        /admin/content, then to GMAIL_USER

type Attachment = { filename: string; content: Uint8Array };
type Email = { to: string[]; subject: string; text: string; html: string; replyTo?: string; idempotencyKey: string; attachments?: Attachment[] };

const gmailConfigured = () => !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
let gmail: Transporter | null = null;

async function sendEmail(email: Email, ref: string): Promise<boolean> {
  if (gmailConfigured()) return sendWithGmail(email, ref);
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.info(`[notify] ${ref}: email skipped, no email service configured (GMAIL_APP_PASSWORD or RESEND_API_KEY)`); return false; }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': email.idempotencyKey },
      body: JSON.stringify({
        from: process.env.NOTIFY_EMAIL_FROM || 'Yatra Travels <onboarding@resend.dev>',
        to: email.to, subject: email.subject, text: email.text, html: email.html,
        ...(email.replyTo && { reply_to: email.replyTo }),
        ...(email.attachments?.length && { attachments: email.attachments.map(a => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64') })) }),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { console.error(`[notify] ${ref}: email failed (${res.status})`); return false; }
    return true;
  } catch {
    console.error(`[notify] ${ref}: email failed (network)`);
    return false;
  }
}

/** Gmail over SMTP with an App Password. Gmail only sends from the signed-in address, shown with the business name. */
async function sendWithGmail(email: Email, ref: string): Promise<boolean> {
  gmail ??= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s/g, '') },
    connectionTimeout: 10_000, socketTimeout: 20_000,
  });
  const { brand } = await getSettings();
  try {
    await gmail.sendMail({
      from: { name: brand.name, address: process.env.GMAIL_USER! },
      to: email.to, replyTo: email.replyTo, subject: email.subject, text: email.text, html: email.html,
      attachments: email.attachments?.map(a => ({ filename: a.filename, content: Buffer.from(a.content), contentType: 'application/pdf' })),
      headers: { 'X-Entity-Ref-ID': email.idempotencyKey },
    });
    return true;
  } catch (e) {
    // EAUTH means the App Password is wrong or was revoked.
    console.error(`[notify] ${ref}: Gmail send failed (${(e as { code?: string }).code ?? 'error'})`);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const day = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function layout(paragraphs: string[], rows: [string, string][], link?: { href: string; label: string }) {
  const text = [...paragraphs, '', ...rows.map(([k, v]) => `${k}: ${v}`), ...(link ? ['', `${link.label}: ${link.href}`] : [])].join('\n');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1a2433;max-width:560px">
${paragraphs.map(p => `<p>${esc(p)}</p>`).join('\n')}
<table style="border-collapse:collapse;margin:16px 0">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#5b6676;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join('')}</table>
${link ? `<p><a href="${esc(link.href)}" style="display:inline-block;background:#1f3a5f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${esc(link.label)}</a></p>` : ''}
</div>`;
  return { text, html };
}

async function ownerAddresses(): Promise<string[]> {
  const configured = (process.env.OWNER_NOTIFY_EMAIL ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (configured.length) return configured;
  const { contact } = await getSettings();
  if (contact.email) return [contact.email];
  return process.env.GMAIL_USER ? [process.env.GMAIL_USER] : [];
}

export type NewBooking = {
  reference: string; confirmationPath: string; name: string; phone: string; email?: string;
  packageTitle: string; travelDate: string; passengers: number; vehicle: string; pickup: string; requests?: string; listedPricePaise: number | null;
};

/** New request: an alert to the owner and an acknowledgement to the customer, sent together. */
export async function notifyNewBooking(b: NewBooking): Promise<void> {
  const { brand, contact } = await getSettings();
  const owners = await ownerAddresses();
  const trip: [string, string][] = [
    ['Reference', b.reference], ['Package', b.packageTitle], ['Travel date', day(b.travelDate)],
    ['Travellers', String(b.passengers)], ['Vehicle', b.vehicle],
  ];

  const owner = owners.length && sendEmail({
    to: owners,
    subject: `New booking request ${b.reference}: ${b.packageTitle}, ${day(b.travelDate)}`,
    replyTo: b.email,
    idempotencyKey: `booking-owner-${b.reference}`,
    ...layout(
      [`New booking request from ${b.name}. It is pending until you confirm it in the dashboard.`],
      [...trip, ['Pickup', b.pickup], ['Customer', b.name], ['Mobile', `+91 ${b.phone}`], ['WhatsApp', waLink(`91${b.phone}`, `Hello, this is ${brand.name} about your booking ${b.reference}.`)],
        ...(b.email ? [['Email', b.email] as [string, string]] : []), ...(b.requests ? [['Requests', b.requests] as [string, string]] : []),
        ['Listed price', b.listedPricePaise === null ? 'On request' : formatPaise(b.listedPricePaise)!]],
      { href: `${siteUrl}/admin/bookings?q=${b.reference}`, label: 'Open in dashboard' },
    ),
  }, b.reference);

  const customer = b.email && sendEmail({
    to: [b.email],
    subject: `We've received your booking request ${b.reference}`,
    replyTo: contact.email ?? undefined,
    idempotencyKey: `booking-customer-${b.reference}`,
    ...layout(
      [`Thank you, ${b.name.split(/\s+/)[0]}. We've received your booking request.`,
        `Your trip is not confirmed yet. We'll check availability and contact you by phone or WhatsApp to confirm the details and price.`],
      trip,
      { href: `${siteUrl}${b.confirmationPath}`, label: 'View your booking' },
    ),
  }, b.reference);

  await Promise.all([owner, customer]);
}

// WhatsApp template names (approved in WhatsApp Manager; texts in docs/08-booking-workflow.md).
const TEMPLATE_CUSTOMER_PAID = process.env.WHATSAPP_TEMPLATE_CUSTOMER_PAID || 'booking_payment_received';
const TEMPLATE_OWNER_PAID = process.env.WHATSAPP_TEMPLATE_OWNER_PAID || 'new_paid_booking';

const METHOD_LABEL: Record<string, string> = { upi: 'UPI', card: 'card', netbanking: 'netbanking', wallet: 'wallet' };

/**
 * Online payment received: WhatsApp and email to the owner and the customer, all at once. Only called by whoever
 * recorded the payment, and each message is also de-duplicated, so retries never send twice.
 */
export async function notifyPaymentReceived(b: PaidBooking): Promise<void> {
  const settings = await getSettings();
  const { brand, contact } = settings;
  const vehicle = (await getVehicles()).find(v => v.slug === b.vehicle)?.name ?? 'To be suggested';
  const amount = formatPaise(b.amountPaise)!;
  const method = METHOD_LABEL[b.method] ?? 'online';
  const link = `${siteUrl}${confirmationPath(b.reference)}`;
  const firstName = b.name.split(/\s+/)[0];
  const trip: [string, string][] = [
    ['Reference', b.reference], ['Package', b.package_title], ['Travel date', day(b.travel_date)],
    ['Travellers', String(b.passengers)], ['Vehicle', vehicle], ['Paid', `${amount} by ${method}`],
  ];

  const whatsappOwners = adminWhatsappNumbers(contactLinks(contact).whatsappNumber);
  const owners = await ownerAddresses();
  await Promise.all([
    sendWhatsappTemplate({
      bookingId: b.id, reference: b.reference, event: 'payment-received', recipient: 'customer', to: `91${b.phone}`, template: TEMPLATE_CUSTOMER_PAID,
      params: [firstName, amount, b.reference, b.package_title, day(b.travel_date), link],
    }),
    ...whatsappOwners.map(to => sendWhatsappTemplate({
      bookingId: b.id, reference: b.reference, event: 'payment-received', recipient: 'owner', to, template: TEMPLATE_OWNER_PAID,
      params: [b.reference, b.package_title, day(b.travel_date), vehicle, String(b.passengers), amount, b.name, `+91 ${b.phone}`, b.pickup],
    })),
    owners.length && sendEmail({
      to: owners,
      subject: `Paid ${amount}: booking ${b.reference}, ${b.package_title}, ${day(b.travel_date)}`,
      replyTo: b.email ?? undefined,
      idempotencyKey: `payment-owner-${b.reference}-${b.amountPaise}`,
      ...layout(
        [`${b.name} has paid ${amount} online for booking ${b.reference}. Assign a vehicle and driver, then confirm the booking in the dashboard.`],
        [...trip, ['Pickup', b.pickup], ['Customer', b.name], ['Mobile', `+91 ${b.phone}`]],
        { href: `${siteUrl}/admin/bookings?q=${b.reference}`, label: 'Open in dashboard' },
      ),
    }, b.reference),
    b.email && sendEmail({
      to: [b.email],
      subject: `Payment received for your booking ${b.reference}`,
      replyTo: contact.email ?? undefined,
      idempotencyKey: `payment-customer-${b.reference}-${b.amountPaise}`,
      ...layout(
        [`Thank you, ${firstName}. We've received your payment of ${amount}.`,
          `We'll send your driver's name, number and vehicle on WhatsApp before your travel date. Questions? Reply to this email or message ${brand.name} on WhatsApp.`],
        trip,
        { href: link, label: 'View your booking' },
      ),
    }, b.reference),
  ]);
}

/**
 * Status change: tells the customer by email when they gave one. Returns true if the email went out.
 * A confirmation carries the invoice PDF; if the invoice can't be made, the email still goes without it.
 */
export async function notifyStatusChange(b: {
  id: string; reference: string; status: string; name: string; email: string | null; package_title: string; travel_date: string; quoted_price_paise: number | null; confirmationPath: string;
}): Promise<boolean> {
  if (!b.email) return false;
  const { brand, contact } = await getSettings();
  const message = statusUpdateMessage(brand.name, b.status, { ...b, quoted_price: b.quoted_price_paise === null ? null : formatPaise(b.quoted_price_paise) });
  const subjects: Record<string, string> = {
    contacted: `Update on your booking request ${b.reference}`,
    confirmed: `Your booking ${b.reference} is confirmed`,
    completed: `Thank you for travelling with us (${b.reference})`,
    cancelled: `Your booking ${b.reference} has been cancelled`,
  };
  const invoice = b.status === 'confirmed' ? await invoiceOrNull(b.id, b.reference) : null;
  return sendEmail({
    to: [b.email],
    subject: subjects[b.status] ?? `Update on your booking ${b.reference}`,
    replyTo: contact.email ?? undefined,
    idempotencyKey: `booking-status-${b.reference}-${b.status}`,
    ...layout([`Dear ${b.name.split(/\s+/)[0]},`, message.replace(/^Hello from [^.]+\. /, ''),
      ...(invoice ? [`Your invoice ${invoice.number} is attached as a PDF.`] : [])],
      [['Reference', b.reference], ['Package', b.package_title], ['Travel date', day(b.travel_date)], ...(invoice ? [['Invoice', invoice.number] as [string, string]] : [])],
      { href: `${siteUrl}${b.confirmationPath}`, label: 'View your booking' }),
    ...(invoice && { attachments: [{ filename: invoice.filename, content: invoice.pdf }] }),
  }, b.reference);
}

async function invoiceOrNull(bookingId: string, reference: string) {
  try {
    return await invoiceForBooking(bookingId);
  } catch (e) {
    console.error(`[notify] ${reference}: invoice could not be made`, e);
    return null;
  }
}

/** Sends the invoice again (from the dashboard), e.g. after a later payment or when the customer asks for it. */
export async function emailInvoice(b: { id: string; reference: string; name: string; email: string | null; package_title: string; travel_date: string }): Promise<'sent' | 'no-email' | 'no-invoice' | 'failed'> {
  if (!b.email) return 'no-email';
  const invoice = await invoiceOrNull(b.id, b.reference);
  if (!invoice) return 'no-invoice';
  const { contact } = await getSettings();
  const sent = await sendEmail({
    to: [b.email],
    subject: `Invoice ${invoice.number} for your booking ${b.reference}`,
    replyTo: contact.email ?? undefined,
    idempotencyKey: `invoice-${b.reference}-${Date.now()}`,
    ...layout([`Dear ${b.name.split(/\s+/)[0]},`, `Please find your invoice ${invoice.number} attached as a PDF. It shows the payments we've received so far.`],
      [['Reference', b.reference], ['Package', b.package_title], ['Travel date', day(b.travel_date)], ['Invoice', invoice.number]],
      { href: `${siteUrl}${confirmationPath(b.reference)}`, label: 'View your booking' }),
    attachments: [{ filename: invoice.filename, content: invoice.pdf }],
  }, b.reference);
  return sent ? 'sent' : 'failed';
}
