'use client';

import { m } from 'motion/react';
import { Icon } from '@/components/Icon';
import { motionTokens, transition } from '@/lib/motion';

/** Success state: the badge pops in, then the tick draws. Under reduced motion it simply fades in. */
export function SuccessIcon({ size = 36 }: { size?: number }) {
  return (
    <m.span className="success-reveal__icon" data-reveal="" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ ...transition(motionTokens.slow, 0.1), scale: { type: 'spring', stiffness: 320, damping: 18, delay: 0.1 } }}>
      <Icon name="check" size={size} />
    </m.span>
  );
}
