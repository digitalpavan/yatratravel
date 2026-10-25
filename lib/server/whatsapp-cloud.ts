import 'server-only';
import { createServiceClient } from '@/lib/supabase/clients';

// Automatic WhatsApp messages through Meta's WhatsApp Cloud API. Messages the business starts must use templates
// approved in WhatsApp Manager (see docs/08-booking-workflow.md for the template texts). Without the token and
// phone number id nothing is sent, and click-to-chat links keep working as before.
//
//   WHATSAPP_CLOUD_TOKEN       Permanent access token of a system user with whatsapp_business_messaging permission
//   WHATSAPP_PHONE_NUMBER_ID   Phone number id from WhatsApp Manager → API setup (not the phone number itself)
//   WHATSAPP_ADMIN_NUMBERS     Who gets owner alerts, comma-separated with country code (e.g. 919876543210)
//   WHATSAPP_TEMPLATE_LANG     Template language code, default "en"

const GRAPH = 'https://graph.facebook.com/v21.0';

export const whatsappEnabled = () => !!process.env.WHATSAPP_CLOUD_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;

export const adminWhatsappNumbers = (fallback: string | null): string[] => {
  const configured = (process.env.WHATSAPP_ADMIN_NUMBERS ?? '').split(',').map(s => s.replace(/\D/g, '')).filter(n => /^\d{10,15}$/.test(n));
  return configured.length ? configured : fallback ? [fallback] : [];
};

// Template parameters can't contain new lines, tabs or more than four spaces in a row.
const param = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, 500) || '-';

type Message = { bookingId: string; reference: string; event: string; recipient: 'customer' | 'owner'; to: string; template: string; params: string[] };

/**
 * Sends one template message, at most once per booking, event and number: the log row is claimed before sending,
 * so a retried webhook or a second caller can't send it again. Returns true if WhatsApp accepted it.
 */
export async function sendWhatsappTemplate(m: Message): Promise<boolean> {
  if (!whatsappEnabled()) { console.info(`[whatsapp] ${m.reference}: skipped, WhatsApp Cloud API not configured`); return false; }
  const db = createServiceClient();
  const claim = await db.from('whatsapp_messages')
    .upsert({ booking_id: m.bookingId, event: m.event, recipient: m.recipient, to_number: m.to, template: m.template }, { onConflict: 'booking_id,event,to_number', ignoreDuplicates: true })
    .select('id');
  if (claim.error) { console.error(`[whatsapp] ${m.reference}: could not log message`, claim.error.message); return false; }
  if (!claim.data?.length) return false; // already sent (or being sent) for this event

  const id = claim.data[0].id;
  try {
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: m.to, type: 'template',
        template: {
          name: m.template, language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
          components: [{ type: 'body', parameters: m.params.map(text => ({ type: 'text', text: param(text) })) }],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${res.status} ${data?.error?.message ?? 'request failed'}`);
    await db.from('whatsapp_messages').update({ status: 'sent', provider_message_id: data?.messages?.[0]?.id ?? null }).eq('id', id);
    return true;
  } catch (e) {
    const error = e instanceof Error ? e.message : 'network error';
    console.error(`[whatsapp] ${m.reference}: ${m.recipient} message failed (${error})`);
    await db.from('whatsapp_messages').update({ status: 'failed', error: error.slice(0, 300) }).eq('id', id);
    return false;
  }
}
