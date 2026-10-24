import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon';
import { Reveal, RevealGroup } from '@/components/motion';
import { Photo } from '@/components/Photo';
import { PageHero, Pending, SectionHead } from '@/components/ui';
import { getPackages, getSettings, getVehicles } from '@/lib/data';
import { contactLinks } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About Yatra Travels',
  description: 'Yatra Travels arranges temple tours, Tirumala transport, pilgrimage packages and cabs from Tirupati. Learn how we work and where we travel.',
  alternates: { canonical: '/about' },
};

const principles: { icon: IconName; title: string; text: string }[] = [
  { icon: 'temple', title: 'Respect for the pilgrimage', text: 'A darshan trip matters to the people taking it. We plan around temple timings, rest and elderly travellers, not the fastest route.' },
  { icon: 'rupee', title: 'Honest, upfront prices', text: 'The fare, what is included and what is extra are agreed before you travel. No surprises at drop-off.' },
  { icon: 'shield', title: 'Safety first on the ghat roads', text: 'Well-maintained vehicles and careful drivers who know the Tirumala ghat road and the Alipiri checks.' },
  { icon: 'whatsapp', title: 'Easy to reach', text: 'One booking reference, one WhatsApp chat, and real people answering it.' },
];

export default async function AboutPage() {
  const { brand, contact } = await getSettings();
  const links = contactLinks(contact);
  const [vehicles, services] = await Promise.all([getVehicles(), getPackages()]);
  const fleetVerified = vehicles.every(v => v.verified);

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Home' }, { label: 'About' }]} eyebrow="About us" title="Travel arranged with care, from Tirupati"
        lead="Yatra Travels arranges temple tours, Tirumala transport, pilgrimage packages and cabs for families and groups visiting Tirupati and South India." />

      <section className="section" aria-labelledby="story-title">
        <div className="container two-col two-col--wide-left">
          <Reveal className="prose">
            <span className="eyebrow">Our story</span>
            <h2 id="story-title" style={{ marginTop: 'var(--space-3)' }}>Who we are</h2>
            {brand.story
              ? brand.story.split('\n\n').map(p => <p key={p.slice(0, 24)}>{p}</p>)
              : (
                <>
                  <p>We help pilgrims and travellers get around Tirupati comfortably: from the station to their hotel, up the ghat road to Tirumala, and on to the temples around the region.</p>
                  <p><Pending>The company story, founding year and team will be added here once confirmed by the owner.</Pending></p>
                </>
              )}
          </Reveal>
          <Reveal variant="image" className="article-cover"><Photo id="tirupati-temple" sizes="(min-width: 1024px) 40vw, 100vw" /></Reveal>
        </div>
      </section>

      <section className="section section--inverse" aria-labelledby="philosophy-title">
        <div className="container">
          <Reveal><SectionHead eyebrow="Travel philosophy" title="How we travel with you" id="philosophy-title" /></Reveal>
          <RevealGroup className="grid grid--4">
            {principles.map((p, i) => (
              <div className="feature" key={p.title}>
                <span className="feature__icon"><Icon name={p.icon} size={26} /></span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="section" aria-labelledby="coverage-title">
        <div className="container two-col">
          <Reveal className="stack">
            <span className="eyebrow">Service coverage</span>
            <h2 id="coverage-title">Where we travel</h2>
            <div className="stop-chips">{brand.serviceArea.map(a => <span className="badge" key={a}><Icon name="pin" size={14} />{a}</span>)}</div>
          </Reveal>
          <Reveal className="stack">
            <span className="eyebrow">Services</span>
            <h2>What we arrange</h2>
            <ul className="check-list check-list--yes">
              {services.map(s => <li key={s.slug}><Icon name="check-circle" /><Link href={`/packages/${s.slug}`}>{s.title}</Link></li>)}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="section section--surface" aria-labelledby="fleet-title">
        <div className="container">
          <Reveal>
            <SectionHead eyebrow="Our fleet" title="Vehicles and service" id="fleet-title"
              lead={fleetVerified ? 'Photos of our own vehicles.' : 'Representative photos for now. Photos of our own fleet will replace them.'}
              action={<Link className="btn btn--outline" href="/vehicles">See all vehicles</Link>} />
          </Reveal>
          <RevealGroup className="grid grid--4">
            {vehicles.map((v, i) => (
              <figure key={v.slug} className="card">
                <Photo id={v.image} entry={v.imageEntry} sizes="(min-width: 1024px) 25vw, 50vw" />
                <figcaption className="text-sm" style={{ padding: 'var(--space-3) var(--space-4)' }}><strong>{v.name}</strong> · up to {v.passengers} passengers</figcaption>
              </figure>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="section" aria-labelledby="office-title">
        <div className="container two-col">
          <Reveal className="stack">
            <span className="eyebrow">Office</span>
            <h2 id="office-title">Visit or call us</h2>
            <ul className="contact-list">
              <li><span className="feature__icon"><Icon name="pin" /></span><div><strong>Address</strong>{contact.address ?? <Pending>Office address to be confirmed</Pending>}</div></li>
              <li><span className="feature__icon"><Icon name="clock" /></span><div><strong>Hours</strong>{contact.hours ?? <Pending>Office hours to be confirmed</Pending>}</div></li>
              <li><span className="feature__icon"><Icon name="phone" /></span><div><strong>Phone</strong><a href={links.phoneHref}>{links.phoneLabel}</a></div></li>
            </ul>
          </Reveal>
          <Reveal className="cta-band">
            <div>
              <h2>Planning a trip?</h2>
              <p>Send us your dates and group size. We'll suggest a plan and a vehicle.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a className="btn btn--whatsapp" href={links.whatsappHref()} target="_blank" rel="noopener"><Icon name="whatsapp" />WhatsApp</a>
              <Link className="btn btn--primary" href="/contact">Contact us</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
