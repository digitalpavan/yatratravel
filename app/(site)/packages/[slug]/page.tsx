import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Accordion } from '@/components/Accordion';
import { EnquiryForm } from '@/components/EnquiryForm';
import { Icon } from '@/components/Icon';
import { ImageSettle, Intro, IntroItem, Reveal, RevealGroup, Timeline } from '@/components/motion';
import { Photo } from '@/components/Photo';
import { Breadcrumbs, JsonLd, PackageCard, Price } from '@/components/ui';
import { categoryLabels, startingPrice, toSummary } from '@/lib/catalog';
import { getDestinations, getPackage, getPackages, getSettings, getVehicles, relatedPackages } from '@/lib/data';
import { formatPrice } from '@/lib/format';
import { contactLinks, siteUrl } from '@/lib/site';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getPackages()).map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pkg = await getPackage((await params).slug);
  if (!pkg) return {};
  const img = pkg.imageEntry;
  const description = pkg.seoDescription || `${pkg.summary} ${pkg.durationLabel}. Vehicles for 1–${pkg.passengers.max} travellers. Request a booking or enquire on WhatsApp.`.slice(0, 160);
  return {
    title: pkg.seoTitle || pkg.title,
    description,
    alternates: { canonical: `/packages/${pkg.slug}` },
    openGraph: { title: pkg.seoTitle || pkg.title, description, images: img ? [{ url: img.src, width: img.width, height: img.height, alt: img.alt }] : undefined },
  };
}

const generalFaqs = [
  { q: 'Is my trip confirmed when I send a request?', a: 'No. You get a booking reference straight away, and we confirm availability and the final price with you by phone or WhatsApp before the trip is confirmed.' },
  { q: 'Do you provide darshan tickets?', a: 'No. Darshan and temple tickets are booked separately through the official temple channels. We provide transport and plan around your slot.' },
];

