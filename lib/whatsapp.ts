import { formatDate } from '@/lib/format';

// WhatsApp click-to-chat: https://wa.me/<international number, digits only>?text=<encoded message>.
// It opens a chat with the message typed in; nothing is sent until the person taps send.
// The text travels in a URL, so messages carry only what the chat needs: the reference and trip basics,
// never names, phone numbers, pickup addresses or private booking links.

export function waLink(number: string, text: string): string {
  return `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

/** The business's WhatsApp number: WHATSAPP_BUSINESS_NUMBER (e.g. 919876543210) overrides the number saved in /admin/content. */
export function businessWhatsappNumber(fromSettings: string | null): string | null {
  const env = process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, '');
  if (env && /^[1-9]\d{9,14}$/.test(env)) return env;
  return fromSettings;
}

type TripBasics = { reference: string; package_title: string; travel_date: string };

/** Customer → business, from the confirmation page. */
export const customerAboutBookingMessage = (b: TripBasics) =>
  `Hello, I'm writing about my booking ${b.reference} (${b.package_title}, ${formatDate(b.travel_date, { day: 'numeric', month: 'short', year: 'numeric' })}).`;

/** Business → customer, sent by staff after a status change. */
export function statusUpdateMessage(brand: string, status: string, b: TripBasics & { quoted_price?: string | null }): string {
  const trip = `${b.package_title} on ${formatDate(b.travel_date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`;
  const lines: Record<string, string> = {
    pending: `We've received your booking request ${b.reference} for ${trip}. We'll check availability and get back to you shortly.`,
    contacted: `About your booking request ${b.reference} for ${trip}: we're checking vehicle availability and will confirm the price with you here.`,
    confirmed: `Your booking ${b.reference} for ${trip} is confirmed${b.quoted_price ? ` at ${b.quoted_price}` : ''}. We'll send the driver's name, number and vehicle before your trip.`,
    completed: `Thank you for travelling with us. Your trip ${b.reference} is complete. We'd be grateful for a short review.`,
    cancelled: `Your booking ${b.reference} for ${trip} has been cancelled. Reply here if you have any questions or would like to rebook.`,
  };
  return `Hello from ${brand}. ${lines[status] ?? `Update on your booking ${b.reference}.`}`;
}
