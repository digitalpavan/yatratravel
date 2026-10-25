'use client';

import type { CheckoutOptions } from '@/lib/server/payments';

// Razorpay Standard Checkout: a secure popup offering UPI (apps on phones, a QR code to scan on computers), debit and
// credit cards, netbanking and wallets, as enabled on the Razorpay account. Card and bank details never touch this site.

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void };
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance } }

let script: Promise<void> | null = null;
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  script ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => { script = null; reject(new Error('load')); };
    document.head.appendChild(s);
  });
  return script;
}

export type PayResult = { status: 'paid' } | { status: 'dismissed' } | { status: 'error'; error: string };

/** Opens checkout and, once Razorpay reports success, has the server verify and record the payment. */
export async function payWithRazorpay(checkout: CheckoutOptions, booking: { reference: string; token: string }): Promise<PayResult> {
  try { await loadCheckout(); } catch { return { status: 'error', error: "The payment window couldn't load. Check your connection and try again." }; }

  const response = await new Promise<RazorpayResponse | null>(resolve => {
    new window.Razorpay!({
      key: checkout.key, order_id: checkout.orderId, amount: checkout.amount, currency: checkout.currency,
      name: checkout.name, description: checkout.description, prefill: checkout.prefill,
      theme: { color: '#101C2C' },
      handler: (r: RazorpayResponse) => resolve(r),
      // Failed attempts stay inside checkout so the customer can try another method; closing it ends here.
      modal: { ondismiss: () => resolve(null), confirm_close: true },
    }).open();
  });
  if (!response) return { status: 'dismissed' };

  try {
    const res = await fetch('/api/payments/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...booking, ...response }),
    });
    if (res.ok) return { status: 'paid' };
    const data = await res.json().catch(() => ({}));
    return { status: 'error', error: data.error || 'We could not confirm the payment. If money left your account, it will be matched automatically.' };
  } catch {
    return { status: 'error', error: 'We could not confirm the payment. If money left your account, it will be matched automatically.' };
  }
}

/** Accepted methods, shown next to the pay button. */
export function PaymentMethods() {
  return (
    <p className="pay-methods text-sm text-muted">
      <span>UPI</span><span>Scan QR</span><span>Debit / credit card</span><span>Netbanking</span>
      <span className="pay-methods__secure">Secured by Razorpay</span>
    </p>
  );
}
