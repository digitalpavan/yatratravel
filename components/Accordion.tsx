'use client';

import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useId, useState } from 'react';
import { motionTokens, transition } from '@/lib/motion';

export function Accordion({ items, defaultOpen = -1 }: { items: { q: string; a: string }[]; defaultOpen?: number }) {
  const [open, setOpen] = useState<number>(defaultOpen);
  const base = useId();
  const reduce = useReducedMotion();
  return (
    <div className="accordion">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div className={`accordion__item${isOpen ? ' is-open' : ''}`} key={item.q}>
            <h3 className="accordion__heading">
              <button type="button" id={`${base}-b${i}`} aria-expanded={isOpen} aria-controls={`${base}-p${i}`} onClick={() => setOpen(isOpen ? -1 : i)}>
                {item.q}
                <span className="accordion__icon" aria-hidden="true" />
              </button>
            </h3>
            {/* Answers are removed from the page while closed, so they're also out of the tab order. */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <m.div className="accordion__panel" id={`${base}-p${i}`} role="region" aria-labelledby={`${base}-b${i}`} key="panel"
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={reduce ? { duration: 0 } : transition(motionTokens.normal)} style={{ overflow: 'hidden' }}>
                  <p>{item.a}</p>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
