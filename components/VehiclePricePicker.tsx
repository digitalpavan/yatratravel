'use client';

import { useState } from 'react';
import { formatPrice } from '@/lib/format';

/** Package page: choosing a vehicle shows its price straight away; the choice is carried into the booking form. */
export function VehiclePricePicker({ options, unit }: { options: { slug: string; name: string; passengers: number; price: number | null }[]; unit: string }) {
  const [slug, setSlug] = useState('');
  const chosen = options.find(o => o.slug === slug);
  return (
    <div className="stack">
      <div className="field">
        <label className="label" htmlFor="pkg-vehicle">Vehicle</label>
        <select className="select" id="pkg-vehicle" name="vehicle" value={slug} onChange={e => setSlug(e.target.value)}>
          <option value="">Suggest for me</option>
          {options.map(o => <option key={o.slug} value={o.slug}>{o.name} (up to {o.passengers}){o.price !== null ? ` · ${formatPrice(o.price)}` : ''}</option>)}
        </select>
      </div>
      {chosen && (
        <div className="price-total" aria-live="polite">
          {chosen.price !== null
            ? <><span className="price-total__label">Price</span><strong className="price-total__amount">{formatPrice(chosen.price)}</strong><span className="price-total__meta">{chosen.name}{unit && ` · ${unit}`}</span></>
            : <span className="price-total__meta">{chosen.name}: price on request</span>}
        </div>
      )}
    </div>
  );
}
