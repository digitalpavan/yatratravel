'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { LogoMark } from '@/components/Logo';
import { useDialogBehaviour } from '@/components/useDialogBehaviour';
import { todayInIndia } from '@/lib/format';
import { motionTokens, transition } from '@/lib/motion';
import { waLink } from '@/lib/whatsapp';

// "Book now / Enquire on WhatsApp" popup. It opens from the header's Book Now button and the WhatsApp button, and
// once a day on its own a few seconds into a visit (never on the booking pages). Both actions carry the chosen
// package, date and group size: Book now into the booking form, WhatsApp into a ready-typed message.

type Mode = 'book' | 'whatsapp';
const OPEN_EVENT = 'yatra:open-popup';
const SEEN_KEY = 'yt-popup-seen';
const AUTO_DELAY = 12_000;
const NO_AUTO = ['/book', '/booking-confirmation', '/privacy'];

let listening = false;

/** Opens the popup if it is on this page. Returns false otherwise, so the caller's link works as normal. */
export function openBookingPopup(mode: Mode): boolean {
  if (!listening) return false;
  window.dispatchEvent(new CustomEvent<Mode>(OPEN_EVENT, { detail: mode }));
  return true;
}

const seenToday = () => { try { return localStorage.getItem(SEEN_KEY) === todayInIndia(); } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(SEEN_KEY, todayInIndia()); } catch { /* private mode: it may show again */ } };

export function BookingPopup({ packages, whatsappNumber, brand }: { packages: { slug: string; title: string }[]; whatsappNumber: string; brand: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode | null>(null);
  const [pkg, setPkg] = useState(packages[0]?.slug ?? '');
  const [date, setDate] = useState('');
  const [pax, setPax] = useState('2');
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const close = () => { setMode(null); markSeen(); };
  useDialogBehaviour(mode !== null, panelRef, openerRef, close);

  useEffect(() => {
    listening = true;
    const onOpen = (e: Event) => { openerRef.current = document.activeElement as HTMLElement | null; setMode((e as CustomEvent<Mode>).detail); };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => { listening = false; window.removeEventListener(OPEN_EVENT, onOpen); };
  }, []);

  // Once a day, a few seconds into the visit, unless the visitor is already booking.
  useEffect(() => {
    if (NO_AUTO.some(p => pathname.startsWith(p)) || seenToday()) return;
    const t = setTimeout(() => { if (!seenToday()) { openerRef.current = null; setMode('book'); } }, AUTO_DELAY);
    return () => clearTimeout(t);
  }, [pathname]);
  useEffect(() => { if (NO_AUTO.some(p => pathname.startsWith(p))) setMode(null); }, [pathname]);

  const title = packages.find(p => p.slug === pkg)?.title ?? 'a trip';
  const travellers = Math.min(Math.max(Number(pax) || 1, 1), 50);
  const bookHref = `/book?${new URLSearchParams({ ...(pkg && { package: pkg }), ...(date && { date }), passengers: String(travellers) })}`;
  // Trip basics only: the message travels in a URL (see lib/whatsapp.ts).
  const whatsappHref = waLink(whatsappNumber, `Hello ${brand}, I'd like to enquire about: ${title}\nTravel date: ${date || 'flexible'}\nTravellers: ${travellers}`);

  const book = (e: MouseEvent) => { e.preventDefault(); close(); router.push(bookHref); };

  return (
    <AnimatePresence>
      {mode && (
        <>
          <m.div key="popup-backdrop" className="popup-backdrop" aria-hidden="true" onClick={close}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition(motionTokens.normal)} />
          <m.div key="popup" ref={panelRef} className="popup" role="dialog" aria-modal="true" aria-labelledby="popup-title"
            initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={transition(motionTokens.slow)}>
            <div className="popup__head">
              <LogoMark size={64} />
              <div>
                <h2 id="popup-title">{mode === 'whatsapp' ? 'Enquire on WhatsApp' : 'Plan your Tirupati trip'}</h2>
                <p>{mode === 'whatsapp' ? 'Tell us your trip and we reply within minutes.' : 'Book in two minutes, or ask us anything on WhatsApp.'}</p>
              </div>
              <button type="button" className="popup__close" aria-label="Close" onClick={close}><Icon name="close" size={22} /></button>
            </div>

            <div className="popup__body">
              <div className="field">
                <label className="label" htmlFor="popup-package">Package or service</label>
                <select className="select" id="popup-package" value={pkg} onChange={e => setPkg(e.target.value)}>
                  {packages.map(p => <option key={p.slug} value={p.slug}>{p.title}</option>)}
                </select>
              </div>
              <div className="popup__row">
                <div className="field">
                  <label className="label" htmlFor="popup-date">Travel date</label>
                  <input className="input" id="popup-date" type="date" min={todayInIndia()} value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="popup-pax">Travellers</label>
                  <input className="input" id="popup-pax" type="number" inputMode="numeric" min={1} max={50} value={pax} onChange={e => setPax(e.target.value)} />
                </div>
              </div>

              <div className={`popup__actions${mode === 'whatsapp' ? ' popup__actions--whatsapp' : ''}`}>
                <a className="btn btn--primary btn--lg btn--block" href={bookHref} onClick={book}><Icon name="calendar" />Book now</a>
                <a className="btn btn--whatsapp btn--lg btn--block" href={whatsappHref} target="_blank" rel="noopener" onClick={close}><Icon name="whatsapp" />Enquire on WhatsApp</a>
              </div>
              <ul className="popup__trust">
                <li><Icon name="check-circle" size={16} />Instant booking reference</li>
                <li><Icon name="check-circle" size={16} />AC vehicles, experienced local drivers</li>
                <li><Icon name="check-circle" size={16} />Quick replies on WhatsApp</li>
              </ul>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Header "Book Now": opens the popup; without it (or without JavaScript) it is a normal link to /book. */
export function BookNowButton({ className, children }: { className: string; children: ReactNode }) {
  return <Link className={className} href="/book" onClick={e => { if (openBookingPopup('book')) e.preventDefault(); }}>{children}</Link>;
}

/** Floating WhatsApp button: opens the popup on its WhatsApp side; falls back to a direct chat link. */
export function WhatsAppFab({ href }: { href: string }) {
  return (
    <a className="fab-whatsapp" href={href} target="_blank" rel="noopener" aria-label="Enquire on WhatsApp"
      onClick={e => { if (openBookingPopup('whatsapp')) e.preventDefault(); }}>
      <Icon name="whatsapp" size={28} />
    </a>
  );
}
