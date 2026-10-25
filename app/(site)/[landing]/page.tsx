import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Accordion } from '@/components/Accordion';
import { Icon } from '@/components/Icon';
import { Reveal, RevealGroup } from '@/components/motion';
import { Photo } from '@/components/Photo';
import { JsonLd, PackageCard, PageHero, SectionHead } from '@/components/ui';
import { toSummary } from '@/lib/catalog';
import { getDestinations, getPackages, getPosts, getSettings } from '@/lib/data';
import { getImage } from '@/lib/images';
import { getLandingPage, landingPages } from '@/lib/landing-pages';
import { contactLinks, siteUrl } from '@/lib/site';

// SEO landing pages (lib/landing-pages.ts). Only the listed slugs exist; any other top-level path is a 404.
export const dynamicParams = false;
export const generateStaticParams = () => landingPages.map(p => ({ landing: p.slug }));

type Props = { params: Promise<{ landing: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = getLandingPage((await params).landing);
  if (!page) return {};
  const img = getImage(page.image) ?? getImage('tirumala-hero');
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url: `/${page.slug}`,
      ...(img && { images: [{ url: img.src, width: img.width, height: img.height, alt: img.alt }] }),
    },
  };
}

export default async function LandingPage({ params }: Props) {
  const page = getLandingPage((await params).landing);
  if (!page) notFound();

  const [packages, destinations, posts, settings] = await Promise.all([getPackages(), getDestinations(), getPosts(), getSettings()]);
  const links = contactLinks(settings.contact);
  const offers = page.packageSlugs.map(s => packages.find(p => p.slug === s)).filter(p => !!p);
  const guides = page.guideSlugs.map(s => posts.find(p => p.slug === s)).filter(p => !!p);
  const others = landingPages.filter(p => p.slug !== page.slug);
  const primary = offers[0];
  const photo = getImage(page.image);
  const url = `${siteUrl}/${page.slug}`;

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: page.title,
      serviceType: page.serviceType,
      description: page.metaDescription,
      url,
      areaServed: { '@type': 'City', name: 'Tirupati' },
      provider: {
        '@type': 'TravelAgency',
        name: settings.brand.name,
        url: siteUrl,
        ...(settings.contact.phone && { telephone: `+${settings.contact.phone}` }),
      },
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: page.title,
        itemListElement: offers.map(p => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: p.title, url: `${siteUrl}/packages/${p.slug}` } })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        ...(page.slug === 'tirupati-travel-services' ? [] : [{ '@type': 'ListItem', position: 2, name: 'Travel services', item: `${siteUrl}/tirupati-travel-services` }]),
        { '@type': 'ListItem', position: page.slug === 'tirupati-travel-services' ? 2 : 3, name: page.title, item: url },
      ],
    },
  ];

  const crumbs = [
    { href: '/', label: 'Home' },
    ...(page.slug === 'tirupati-travel-services' ? [] : [{ href: '/tirupati-travel-services', label: 'Travel services' }]),
    { label: page.title },
  ];
  const bookHref = primary ? `/book?package=${primary.slug}` : '/book';

  return (
    <>
      <JsonLd data={ld} />
      <PageHero eyebrow={page.eyebrow} title={page.title} lead={page.lead} crumbs={crumbs}>
        <div className="flex flex-wrap gap-3 mt-5">
          <Link className="btn btn--primary btn--lg" href={bookHref}>Request a booking <Icon name="arrow-right" /></Link>
          <a className="btn btn--whatsapp btn--lg" href={links.whatsappHref(page.whatsappText)} target="_blank" rel="noopener"><Icon name="whatsapp" />Ask on WhatsApp</a>
        </div>
      </PageHero>

      <div className="container detail">
        <article className="prose">
          {photo && <Photo id={page.image} entry={photo} priority sizes="(min-width: 1024px) 720px, 100vw" className="landing-photo" />}
          {page.sections.map(s => (
            <section key={s.heading} aria-label={s.heading}>
              <h2>{s.heading}</h2>
              {s.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
              {s.bullets && <ul>{s.bullets.map(b => <li key={b}>{b}</li>)}</ul>}
            </section>
          ))}
        </article>

        <aside aria-label="Key facts">
          <div className="card summary-card">
            <dl>
              {page.facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
            </dl>
            <Link className="btn btn--primary btn--lg btn--block" href={bookHref}>Request a booking</Link>
            <a className="btn btn--whatsapp btn--block" href={links.whatsappHref(page.whatsappText)} target="_blank" rel="noopener"><Icon name="whatsapp" />WhatsApp us</a>
            <a className="btn btn--outline btn--block" href={links.phoneHref}><Icon name="phone" />{links.phoneLabel}</a>
            <p className="text-sm text-muted text-center">No payment online. We confirm availability and the price with you first.</p>
          </div>
        </aside>
      </div>

      {offers.length > 0 && (
        <section className="section section--surface" aria-labelledby="offers-title">
          <div className="container">
            <Reveal><SectionHead eyebrow="Book this service" title="Packages and prices" id="offers-title" action={<Link className="btn btn--outline" href="/packages">All packages</Link>} /></Reveal>
            <RevealGroup className="grid grid--3">
              {offers.map(p => <div key={p.slug}><PackageCard pkg={toSummary(p, destinations)} /></div>)}
            </RevealGroup>
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="faq-title">
        <div className="container container--narrow">
          <Reveal><SectionHead eyebrow="Questions" title="Frequently asked questions" id="faq-title" /></Reveal>
          <Accordion items={page.faqs} />
        </div>
      </section>

      <section className="section section--surface" aria-labelledby="more-title">
        <div className="container two-col">
          {guides.length > 0 && (
            <div className="stack">
              <h2 id="more-title" className="h4">Travel guides</h2>
              <ul className="link-list">
                {guides.map(g => <li key={g.slug}><Link href={`/blog/${g.slug}`}>{g.title}</Link></li>)}
              </ul>
            </div>
          )}
          <div className="stack">
            <h2 className="h4" id={guides.length ? undefined : 'more-title'}>More from {settings.brand.name}</h2>
            <ul className="link-list">
              {others.map(o => <li key={o.slug}><Link href={`/${o.slug}`}>{o.title}</Link></li>)}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
