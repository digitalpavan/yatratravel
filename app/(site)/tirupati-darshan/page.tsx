import type { Metadata } from 'next';
import Link from 'next/link';
import { EnquiryForm } from '@/components/EnquiryForm';
import { Icon, type IconName } from '@/components/Icon';
import { Intro, IntroItem, Parallax, Reveal, RevealGroup, Timeline } from '@/components/motion';
import { Photo } from '@/components/Photo';
import { PackageCard, SectionHead } from '@/components/ui';
import { toSummary } from '@/lib/catalog';
import { getDestinations, getPackages, getSettings } from '@/lib/data';
import { contactLinks } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Tirupati Darshan Travel: Tirumala Transport & Temple Tours',
  description: 'Plan your Tirupati and Tirumala darshan trip: ghat road transport, station and airport pickups, local temple tours and suggested itineraries. Darshan tickets are booked separately with TTD.',
  alternates: { canonical: '/tirupati-darshan' },
};

const pickups: { icon: IconName; title: string; text: string }[] = [
  { icon: 'train', title: 'Railway stations', text: 'Tirupati Main and Renigunta Junction. Share your train number and the driver will follow its arrival.' },
  { icon: 'plane', title: 'Tirupati Airport', text: 'Pickup at arrivals for flights into Tirupati (Renigunta).' },
  { icon: 'home', title: 'Hotels & homes', text: 'Anywhere in Tirupati, Tiruchanur or Renigunta, plus accommodation at Tirumala for the return.' },
  { icon: 'route', title: 'Up the ghat road', text: 'Every vehicle goes through the Alipiri checkpoint. Allow time for the security check, especially at weekends and on festival days.' },
];

const itineraries = [
  {
    title: 'One day: Tirumala darshan',
    stops: [
      { name: 'Early pickup in Tirupati', note: 'Timed to your darshan slot.' },
      { name: 'Alipiri checkpoint and ghat road', note: 'About an hour up the hill, plus the security check.' },
      { name: 'Tirumala: darshan at your booked slot', note: 'The driver waits, or returns at an agreed time.' },
      { name: 'Return to Tirupati', note: 'Optional stop at Sri Padmavathi Ammavari Temple, Tiruchanur.' },
    ],
  },
  {
    title: 'Two days: Tirumala and Tirupati temples',
    stops: [
      { name: 'Day 1: arrival pickup and Tirumala', note: 'Station or airport pickup, then up to Tirumala for your slot.' },
      { name: 'Day 2: Tirupati temple tour', note: 'Tiruchanur, Govindaraja Swamy, Kapileswara Swamy and Srinivasa Mangapuram.' },
      { name: 'Drop for your journey home' },
    ],
  },
  {
    title: 'Three days: with Srikalahasti and Kanipakam',
    stops: [
      { name: 'Day 1: Tirumala', note: 'At your booked darshan slot.' },
      { name: 'Day 2: Tirupati temples', note: 'Local temple tour at a relaxed pace.' },
      { name: 'Day 3: Srikalahasti and Kanipakam', note: 'Full-day trip, back in Tirupati by evening.' },
    ],
  },
];

