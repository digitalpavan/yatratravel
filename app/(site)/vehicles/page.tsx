import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { EnquiryForm } from '@/components/EnquiryForm';
import { Icon } from '@/components/Icon';
import { Reveal, RevealGroup } from '@/components/motion';
import { Photo } from '@/components/Photo';
import { PageHero, SectionHead } from '@/components/ui';
import { getSettings, getVehicles } from '@/lib/data';
import { contactLinks } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Our Vehicles: Sedan, SUV, MPV & Tempo Traveller in Tirupati',
  description: 'Air-conditioned sedans, SUVs, premium MPVs and tempo travellers for Tirupati temple tours, Tirumala transport and outstation trips. Compare seats and luggage space, and request a quote.',
  alternates: { canonical: '/vehicles' },
};

const routes = [
  { title: 'Local Tirupati', text: 'Temple tours, hourly cab packages and hotel transfers within the city and Tiruchanur.' },
  { title: 'Tirumala', text: 'Up and down the ghat road via the Alipiri checkpoint, one-way or return with waiting.' },
  { title: 'Day trips', text: 'Srikalahasti, Kanipakam and the Sripuram Golden Temple at Vellore.' },
  { title: 'Outstation', text: 'Chennai, Bengaluru, Kanchipuram and longer South India circuits.' },
];

export default async function VehiclesPage() {
  const [vehicles, settings] = await Promise.all([getVehicles(), getSettings()]);
  const links = contactLinks(settings.contact);
  const unverified = vehicles.some(v => !v.verified);

  return (
    <>
      <PageHero
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Vehicles' }]}
        title="Our vehicles"
        lead="Air-conditioned vehicles for every group size, each with an experienced driver. Choose by the number of travellers and how much luggage you're bringing."
      />

      <section className="section" style={{ paddingTop: 'var(--space-7)' }} aria-labelledby="fleet-title">
        <div className="container">
          <h2 id="fleet-title" className="visually-hidden">Vehicle categories</h2>
          {unverified && (
            <p className="notice" style={{ marginBottom: 'var(--space-6)' }}>
              <Icon name="info" />
              <span>Photos are representative, and capacities are typical for each category. We confirm the exact vehicle, seats and luggage space when we confirm your booking.</span>
            </p>
          )}
          <div className="grid grid--2 vehicles-grid">
            {vehicles.map((v, i) => (
              <Reveal as="article" className="card vehicle-card" key={v.slug} delay={(i % 2) * 120} aria-labelledby={`v-${v.slug}`}>
                <div className="vehicle-card__media"><Photo id={v.image} entry={v.imageEntry} sizes="(min-width: 640px) 50vw, 100vw" /></div>
                <div className="vehicle-card__body">
                  <div>
                    <h3 id={`v-${v.slug}`}>{v.name}</h3>
                    <p className="text-sm text-muted">{v.examples}</p>
                  </div>
                  {/* Capacity figures, then features, appear in sequence as the card comes into view. */}
                  <RevealGroup as="dl" itemClassName="" className="vehicle-card__specs" step={0.1}>
                    <><dt>Passengers</dt><dd>{v.passengers}</dd></>
                    <><dt>Bags</dt><dd>{parseInt(v.luggage, 10) || '—'}</dd></>
                    <><dt>AC</dt><dd>{v.ac ? 'Yes' : 'No'}</dd></>
                  </RevealGroup>
                  <p className="text-sm"><strong>Best for:</strong> {v.bestFor}</p>
                  <p className="text-sm text-muted"><Icon name="package" size={16} className="inline-icon" /> Luggage: {v.luggage}</p>
                  <RevealGroup as="ul" itemAs="li" itemClassName="" className="check-list check-list--yes check-list--sm" step={0.06}>
                    {v.features.map(f => <Fragment key={f}><Icon name="check-circle" size={16} />{f}</Fragment>)}
                  </RevealGroup>
                  <div className="vehicle-card__actions">
                    <Link className="btn btn--primary btn--sm" href={`/book?vehicle=${v.slug}`}>Request a quote</Link>
                    <a className="btn btn--whatsapp btn--sm" href={links.whatsappHref(`Hello, is a ${v.name} available on my travel date?`)} target="_blank" rel="noopener"><Icon name="whatsapp" />Check availability</a>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--surface" aria-labelledby="pricing-title">
        <div className="container two-col">
          <Reveal className="stack">
            <span className="eyebrow">Pricing</span>
            <h2 id="pricing-title">Quoted for your trip</h2>
            <p className="lead">Fares depend on the vehicle, the route, the distance and how long you need it. Tell us your plan and we'll send a clear quote, with tolls, parking and permits listed, before you confirm.</p>
            <ul className="check-list check-list--yes">
              <li><Icon name="check-circle" />Prices are per vehicle, not per person</li>
              <li><Icon name="check-circle" />Fixed packages for popular routes</li>
              <li><Icon name="check-circle" />Nothing to pay online</li>
            </ul>
          </Reveal>
          <Reveal className="stack">
            <span className="eyebrow">Pickup and routes</span>
            <h2>Where we go</h2>
            <div className="grid grid--2">
              {routes.map(r => (
                <div className="card card--pad" key={r.title}><h3 className="h4">{r.title}</h3><p className="text-sm text-muted mt-2">{r.text}</p></div>
              ))}
            </div>
            <p className="text-sm text-muted-page">Pickups from Tirupati and Renigunta stations, Tirupati Airport, bus stands and hotels.</p>
          </Reveal>
        </div>
      </section>

      <section className="section" aria-labelledby="vehicle-enquiry">
        <div className="container container--narrow">
          <Reveal><SectionHead eyebrow="Availability" title="Check a vehicle for your date" id="vehicle-enquiry" center /></Reveal>
          <Reveal>
            <EnquiryForm source="vehicles" whatsappNumber={links.whatsappNumber} title="Vehicle availability enquiry"
              messagePlaceholder="Vehicle you'd like, number of travellers, route and dates…" />
          </Reveal>
        </div>
      </section>
    </>
  );
}
