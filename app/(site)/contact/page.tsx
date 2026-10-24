import type { Metadata } from 'next';
import { EnquiryForm } from '@/components/EnquiryForm';
import { Icon } from '@/components/Icon';
import { Reveal } from '@/components/motion';
import { PageHero, Pending } from '@/components/ui';
import { getSettings } from '@/lib/data';
import { contactLinks } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact Yatra Travels, Tirupati',
  description: 'Call, WhatsApp or email Yatra Travels in Tirupati about temple tours, Tirumala transport, cabs and pilgrimage packages, or send an enquiry online.',
  alternates: { canonical: '/contact' },
};

export default async function ContactPage() {
  const { brand, contact } = await getSettings();
  const links = contactLinks(contact);
  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Home' }, { label: 'Contact' }]} title="Contact us"
        lead="WhatsApp is usually the quickest way to reach us. You can also call, email or send the form below." />

      <section className="section" style={{ paddingTop: 'var(--space-7)' }}>
        <div className="container two-col">
          <div className="stack">
            <Reveal>
              <ul className="contact-list">
                <li><span className="feature__icon"><Icon name="whatsapp" /></span><div><strong>WhatsApp</strong><a href={links.whatsappHref()} target="_blank" rel="noopener">Chat with us on WhatsApp</a></div></li>
                <li><span className="feature__icon"><Icon name="phone" /></span><div><strong>Phone</strong><a href={links.phoneHref}>{links.phoneLabel}</a></div></li>
                <li><span className="feature__icon"><Icon name="mail" /></span><div><strong>Email</strong>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : <Pending>Email to be confirmed</Pending>}</div></li>
                <li><span className="feature__icon"><Icon name="pin" /></span><div><strong>Office</strong>{contact.address ?? <Pending>Tirupati office address to be confirmed</Pending>}</div></li>
                <li><span className="feature__icon"><Icon name="clock" /></span><div><strong>Office hours</strong>{contact.hours ?? <Pending>Hours to be confirmed</Pending>}</div></li>
              </ul>
            </Reveal>
            <Reveal>
              {contact.mapsEmbedUrl ? (
                <iframe className="map-frame" src={contact.mapsEmbedUrl} title="Map showing the Yatra Travels office in Tirupati" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              ) : (
                <div className="map-placeholder">
                  <Icon name="pin" size={32} />
                  <p>The map will appear here once the office address is confirmed.</p>
                  {contact.mapsUrl && <a className="btn btn--outline btn--sm" href={contact.mapsUrl} target="_blank" rel="noopener">Open in Google Maps</a>}
                </div>
              )}
            </Reveal>
          </div>
          <Reveal>
            <EnquiryForm source="contact" whatsappNumber={links.whatsappNumber} title="Send us a message" />
          </Reveal>
        </div>
      </section>
    </>
  );
}