export default async function DarshanPage() {
  const [packages, destinations, settings] = await Promise.all([getPackages(), getDestinations(), getSettings()]);
  const links = contactLinks(settings.contact);
  const tours = ['tirupati-local-temple-tour', 'tirupati-to-tirumala-transport', 'kanipakam-srikalahasti-tour']
    .map(s => packages.find(p => p.slug === s)).filter(p => !!p).map(p => toSummary(p, destinations));

  return (
    <div className="has-overlay-header">
      <section className="hero hero--short" aria-labelledby="darshan-title">
        <div className="hero__media"><Parallax><Photo id="tirumala-hills" priority sizes="100vw" /></Parallax></div>
        <div className="container">
          <Intro className="hero__content">
            <IntroItem as="span" className="eyebrow">Pilgrimage travel</IntroItem>
            <h1 id="darshan-title"><IntroItem as="span" className="line">Tirupati &amp; Tirumala</IntroItem><IntroItem as="span" className="line">darshan travel</IntroItem></h1>
            <IntroItem as="p">Comfortable transport up the hill, pickups from stations and the airport, and temple tours around Tirupati, all planned around your darshan.</IntroItem>
            <IntroItem className="hero__actions">
              <Link className="btn btn--primary btn--lg" href="/book?package=tirupati-to-tirumala-transport">Request Tirumala transport</Link>
              <a className="btn btn--whatsapp btn--lg" href={links.whatsappHref('Hello, I need transport for Tirumala darshan.')} target="_blank" rel="noopener"><Icon name="whatsapp" />Enquire on WhatsApp</a>
            </IntroItem>
          </Intro>
        </div>
      </section>

      {/* Ticket responsibility: stated up front, not hidden in small print */}
      <section className="container" style={{ marginTop: 'var(--space-7)' }} aria-labelledby="tickets-title">
        <Reveal className="notice notice--large">
          <Icon name="info" size={24} />
          <div>
            <h2 id="tickets-title" className="h4">About darshan tickets</h2>
            <ul className="notice__list">
              <li><strong>Yatra Travels does not sell or issue TTD darshan tickets</strong>, and cannot guarantee darshan access or a particular time slot.</li>
              <li>Darshan tickets and accommodation at Tirumala are booked through <a href="https://ttdevasthanams.ap.gov.in" target="_blank" rel="noopener">TTD's official website</a> and counters. Ticket types, quotas and rules change, so check there before you plan.</li>
              <li>We provide the transport. Tell us your slot and we'll plan the pickup, the ghat road journey and the waiting time around it.</li>
            </ul>
          </div>
        </Reveal>
      </section>

      {/* Travel information */}
      <section className="section" aria-labelledby="info-title">
        <div className="container two-col two-col--wide-left">
          <Reveal className="prose">
            <span className="eyebrow">Travel information</span>
            <h2 id="info-title" style={{ marginTop: 'var(--space-3)' }}>Tirupati and Tirumala: what to know</h2>
            <p><strong>Tirupati</strong> is the town at the foot of the Seshachalam hills, with the railway station, the airport at nearby Renigunta, and temples such as Sri Govindaraja Swamy and Sri Kapileswara Swamy. <strong>Tirumala</strong>, home of the Sri Venkateswara Swamy Temple, is on top of the hills, about 22 km away by ghat road.</p>
            <ul>
              <li><strong>By road:</strong> vehicles go up through the Alipiri checkpoint, where TTD checks vehicles and luggage. The drive usually takes about an hour, plus any wait at the checkpoint.</li>
              <li><strong>On foot:</strong> many pilgrims climb the Alipiri or Srivari Mettu footpaths. We can drop you at the start and collect your luggage, or meet you at the top.</li>
              <li><strong>Dress and belongings:</strong> traditional dress is expected, and phones and cameras aren't allowed inside the temple. Check TTD's current guidelines before you travel.</li>
              <li><strong>Timing:</strong> weekends, holidays and festivals like Brahmotsavam are much busier. Allow extra time on the road and at the checkpoint.</li>
            </ul>
          </Reveal>
          <Reveal variant="image" className="article-cover"><Photo id="tirumala-trip" sizes="(min-width: 1024px) 40vw, 100vw" /></Reveal>
        </div>
      </section>

      {/* Transport and pickup */}
      <section className="section section--surface" aria-labelledby="pickup-title">
        <div className="container">
          <Reveal><SectionHead eyebrow="Transport and pickup" title="Door to darshan, and back" id="pickup-title" /></Reveal>
          <RevealGroup className="grid grid--4">
            {pickups.map((p, i) => (
              <div className="feature" key={p.title}>
                <span className="feature__icon"><Icon name={p.icon} size={26} /></span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* Local temple tours */}
      <section className="section" aria-labelledby="tours-title">
        <div className="container">
          <Reveal><SectionHead eyebrow="Temple tour options" title="Tours around Tirupati" id="tours-title" action={<Link className="btn btn--outline" href="/packages">All packages</Link>} /></Reveal>
          <RevealGroup className="grid grid--3">
            {tours.map((p, i) => <div key={p.slug}><PackageCard pkg={p} /></div>)}
          </RevealGroup>
        </div>
      </section>

      {/* Destinations */}
      <section className="section section--surface" aria-labelledby="temples-title">
        <div className="container">
          <Reveal><SectionHead eyebrow="Temples nearby" title="Where pilgrims go next" id="temples-title" /></Reveal>
          <RevealGroup className="dest-grid">
            {destinations.filter(d => d.featured).map((d, i) => {
              return (
                <Link key={d.slug} className="dest-card" href={`/packages?q=${encodeURIComponent(d.name.split(' ')[0])}`}>
                  <Photo id={d.image} entry={d.imageEntry} sizes="(min-width: 1024px) 20vw, 50vw" />
                  <div className="dest-card__text"><h3>{d.name}</h3><p>{d.detail}</p><span>{d.distance}</span></div>
                </Link>
              );
            })}
          </RevealGroup>
        </div>
      </section>

      {/* Suggested itineraries */}
      <section className="section" aria-labelledby="itin-title">
        <div className="container">
          <Reveal><SectionHead eyebrow="Suggested itineraries" title="Plans that work for most families" id="itin-title" lead="Starting points only. We adjust each one to your darshan slot, group and pace." /></Reveal>
          <div className="grid grid--3">
            {itineraries.map((it, i) => (
              <Reveal className="card card--pad" key={it.title} delay={i * 120}>
                <h3 className="h4" style={{ marginBottom: 'var(--space-5)' }}>{it.title}</h3>
                <Timeline compact days={[{ day: 1, stops: it.stops }]} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Enquiry */}
      <section className="section section--surface" aria-labelledby="enquire-title">
        <div className="container two-col">
          <Reveal className="stack">
            <span className="eyebrow">Plan your darshan trip</span>
            <h2 id="enquire-title">Tell us your slot and group</h2>
            <p className="lead">We'll suggest the vehicle, pickup time and route, and confirm the price with you on WhatsApp or by phone.</p>
            <ul className="check-list check-list--yes">
              <li><Icon name="check-circle" />Transport planned around your darshan slot</li>
              <li><Icon name="check-circle" />Pickups from stations, the airport and hotels</li>
              <li><Icon name="check-circle" />No payment online. We confirm everything first</li>
            </ul>
          </Reveal>
          <Reveal>
            <EnquiryForm source="darshan" whatsappNumber={links.whatsappNumber} title="Darshan travel enquiry"
              messagePlaceholder="Darshan date and slot (if booked), number of travellers, pickup point…" />
          </Reveal>
        </div>
      </section>
    </div>
  );
}
