import type { Transition, Variants } from 'motion/react';

/** Global motion tokens (seconds). Everything animates opacity and transform only. */
export const motionTokens = {
  fast: 0.18,
  normal: 0.3,
  slow: 0.55,
  hero: 0.75,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

// Only set `delay` when asked: an explicit delay (even 0) on a child would override the stagger delay from its parent.
export const transition = (duration: number = motionTokens.normal, delay?: number): Transition =>
  delay ? { duration, delay, ease: motionTokens.ease } : { duration, ease: motionTokens.ease };

/** Distance for "fade and move up" entrances. Kept small so nothing feels like it's sliding across the page. */
const RISE = 24;

export const variants = {
  up: { hidden: { opacity: 0, y: RISE }, visible: { opacity: 1, y: 0, transition: transition(motionTokens.slow) } },
  fade: { hidden: { opacity: 0 }, visible: { opacity: 1, transition: transition(motionTokens.slow) } },
  zoom: { hidden: { opacity: 0, scale: 0.97 }, visible: { opacity: 1, scale: 1, transition: transition(motionTokens.slow) } },
  /** Image reveal: a gentle settle from slightly enlarged. */
  image: { hidden: { opacity: 0, scale: 1.04 }, visible: { opacity: 1, scale: 1, transition: transition(motionTokens.hero) } },
} satisfies Record<string, Variants>;

export type RevealVariant = keyof typeof variants;

/** Parent for staggered children. */
export const stagger = (each = 0.08, delayChildren = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: each, delayChildren } },
});

/**
 * Low-power hint: Data Saver, few CPU cores or little memory. Used to keep the hero static
 * (no parallax, no video) on devices where continuous effects would cost battery or smoothness.
 */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
  return Boolean(
    nav.connection?.saveData ||
    ['slow-2g', '2g'].includes(nav.connection?.effectiveType ?? '') ||
    (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) ||
    (nav.deviceMemory && nav.deviceMemory <= 4),
  );
}
