'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { PaymentMethods, payWithRazorpay } from '@/components/Razorpay';
import { formatPaise } from '@/lib/format';

/** "Pay now" on the customer's booking page, for a booking with an agreed price that isn't fully paid. */
export function PayButton({ reference, token, duePaise }: { reference: string; token: string; duePaise: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pay = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/payments/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference, token }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.checkout) { setError(data.error || 'We could not start the payment. Please try again.'); return; }
      const result = await payWithRazorpay(data.checkout, { reference, token });
      if (result.status === 'paid') router.refresh();
      if (result.status === 'error') setError(result.error);
    } catch {
      setError("We couldn't reach our server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      {error && <div className="alert alert--error" role="alert"><Icon name="alert" /><div>{error}</div></div>}
      <button type="button" className={`btn btn--primary btn--lg btn--block${busy ? ' is-loading' : ''}`} onClick={pay} disabled={busy} aria-busy={busy}>
        {busy ? 'Opening payment…' : `Pay ${formatPaise(duePaise)} now`}
      </button>
      <PaymentMethods />
    </div>
  );
}
