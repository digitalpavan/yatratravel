'use client';

import { m, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Children, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { isLowPowerDevice, motionTokens, stagger, transition, variants, type RevealVariant } from '@/lib/motion';

type Tag = 'div' | 'section' | 'article' | 'ul' | 'ol' | 'li' | 'dl' | 'header' | 'figure' | 'aside' | 'span' | 'p' | 'h1' | 'h2';
const VIEWPORT = { once: true, amount: 0.15, margin: '0px 0px -8% 0px' } as const;

type RevealProps = {
  children: ReactNode;
  as?: Tag;
  variant?: RevealVariant;
  /** Extra delay in milliseconds. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

/**
 * Animates once when scrolled into view (fade + small rise by default). Under reduced motion only a short
 * fade remains. data-reveal lets the <noscript> rule in the root layout show content when JavaScript is off.
 */
export function Reveal({ children, as = 'div', variant = 'up', delay = 0, ...rest }: RevealProps) {
  const Comp = m[as] as typeof m.div;
  const v = variants[variant];
  return (
    <Comp
      data-reveal=""
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={delay ? { ...v, visible: { ...v.visible, transition: transition(motionTokens.slow, delay / 1000) } } : v}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** Reveals its children one after another (cards, feature lists). Each child is wrapped in an animated item element. */
export function RevealGroup({ children, as = 'div', itemAs = 'div', itemClassName = 'reveal-item', step = 0.08, className, ...rest }: {
  children: ReactNode; as?: Tag; itemAs?: Tag; itemClassName?: string; step?: number; className?: string; id?: string; 'aria-label'?: string; style?: CSSProperties;
}) {
  const Comp = m[as] as typeof m.div;
  const Item = m[itemAs] as typeof m.div;
  return (
    <Comp data-reveal="" className={className} initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={stagger(step)} {...rest}>
      {Children.toArray(children).map((child, i) => (
        <Item key={i} data-reveal="" className={itemClassName} variants={variants.up}>{child}</Item>
      ))}
    </Comp>
  );
}

/**
 * Hero/page intro: children marked with <IntroItem> enter in sequence on load (eyebrow → headline → text → buttons).
 * Pure CSS (see .intro in styles/site.css), so it starts with the first paint instead of waiting for JavaScript:
 * these are usually the page's largest element, and a script-driven fade-in delayed LCP by 2 seconds on mobile.
 * The order comes from each item's position among the Intro's children.
 */
export function Intro({ children, className = '', delay = 0.1, step = 0.12 }: { children: ReactNode; className?: string; delay?: number; step?: number }) {
  return (
    <div className={`intro ${className}`} style={{ '--intro-delay': `${delay}s`, '--intro-step': `${step}s` } as CSSProperties}>
      {children}
    </div>
  );
}
export function IntroItem({ children, as = 'div', className = '', id }: { children: ReactNode; as?: Tag; className?: string; id?: string }) {
  const Comp = as;
  return <Comp className={`intro-item ${className}`} id={id}>{children}</Comp>;
}

/**
 * Subtle hero background drift (at most ~70px over the first screen). Static on reduced motion and on
 * low-power devices. Only transform is animated.
 */
export function Parallax({ children, className = '', distance = 70 }: { children: ReactNode; className?: string; distance?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(!reduce && !isLowPowerDevice()), [reduce]);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, enabled ? distance : 0]);
  return (
    <m.div ref={ref} className={`parallax ${className}`} style={{ y, scale: enabled ? 1.06 : 1 }}>
      {children}
    </m.div>
  );
}

type Stop = { name: string; note?: string };

/** Itinerary timeline: the line draws as you scroll through it, and stops appear in order. */
export function Timeline({ days, compact = false }: { days: { day: number; title?: string; stops: Stop[] }[]; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] });
  return (
    <div ref={ref} className={`timeline-wrap${compact ? ' timeline-wrap--compact' : ''}`}>
      <m.span className="timeline-progress" style={{ scaleY: scrollYProgress }} aria-hidden="true" />
      {days.map(day => (
        <div className="timeline-day" key={day.day}>
          {days.length > 1 && day.title && <h3>Day {day.day}: {day.title}</h3>}
          <m.ol className="timeline" initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={stagger(0.1)} data-reveal="">
            {day.stops.map((s, i) => (
              <m.li key={s.name + i} variants={variants.up} data-reveal="">
                <span className="timeline__dot">{i + 1}</span>
                <div>{compact ? <h4 style={{ fontSize: 'var(--text-md)' }}>{s.name}</h4> : <h4>{s.name}</h4>}{s.note && <p>{s.note}</p>}</div>
              </m.li>
            ))}
          </m.ol>
        </div>
      ))}
    </div>
  );
}

// The first page load is never faded in (that would delay the hero image and first paint); only in-app navigations are.
let hasNavigated = false;

/** Shared page transition: a brief crossfade with a small upward movement when moving between pages. */
export function PageTransition({ children }: { children: ReactNode }) {
  const [animateIn] = useState(() => hasNavigated);
  useEffect(() => { hasNavigated = true; }, []);
  return (
    <m.div initial={animateIn ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={transition(motionTokens.normal)}>
      {children}
    </m.div>
  );
}

/** For above-the-fold images: always visible (no fade, so first paint isn't delayed), only settling from a slight zoom. */
export function ImageSettle({ children }: { children: ReactNode }) {
  return (
    <m.div className="image-settle" initial={{ scale: 1.05 }} animate={{ scale: 1 }} transition={transition(motionTokens.hero * 2)}>
      {children}
    </m.div>
  );
}
