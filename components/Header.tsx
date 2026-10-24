'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/Logo';
import { Icon } from '@/components/Icon';
import { useDialogBehaviour } from '@/components/useDialogBehaviour';
import { motionTokens, stagger, transition } from '@/lib/motion';

type NavItem = { href: string; label: string };

const panel = {
  hidden: { x: '100%' },
  // Links start entering while the panel is still sliding, so the menu feels quick.
  visible: { x: 0, transition: { ...transition(motionTokens.slow), delayChildren: 0.12, staggerChildren: 0.05 } },
  exit: { x: '100%', transition: transition(motionTokens.normal) },
};
const item = { hidden: { opacity: 0, x: 24 }, visible: { opacity: 1, x: 0, transition: transition(motionTokens.normal) } };

export function Header({ nav, phoneHref, phoneLabel, whatsappHref }: { nav: readonly NavItem[]; phoneHref: string; phoneLabel: string; whatsappHref: string }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  // Pages with a full-bleed hero start with a transparent header over the image.
  const overlay = pathname === '/' || pathname === '/tirupati-darshan';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useDialogBehaviour(open, drawerRef, toggleRef, () => setOpen(false));

  const isCurrent = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      <header className={`site-header${overlay ? ' site-header--overlay' : ''}${scrolled ? ' is-scrolled' : ''}`}>
        <div className="container site-header__inner">
          <Logo />
          <nav className="nav" aria-label="Main">
            <ul className="nav__list">
              {nav.map(i => (
                <li key={i.href}><Link className="nav__link" href={i.href} aria-current={isCurrent(i.href) ? 'page' : undefined}>{i.label}</Link></li>
              ))}
            </ul>
          </nav>
          <div className="header-actions">
            <a className="btn btn--ghost btn--sm header-phone" href={phoneHref}><Icon name="phone" />{phoneLabel}</a>
            <Link className="btn btn--primary btn--sm" href="/book">Book Now</Link>
            <button ref={toggleRef} className="icon-btn nav-toggle" type="button" aria-controls="drawer" aria-expanded={open} aria-label="Open menu" onClick={() => setOpen(true)}>
              <Icon name="menu" size={24} />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <>
            <m.div key="backdrop" className="drawer-backdrop is-open" aria-hidden="true" onClick={() => setOpen(false)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <m.div key="drawer" ref={drawerRef} className="drawer is-open" id="drawer" role="dialog" aria-modal="true" aria-label="Menu"
              variants={panel} initial="hidden" animate="visible" exit="exit">
              <div className="drawer__head">
                <Logo onClick={() => setOpen(false)} />
                <button className="icon-btn" type="button" aria-label="Close menu" onClick={() => setOpen(false)}><Icon name="close" size={24} /></button>
              </div>
              <nav className="drawer__nav" aria-label="Mobile">
                <m.ul variants={stagger(0.05)}>
                  {nav.map(i => (
                    <m.li key={i.href} variants={item}>
                      <Link className="drawer__link" href={i.href} aria-current={isCurrent(i.href) ? 'page' : undefined}>{i.label}<Icon name="chevron-right" size={18} /></Link>
                    </m.li>
                  ))}
                </m.ul>
              </nav>
              <m.div className="drawer__foot" variants={item}>
                <Link className="btn btn--primary btn--block" href="/book">Request a Booking</Link>
                <a className="btn btn--whatsapp btn--block" href={whatsappHref} target="_blank" rel="noopener"><Icon name="whatsapp" />Enquire on WhatsApp</a>
                <a className="btn btn--outline-inverse btn--block" href={phoneHref}><Icon name="phone" />Call {phoneLabel}</a>
              </m.div>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
