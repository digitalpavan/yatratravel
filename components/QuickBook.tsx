'use client';

import { useRouter } from 'next/navigation';
import { useLayoutEffect, useRef, useState, type SubmitEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Icon, type IconName } from '@/components/Icon';
import { motionTokens, transition } from '@/lib/motion';

type Option = { slug: string; title: string };
type Tab = { id: string; label: string; icon: IconName; options: Option[] };

/** Homepage booking panel. Tabs filter the service list; submitting hands off to /book with the choices prefilled. */
export function QuickBook({ tabs }: { tabs: Tab[] }) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  // Sliding underline follows the active tab.
  useLayoutEffect(() => {
    const el = tabRefs.current[active];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active]);

  const onKeyDown = (e: KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    const next = (active + dir + tabs.length) % tabs.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const key of ['package', 'date', 'passengers', 'pickup']) {
      const v = String(data.get(key) ?? '').trim();
      if (v) params.set(key, v);
    }
    router.push(`/book?${params}`);
  };

  const tab = tabs[active];
  return (
    <form className="quick-book" onSubmit={submit} aria-label="Quick booking">
      <div className="quick-book__tabs" role="tablist" aria-label="Trip type" onKeyDown={onKeyDown}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={el => { tabRefs.current[i] = el; }}
            type="button"
            role="tab"
            id={`qb-tab-${t.id}`}
            aria-selected={i === active}
            aria-controls="qb-panel"
            tabIndex={i === active ? 0 : -1}
            className="quick-book__tab"
            onClick={() => setActive(i)}
          >
            <Icon name={t.icon} size={18} />{t.label}
          </button>
        ))}
        <m.span className="quick-book__indicator" initial={false} animate={{ x: indicator.left, width: indicator.width }} transition={transition(motionTokens.normal)} aria-hidden="true" />
      </div>

      <AnimatePresence mode="wait" initial={false}>
      <m.div className="quick-book__fields" id="qb-panel" role="tabpanel" aria-labelledby={`qb-tab-${tab.id}`} key={tab.id}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={transition(motionTokens.fast)}>
        <div className="field">
          <label className="label" htmlFor="qb-package">{tab.id === 'cabs' ? 'Service' : 'Package'}</label>
          <select className="select" id="qb-package" name="package">
            {tab.options.map(o => <option key={o.slug} value={o.slug}>{o.title}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="qb-pickup">Pickup point</label>
          <input className="input" id="qb-pickup" name="pickup" placeholder="e.g. Tirupati Railway Station" autoComplete="off" />
        </div>
        <div className="field">
          <label className="label" htmlFor="qb-date">Travel date</label>
          <input className="input" id="qb-date" name="date" type="date" />
        </div>
        <div className="field">
          <label className="label" htmlFor="qb-pax">Travellers</label>
          <input className="input" id="qb-pax" name="passengers" type="number" inputMode="numeric" min={1} max={50} defaultValue={2} />
        </div>
        <button className="btn btn--secondary btn--lg" type="submit">Continue booking</button>
      </m.div>
      </AnimatePresence>
    </form>
  );
}