export default async function PackagePage({ params }: Props) {
  const pkg = await getPackage((await params).slug);
  if (!pkg) notFound();

  const [allVehicles, destinations, related, settings] = await Promise.all([getVehicles(), getDestinations(), relatedPackages(pkg), getSettings()]);
  const links = contactLinks(settings.contact);
  const vehicles = pkg.vehicles.map(pv => ({ ...pv, vehicle: allVehicles.find(v => v.slug === pv.slug) })).filter(v => !!v.vehicle);
  const from = startingPrice(pkg);
  const faqs = [...pkg.faqs, ...generalFaqs.filter(g => !pkg.faqs.some(f => f.q === g.q))];
  const goesToTirumala = pkg.destinations.includes('tirumala');
  const bookHref = `/book?package=${pkg.slug}`;
  const destName = (slug: string) => destinations.find(d => d.slug === slug);

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'TouristTrip',
      name: pkg.title,
      description: pkg.overview,
      url: `${siteUrl}/packages/${pkg.slug}`,
      touristType: 'Pilgrims',
      provider: { '@type': 'TravelAgency', name: settings.brand.name, url: siteUrl },
      ...(pkg.itinerary.length ? {
        itinerary: {
          '@type': 'ItemList',
          itemListElement: pkg.itinerary.flatMap(d => d.stops).map((s, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'TouristAttraction', name: s.name } })),
        },
      } : {}),
      // Offers only for prices the business has confirmed.
      ...(from !== null ? { offers: { '@type': 'Offer', price: from, priceCurrency: 'INR', url: `${siteUrl}${bookHref}` } } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Packages', item: `${siteUrl}/packages` },
        { '@type': 'ListItem', position: 3, name: pkg.title },
      ],
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ];

  return (
    <>
      <JsonLd data={ld} />
      <div className="detail-hero">
        {/* The image is never hidden (it is the main content paint); it only settles from a slight zoom. */}
        <ImageSettle><Photo id={pkg.image} entry={pkg.imageEntry} priority sizes="100vw" /></ImageSettle>
        <div className="detail-hero__text">
          <Intro className="container" delay={0.15}>
            <IntroItem><Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: '/packages', label: 'Packages' }, { label: pkg.title }]} /></IntroItem>
            <IntroItem className="flex flex-wrap gap-2 mt-4"><span className="badge badge--gold">{categoryLabels[pkg.category]}</span></IntroItem>
            <IntroItem as="h1">{pkg.title}</IntroItem>
            <IntroItem as="ul" className="meta">
              <li><Icon name="clock" size={18} />{pkg.durationLabel}</li>
              <li><Icon name="users" size={18} />1–{pkg.passengers.max} travellers</li>
              {pkg.destinations.length > 0 && <li><Icon name="pin" size={18} />{pkg.destinations.map(d => destName(d)?.name ?? d).join(', ')}</li>}
            </IntroItem>
          </Intro>
        </div>
      </div>

      <div className="container detail">
        <div>
          <Reveal as="section" aria-labelledby="overview">
            <h2 id="overview">Overview</h2>
            <p>{pkg.overview}</p>
            <div className="highlights mt-5">
              <div className="card highlight"><Icon name="clock" /><strong>{pkg.durationLabel}</strong><span>Duration</span></div>
              <div className="card highlight"><Icon name="users" /><strong>1–{pkg.passengers.max} people</strong><span>Group size</span></div>
              {vehicles.length > 0 && <div className="card highlight"><Icon name="car" /><strong>{vehicles.length} vehicle type{vehicles.length > 1 ? 's' : ''}</strong><span>{vehicles[0].vehicle!.name}{vehicles.length > 1 && ` to ${vehicles.at(-1)!.vehicle!.name}`}</span></div>}
              <div className="card highlight"><Icon name="pin" /><strong>Door pickup</strong><span>Hotel, station or airport</span></div>
            </div>
            {pkg.gallery.length > 0 && (
              <div className="gallery-strip mt-5">
                {pkg.gallery.map(g => <Photo key={g.id} id={g.id} entry={g.entry} sizes="(min-width: 1024px) 30vw, 50vw" />)}
              </div>
            )}
          </Reveal>

          {goesToTirumala && (
            <Reveal as="section" className="notice" aria-label="About darshan tickets">
              <Icon name="info" />
              <p><strong>Darshan tickets are not included.</strong> {settings.brand.name} provides transport only. Book darshan through TTD's official channels and tell us your slot, and we'll plan the pickup around it.</p>
            </Reveal>
          )}

          {pkg.itinerary.length > 0 && (
            <section aria-labelledby="itinerary">
              <h2 id="itinerary">{pkg.itinerary.length > 1 ? 'Day-by-day itinerary' : 'Itinerary and stops'}</h2>
              <Timeline days={pkg.itinerary} />
            </section>
          )}

          {pkg.destinations.length > 0 && (
            <Reveal as="section" aria-labelledby="destinations">
              <h2 id="destinations">Destinations</h2>
              <div className="stop-chips">
                {pkg.destinations.map(d => { const x = destName(d); return <span className="badge" key={d}><Icon name="pin" size={14} />{x ? `${x.name}: ${x.detail}` : d}</span>; })}
              </div>
            </Reveal>
          )}

          {vehicles.length > 0 && (
            <Reveal as="section" aria-labelledby="prices">
              <h2 id="prices">Vehicles &amp; prices</h2>
              <div className="card table-wrap">
                <table className="table price-table">
                  <caption className="visually-hidden">Price per vehicle for {pkg.title}</caption>
                  <thead><tr><th scope="col">Vehicle</th><th scope="col">Passengers</th><th scope="col" className="num">Price</th></tr></thead>
                  <tbody>
                    {vehicles.map(({ slug, price, vehicle }) => (
                      <tr key={slug}>
                        <td>{vehicle!.name}<br /><span className="text-muted text-sm">{vehicle!.examples}</span></td>
                        <td>Up to {vehicle!.passengers}</td>
                        <td className="num">{formatPrice(price) ? <strong>{formatPrice(price)}</strong> : <span className="text-muted">On request</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-page mt-4">Prices are {pkg.priceUnit}. We confirm the final fare, including any tolls, parking or permits, before your trip. <Link href="/vehicles">Compare vehicles</Link></p>
            </Reveal>
          )}

          {(pkg.inclusions.length > 0 || pkg.exclusions.length > 0) && (
            <Reveal as="section" aria-labelledby="inclusions">
              <h2 id="inclusions">What's included</h2>
              <div className="incl">
                <div><h3>Included</h3><ul className="check-list check-list--yes">{pkg.inclusions.map(i => <li key={i}><Icon name="check-circle" />{i}</li>)}</ul></div>
                <div><h3>Not included</h3><ul className="check-list check-list--no">{pkg.exclusions.map(i => <li key={i}><Icon name="x-circle" />{i}</li>)}</ul></div>
              </div>
            </Reveal>
          )}

          <Reveal as="section" aria-labelledby="faqs">
            <h2 id="faqs">Frequently asked questions</h2>
            <Accordion items={faqs} />
          </Reveal>

          <Reveal as="section" aria-label="Enquiry">
            <EnquiryForm source="package" packageSlug={pkg.slug} packageTitle={pkg.title} whatsappNumber={links.whatsappNumber}
              title="Ask about availability" messagePlaceholder="Travel date, number of travellers, pickup point, any questions…" />
          </Reveal>
        </div>

        <aside aria-label="Booking summary">
          <div className="card summary-card">
            <div className="summary-card__price"><Price amount={from} unit={pkg.priceUnit} /></div>
            <dl>
              <div><dt>Duration</dt><dd>{pkg.durationLabel}</dd></div>
              <div><dt>Travellers</dt><dd>1–{pkg.passengers.max}</dd></div>
              {vehicles.length > 0 && <div><dt>Vehicles</dt><dd>{vehicles.map(v => v.vehicle!.name).join(', ')}</dd></div>}
              <div><dt>Payment</dt><dd>After confirmation</dd></div>
            </dl>
            <Link className="btn btn--primary btn--lg btn--block" href={bookHref}>Request a booking</Link>
            <a className="btn btn--whatsapp btn--block" href={links.whatsappHref(`Hello, I'd like to check availability for: ${pkg.title}`)} target="_blank" rel="noopener"><Icon name="whatsapp" />Check availability on WhatsApp</a>
            <p className="text-sm text-muted text-center">No payment online. We'll confirm availability and price with you first.</p>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="section section--surface" aria-labelledby="related-title" style={{ paddingBlock: 'var(--space-8)' }}>
          <div className="container">
            <Reveal><h2 id="related-title" style={{ fontSize: 'var(--text-h3)', marginBottom: 'var(--space-6)' }}>Related packages</h2></Reveal>
            <RevealGroup className="grid grid--3">
              {related.map((p, i) => <div key={p.slug}><PackageCard pkg={toSummary(p, destinations)} /></div>)}
            </RevealGroup>
          </div>
        </section>
      )}

      <div className="sticky-cta" role="region" aria-label="Book this package">
        <Price amount={from} size="sm" />
        <div className="flex gap-2">
          <a className="btn btn--whatsapp btn--sm" href={links.whatsappHref(`Hello, I'd like to check availability for: ${pkg.title}`)} target="_blank" rel="noopener" aria-label="Enquire on WhatsApp"><Icon name="whatsapp" /></a>
          <Link className="btn btn--primary" href={bookHref}>Request booking</Link>
        </div>
      </div>
    </>
  );
}
