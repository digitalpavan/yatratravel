import type { Metadata } from 'next';
import Link from 'next/link';
import { Accordion } from '@/components/Accordion';
import { HeroVideo } from '@/components/HeroVideo';
import { Icon, type IconName } from '@/components/Icon';
import { Intro, IntroItem, Parallax, Reveal, RevealGroup } from '@/components/motion';
import { Photo } from '@/components/Photo';
import { QuickBook } from '@/components/QuickBook';
import { JsonLd, PackageCard, SectionHead } from '@/components/ui';
import { toSummary } from '@/lib/catalog';
import { getDestinations, getPackages, getSettings, getVehicles, resolveImageRef } from '@/lib/data';
import { getVideo } from '@/lib/images';
import { contactLinks, siteUrl } from '@/lib/site';

// Title and description come from the SEO defaults in /admin/content (see the site layout).
export const metadata: Metadata = { alternates: { canonical: '/' } };

const why: { icon: IconName; title: string; text: string }[] = [
  { icon: 'clock', title: 'Planned around your darshan', text: 'Pickup times and routes are planned around your darshan slot and temple timings.' },
  { icon: 'rupee', title: 'Price agreed before you travel', text: 'We confirm the fare, inclusions and extras with you before the trip, not at drop-off.' },
  { icon: 'users', title: 'Vehicles for every group', text: 'From a sedan for two to a tempo traveller for the whole family.' },
  { icon: 'whatsapp', title: 'Updates on WhatsApp', text: 'Your booking reference, driver details and changes, all in one chat.' },
];

const steps = [
  { title: 'Send a request', text: 'Choose a package, date and vehicle, or tell us your own plan. It takes about two minutes.' },
  { title: 'We confirm with you', text: 'We check availability and confirm the price by phone or WhatsApp. Nothing is charged online.' },
  { title: 'Travel with peace of mind', text: 'Driver and vehicle details reach you before the trip. Your reference number covers everything.' },
];

