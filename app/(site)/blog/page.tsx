import type { Metadata } from 'next';
import Link from 'next/link';
import { Reveal, RevealGroup } from '@/components/motion';
import { Photo } from '@/components/Photo';
import { JsonLd, PageHero } from '@/components/ui';
import { getPosts, getSettings } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Tirupati & Tirumala Travel Guides',
  description: 'Practical guides to planning a Tirumala trip, visiting Tirupati temples, getting from the airport and stations, and day trips to Kanipakam and Srikalahasti.',
  alternates: { canonical: '/blog' },
};

export default async function BlogIndex() {
  const [posts, { brand }] = await Promise.all([getPosts(), getSettings()]);
  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: `${brand.name} travel guides`,
        url: `${siteUrl}/blog`,
        blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${siteUrl}/blog/${p.slug}`, datePublished: p.date })),
      }} />
      <PageHero crumbs={[{ href: '/', label: 'Home' }, { label: 'Travel guides' }]} eyebrow="Travel guides" title="Plan your pilgrimage"
        lead="Itinerary ideas, transport tips and practical advice for Tirupati, Tirumala and the temples nearby." />
      <section className="section" style={{ paddingTop: 'var(--space-7)' }}>
        <div className="container">
          <RevealGroup className="grid grid--3 blog-grid">
            {posts.map((p, i) => (
              <article className="card" key={p.slug}>
                <div className="blog-card__media"><Photo id={p.image} entry={p.imageEntry} alt={p.imageAlt} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" /></div>
                <div className="blog-card__body">
                  <span className="eyebrow">{p.category}</span>
                  <h2><Link href={`/blog/${p.slug}`}>{p.title}</Link></h2>
                  <p className="text-sm text-muted">{p.description}</p>
                  <p className="text-sm text-muted"><time dateTime={p.date}>{formatDate(p.date, { day: 'numeric', month: 'long', year: 'numeric' })}</time> · {p.readingMinutes} min read</p>
                </div>
              </article>
            ))}
          </RevealGroup>
        </div>
      </section>
    </>
  );
}
