'use client';

import { useEffect, useState } from 'react';
import { isLowPowerDevice } from '@/lib/motion';

type Source = { src: string; media?: string; type: string };

/**
 * Optional looping hero video. It loads only on desktop, never with reduced motion, Data Saver or on low-power devices,
 * and the hero photo underneath is always the fallback.
 */
export function HeroVideo({ poster, sources }: { poster: string; sources: Source[] }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const ok = window.matchMedia('(min-width: 1024px)').matches
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      && !isLowPowerDevice();
    setEnabled(ok);
  }, []);
  if (!enabled || !sources.length) return null;
  return (
    <video className="hero__video" autoPlay muted loop playsInline poster={poster} aria-hidden="true" tabIndex={-1}>
      {sources.map(s => <source key={s.src} src={s.src} media={s.media} type={s.type} />)}
    </video>
  );
}