export default async function Home() {
  const [packages, vehicles, destinations, settings] = await Promise.all([getPackages(), getVehicles(), getDestinations(), getSettings()]);
  const { hero, home, brand, contact, testimonials } = settings;
  const [heroImage, heroMobile] = await Promise.all([resolveImageRef(hero.image), resolveImageRef(hero.mobileImage)]);
  const links = contactLinks(contact);
  const video = getVideo('tirumala-hero');

  // Homepage packages are chosen in /admin/content; fall back to featured packages if none are set.
  const chosen = home.packageSlugs.map(s => packages.find(p => p.slug === s)).filter(p => !!p);
  const popular = (chosen.length ? chosen : packages.filter(p => p.featured)).slice(0, 3).map(p => toSummary(p, destinations));
  const featuredDestinations = destinations.filter(d => d.featured);

  const tabs = [
    { id: 'pilgrimage', label: 'Pilgrimage tours', icon: 'temple' as const, options: packages.filter(p => ['temple-tour', 'package', 'day-tour', 'custom'].includes(p.category)) },
    { id: 'tirumala', label: 'Tirumala & transfers', icon: 'route' as const, options: packages.filter(p => p.category === 'transfer') },
    { id: 'cabs', label: 'Cabs', icon: 'car' as const, options: packages.filter(p => p.category === 'cab') },
  ].filter(t => t.options.length).map(t => ({ ...t, options: t.options.map(p => ({ slug: p.slug, title: p.title })) }));

  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name: brand.name,
    url: siteUrl,
    logo: `${siteUrl}/images/branding/yatra-logo.svg`,
    areaServed: brand.serviceArea,
    ...(brand.verified && contact.phone ? { telephone: `+${contact.phone}` } : {}),
    ...(brand.verified && contact.email ? { email: contact.email } : {}),
    ...(brand.verified && contact.address ? { address: contact.address } : {}),
  };

  return (
    <div className="has-overlay-header">
      <JsonLd data={orgLd} />

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__media">
          <Parallax>
            {/* An uploaded hero is used at every size; the built-in asset pair uses its art-directed mobile crop. */}
            <Photo id={hero.image} entry={heroImage} mobileId={heroMobile && !hero.mobileImage.startsWith('media:') ? hero.mobileImage : undefined} priority sizes="100vw" />
            {video && <HeroVideo poster={video.poster} sources={video.sources} />}
          </Parallax>
        </div>
        <div className="container">
          {/* Eyebrow, headline lines and text rise in sequence; the buttons follow once the headline is in. */}
          <Intro className="hero__content">
            {hero.eyebrow && <IntroItem as="span" className="eyebrow">{hero.eyebrow}</IntroItem>}
            <h1 id="hero-title">
              {hero.lines.map(line => <IntroItem as="span" className="line" key={line}>{line}</IntroItem>)}
            </h1>
            {hero.text && <IntroItem as="p">{hero.text}</IntroItem>}
            <IntroItem className="hero__actions">
              <Link className="btn btn--primary btn--lg" href="/packages">Explore Packages <Icon name="arrow-right" /></Link>
              <Link className="btn btn--outline-inverse btn--lg" href="/book">Request a Booking</Link>
              <a className="btn btn--whatsapp btn--lg" href={links.whatsappHref()} target="_blank" rel="noopener"><Icon name="whatsapp" />Enquire on WhatsApp</a>
            </IntroItem>
          </Intro>
        </div>
      </section>

      {tabs.length > 0 && <div className="container"><QuickBook tabs={tabs} /></div>}

      {popular.length > 0 && (
        <section className="section" aria-labelledby="popular-title">
          <div className="container">
            <Reveal>
              <SectionHead eyebrow="Popular packages" title="Pilgrimage journeys from Tirupati" id="popular-title"
                action={<Link className="btn btn--outline" href="/packages">View all packages <Icon name="arrow-right" /></Link>} />
            </Reveal>
            <RevealGroup className="grid grid--3">
              {popular.map((p, i) => <div key={p.slug}><PackageCard pkg={p} /></div>)}
            </RevealGroup>
          </div>
        </section>
      )}

      {featuredDestinations.length > 0 && (
        <section className="section section--surface" aria-labelledby="dest-title">
          <div className="container">
            <Reveal><SectionHead eyebrow="Featured destinations" title="Sacred places within a day's drive" id="dest-title" lead="Every route starts in Tirupati. Distances are approximate." /></Reveal>
            <RevealGroup className="dest-grid">
              {featuredDestinations.map((d, i) => (
                <Link key={d.slug} className="dest-card" href={`/packages?q=${encodeURIComponent(d.name.split(' ')[0])}`}>
                  <Photo id={d.image} entry={d.imageEntry} sizes="(min-width: 1024px) 20vw, (min-width: 640px) 50vw, 100vw" />
                  <div className="dest-card__text"><h3>{d.name}</h3><p>{d.detail}</p><span>{d.distance}</span></div>
                </Link>
              ))}
            </RevealGroup>
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="fleet-title">
        <div className="container">
          <Reveal>
            <SectionHead eyebrow="Vehicle fleet" title="The right vehicle for your group" id="fleet-title"
              action={<Link className="btn btn--outline" href="/vehicles">Compare vehicles <Icon name="arrow-right" /></Link>} />
          </Reveal>
          <RevealGroup className="grid grid--4">
            {vehicles.map((v, i) => (
              <article key={v.slug} className="card vehicle-card">
                <div className="vehicle-card__media"><Photo id={v.image} entry={v.imageEntry} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" /></div>
                <div className="vehicle-card__body">
                  <h3 className="h4">{v.name}</h3>
                  <ul className="meta"><li><Icon name="users" size={16} />Up to {v.passengers} passengers</li></ul>
                  <p className="text-sm text-muted">{v.bestFor}</p>
                </div>
              </article>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="section section--inverse" aria-labelledby="why-title">
        <div className="container">
          <Reveal><SectionHead eyebrow={`Why ${brand.name}`} title="A pilgrimage needs patience. We plan for it." id="why-title" /></Reveal>
          <RevealGroup className="grid grid--4">
            {why.map((w, i) => (
              <div className="feature" key={w.title}>
                <span className="feature__icon"><Icon name={w.icon} size={26} /></span>
                <h3>{w.title}</h3>
                <p>{w.text}</p>
              </div>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="section" aria-labelledby="how-title">
        <div className="container">
          <Reveal><SectionHead eyebrow="How booking works" title="Three simple steps" id="how-title" /></Reveal>
          <RevealGroup as="ol" itemAs="li" itemClassName="reveal-item step-card" className="grid grid--3 steps-cards">
            {steps.map((s, i) => (
              <div className="card card--pad" key={s.title}>
                <span className="step-num">0{i + 1}</span>
                <h3 className="h4">{s.title}</h3>
                <p className="text-muted mt-2">{s.text}</p>
              </div>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* Only real reviews (added in /admin/content) are ever shown */}
      <section className="section section--surface" aria-labelledby="reviews-title">
        <div className="container">
          <Reveal><SectionHead eyebrow="Traveller reviews" title="What pilgrims say" id="reviews-title" /></Reveal>
          {testimonials.items.length > 0 ? (
            <RevealGroup className="grid grid--3">
              {testimonials.items.slice(0, 3).map((t, i) => (
                <figure className="card card--pad testimonial" key={t.name + i}>
                  <blockquote>“{t.quote}”</blockquote>
                  <figcaption><strong>{t.name}</strong>{t.city && ` · ${t.city}`}{t.package && ` · ${t.package}`}</figcaption>
                </figure>
              ))}
            </RevealGroup>
          ) : (
            <Reveal className="card testimonial-empty">
              <span className="empty-state__icon"><Icon name="star" size={28} /></span>
              <p className="lead">Reviews from our travellers will appear here.</p>
              {brand.googleReviewsUrl
                ? <a className="btn btn--outline" href={brand.googleReviewsUrl} target="_blank" rel="noopener">Read our Google reviews</a>
                : <p className="text-sm text-muted">Travelled with us? We'd love to hear from you on WhatsApp.</p>}
            </Reveal>
          )}
        </div>
      </section>

      {home.faqs.length > 0 && (
        <section className="section" aria-labelledby="faq-title">
          <div className="container container--narrow">
            <Reveal><SectionHead eyebrow="FAQs" title="Before you travel" id="faq-title" /></Reveal>
            <Reveal><Accordion items={home.faqs} defaultOpen={0} /></Reveal>
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: 0 }} aria-labelledby="cta-title">
        <div className="container">
          <Reveal variant="zoom" className="cta-band">
            <div>
              <span className="eyebrow">Plan with us</span>
              <h2 id="cta-title" className="mt-2">Tell us your plan. We'll arrange the travel.</h2>
              <p>Dates, group size and the temples you want to visit: that's all we need to send you a route and a quote.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a className="btn btn--whatsapp btn--lg" href={links.whatsappHref()} target="_blank" rel="noopener"><Icon name="whatsapp" />Enquire on WhatsApp</a>
              <a className="btn btn--outline-inverse btn--lg" href={links.phoneHref}><Icon name="phone" />{links.phoneLabel}</a>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
