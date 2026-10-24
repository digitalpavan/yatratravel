'use client';

import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { transition } from '@/lib/motion';

/**
 * App-wide Motion setup.
 * - LazyMotion with the domAnimation bundle and `m` components: only the animation features the site uses are
 *   shipped (no drag or layout engine). They're loaded up front so intro content never waits on a second download.
 * - reducedMotion="user" follows the OS setting: movement is switched off and only short opacity fades remain.
 *   Content and booking actions never depend on an animation finishing.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={transition()}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
