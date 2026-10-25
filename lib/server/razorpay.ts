import 'server-only';
import crypto from 'node:crypto';
import { DEMO } from '@/lib/demo-data';

// Razorpay (https://razorpay.com) over its REST API. Without the keys, online payment is switched off and bookings
// go through as requests, as before.
//
//   RAZORPAY_KEY_ID           Key id (rzp_test_… or rzp_live_…); sent to the browser to open checkout
//   RAZORPAY_KEY_SECRET       Key secret: server only, used for the API and to verify checkout signatures
//   RAZORPAY_WEBHOOK_SECRET   Secret set on the webhook in the Razorpay dashboard, used to verify webhook calls

const API = 'https://api.razorpay.com/v1';

export const paymentsEnabled = () => !DEMO && !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
export const razorpayKeyId = () => process.env.RAZORPAY_KEY_ID!;

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay ${path.split('/')[1]} ${res.status}: ${data?.error?.description ?? 'request failed'}`);
  return data as T;
}

export type RazorpayOrder = { id: string; amount: number; currency: string; status: string };
export type RazorpayPayment = {
  id: string; order_id: string; amount: number; currency: string; method: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'; error_description?: string | null;
};

export const createOrder = (amountPaise: number, receipt: string, notes: Record<string, string>) =>
  api<RazorpayOrder>('/orders', { method: 'POST', body: { amount: amountPaise, currency: 'INR', receipt, notes } });

export const fetchPayment = (id: string) => api<RazorpayPayment>(`/payments/${encodeURIComponent(id)}`);

/** Accounts normally capture automatically; this covers one set to manual capture, or a payment caught before auto-capture. */
export const capturePayment = (id: string, amountPaise: number) =>
  api<RazorpayPayment>(`/payments/${encodeURIComponent(id)}/capture`, { method: 'POST', body: { amount: amountPaise, currency: 'INR' } });

function safeEqualHex(expected: string, given: string): boolean {
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(given, 'hex');
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Checkout success: HMAC-SHA256 of "order_id|payment_id" with the key secret. A browser "success" alone is never proof. */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!).update(`${orderId}|${paymentId}`).digest('hex');
  return /^[0-9a-f]+$/i.test(signature) && safeEqualHex(expected, signature);
}

/** Webhook: HMAC-SHA256 of the raw request body with the webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !/^[0-9a-f]+$/i.test(signature)) return false;
  return safeEqualHex(crypto.createHmac('sha256', secret).update(rawBody).digest('hex'), signature);
}

/** Razorpay's method names → the ledger's payment methods. */
export function ledgerMethod(method: string): 'upi' | 'card' | 'netbanking' | 'wallet' | 'other' {
  return method === 'upi' || method === 'card' || method === 'netbanking' || method === 'wallet' ? method : 'other';
}
