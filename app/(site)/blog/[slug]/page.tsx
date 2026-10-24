import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Intro, IntroItem, Reveal } from '@/components/motion';
import { Photo } from '@/components/Photo';
import { Breadcrumbs, JsonLd } from '@/components/ui';
import { getPost, getPosts, getSettings } from '@/lib/data';
import { renderMarkdown } from '@/lib/markdown';
import { formatDate } from '@/lib/format';
import { contactLinks, siteUrl } from '@/lib/site';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getPosts()).map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return {};
  const img = post.imageEntry;
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      tags: post.tags,
      images: img ? [{ url: img.src, width: img.width, height: img.height, alt: post.imageAlt }] : undefined,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const post = await getPost((await params).slug);
  if (!post) notFound();
  const [posts, settings] = await Promise.all([getPosts(), getSettings()]);
  const others = posts.filter(p => p.slug !== post.slug).slice(0, 2);
  const img = post.imageEntry;
  const links = contactLinks(settings.contact);
  const site = settings.brand;

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.date,
      mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
      ...(img ? { image: `${siteUrl}${img.src}` } : {}),
      author: { '@type': 'Organization', name: site.name, url: siteUrl },
      publisher: { '@type': 'Organization', name: site.name, logo: { '@type': 'ImageObject', url: `${siteUrl}/images/branding/yatra-logo.svg` } },
      keywords: post.tags.join(', '),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Travel guides', item: `${siteUrl}/blog` },
        { '@type': 'ListItem', position: 3, name: post.title },
      ],
    },
  ];

  return (
    <article>
      <JsonLd data={ld} />
      <header className="container article-head">
        <Intro>
        <IntroItem><Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: '/blog', label: 'Travel guides' }, { label: post.title }]} /></IntroItem>
        <IntroItem as="h1">{post.title}</IntroItem>
        <IntroItem as="p" className="text-muted-page mt-4">
          <span className="eyebrow">{post.category}</span> · <time dateTime={post.date}>{formatDate(post.date, { day: 'numeric', month: 'long', year: 'numeric' })}</time> · {post.readingMinutes} min read
        </IntroItem>
      </Intro>
      </header>
      <div className="container">
        <Reveal variant="image" className="article-cover"><Photo id={post.image} entry={post.imageEntry} alt={post.imageAlt} priority sizes="(min-width: 1320px) 1320px, 100vw" /></Reveal>
      </div>
      <div className="container article-body two-col two-col--wide-left">
        <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }} />
        <aside className="stack" aria-label="Plan your trip">
          <div className="card card--pad stack" style={{ position: 'sticky', top: 'calc(var(--header-height) + var(--space-5))' }}>
            <h2 className="h4">Need transport?</h2>
            <p className="text-sm text-muted">Tell us your dates and group size. We'll suggest a vehicle and a plan.</p>
            <Link className="btn btn--primary btn--block" href="/book">Request a booking</Link>
            <a className="btn btn--whatsapp btn--block" href={links.whatsappHref()} target="_blank" rel="noopener"><Icon name="whatsapp" />Ask on WhatsApp</a>
          </div>
          {others.length > 0 && (
            <nav className="card card--pad stack" aria-label="More guides">
              <h2 className="h4">More guides</h2>
              <ul className="check-list">
                {others.map(o => <li key={o.slug}><Icon name="arrow-right" /><Link href={`/blog/${o.slug}`}>{o.title}</Link></li>)}
              </ul>
            </nav>
          )}
        </aside>
      </div>
    </article>
  );
}
