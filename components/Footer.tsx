import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Icon } from '@/components/Icon';
import type { Settings } from '@/lib/data';
import { photoCredits } from '@/lib/images';
import { landingPages } from '@/lib/landing-pages';
import type { ContactLinks } from '@/lib/site';

export function Footer({ settings, links }: { settings: Settings; links: ContactLinks }) {
  const { brand, contact } = settings;
  const credits = photoCredits();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Logo />
            <p>Pilgrimage tours, temple visits and cab services from Tirupati, with clear prices agreed before you travel.</p>
          </div>
          <div>
            <h2 className="footer-title">Services</h2>
            <ul>
              {landingPages.map(p => <li key={p.slug}><Link href={`/${p.slug}`}>{p.title}</Link></li>)}
              <li><Link href="/packages">All packages</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="footer-title">Plan your trip</h2>
            <ul>
              <li><Link href="/tirupati-darshan">Tirupati darshan travel</Link></li>
              <li><Link href="/vehicles">Our vehicles</Link></li>
              <li><Link href="/blog">Travel guides</Link></li>
              <li><Link href="/about">About us</Link></li>
              <li><Link href="/privacy">Privacy policy</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="footer-title">Contact</h2>
            <ul>
              <li><a href={links.phoneHref}><Icon name="phone" size={16} /> {links.phoneLabel}</a></li>
              <li><a href={links.whatsappHref()} target="_blank" rel="noopener"><Icon name="whatsapp" size={16} /> WhatsApp</a></li>
              {contact.email && <li><a href={`mailto:${contact.email}`}><Icon name="mail" size={16} /> {contact.email}</a></li>}
              {contact.address && <li>{contact.address}</li>}
              <li><Link href="/contact">Contact page</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {brand.name}. All rights reserved.</span>
          <span>An independent travel operator, not affiliated with TTD. Darshan tickets are booked separately through TTD.</span>
        </div>
        {credits.length > 0 && (
          <p className="footer-credits">
            Vehicle photos are representative. Photo credits: {credits.map((c, i) => <span key={c.id}>{i > 0 && ' · '}<a href={c.url} target="_blank" rel="noopener">{c.text}</a></span>)}
          </p>
        )}
      </div>
    </footer>
  );
}

export function WhatsAppFab({ href }: { href: string }) {
  return (
    <a className="fab-whatsapp" href={href} target="_blank" rel="noopener" aria-label="Enquire on WhatsApp">
      <Icon name="whatsapp" size={28} />
    </a>
  );
}

/** Shown until the owner marks the business details verified in /admin/content. */
export function PreviewBanner() {
  return (
    <div className="preview-banner" role="note">
      Preview: phone numbers, prices, photos and some details are placeholders awaiting confirmation.
    </div>
  );
}
