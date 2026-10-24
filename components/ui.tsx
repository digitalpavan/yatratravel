import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { Photo } from '@/components/Photo';
import { categoryLabels, type PackageSummary } from '@/lib/catalog';
import { formatPrice } from '@/lib/format';

export function SectionHead({ eyebrow, title, lead, id, action, center }: { eyebrow?: string; title: string; lead?: ReactNode; id?: string; action?: ReactNode; center?: boolean }) {
  return (
    <div className={`section-head${action ? ' section-head--row' : ''}${center ? ' section-head--center' : ''}`}>
      <div className="stack">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 id={id}>{title}</h2>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

/** Shows a confirmed price, or "Price on request". Never shows a price the business hasn't set. */
export function Price({ amount, unit, size }: { amount: number | null; unit?: string; size?: 'sm' }) {
  const formatted = formatPrice(amount);
  if (!formatted) {
    return (
      <div className="price">
        <span className="price__from">Price</span>
        <span className={`price__amount price__amount--request${size ? ' price__amount--sm' : ''}`}>On request</span>
        {unit && <span className="price__unit">{unit}</span>}
      </div>
    );
  }
  return (
    <div className="price">
      <span className="price__from">From</span>
      <span className={`price__amount${size ? ' price__amount--sm' : ''}`}>{formatted}</span>
      {unit && <span className="price__unit">{unit}</span>}
    </div>
  );
}

export function PackageCard({ pkg, showInclusions = false, priority = false, headingLevel = 3 }: { pkg: PackageSummary; showInclusions?: boolean; priority?: boolean; headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as 'h2' | 'h3';
  return (
    <article className="card package-card">
      <div className="package-card__media">
        <Photo id={pkg.image} entry={pkg.imageEntry} sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw" priority={priority} />
        <div className="package-card__badges">
          <span className="badge badge--navy">{categoryLabels[pkg.category]}</span>
        </div>
      </div>
      <div className="package-card__body">
        <H className="package-card__title"><Link href={`/packages/${pkg.slug}`}>{pkg.title}</Link></H>
        <ul className="meta">
          <li><Icon name="clock" size={16} />{pkg.durationLabel}</li>
        </ul>
        <p className="package-card__summary">{pkg.summary}</p>
        {showInclusions && (pkg.inclusions.length > 0 || pkg.exclusions.length > 0) && (
          <div className="package-card__incl">
            {pkg.inclusions.length > 0 && (
              <ul className="check-list check-list--yes check-list--sm" aria-label="Included">
                {pkg.inclusions.slice(0, 3).map(i => <li key={i}><Icon name="check-circle" size={16} />{i}</li>)}
              </ul>
            )}
            {pkg.exclusions.length > 0 && (
              <ul className="check-list check-list--no check-list--sm" aria-label="Not included">
                {pkg.exclusions.slice(0, 2).map(i => <li key={i}><Icon name="x-circle" size={16} />{i}</li>)}
              </ul>
            )}
          </div>
        )}
        <div className="package-card__foot">
          <Price amount={pkg.fromPrice} unit={pkg.priceUnit} />
          <Link className="btn btn--primary btn--sm package-card__actions" href={`/book?package=${pkg.slug}`}>
            {pkg.fromPrice ? 'Book' : 'Check availability'}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => (
          <li key={item.label}>{item.href && i < items.length - 1 ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

/** Marks business details that still need confirming. */
export function Pending({ children = 'To be confirmed' }: { children?: ReactNode }) {
  return <span className="pending">{children}</span>;
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export function PageHero({ eyebrow, title, lead, crumbs, children }: { eyebrow?: string; title: string; lead?: ReactNode; crumbs?: { href?: string; label: string }[]; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="container">
        {crumbs && <Breadcrumbs items={crumbs} />}
        {eyebrow && <span className="eyebrow page-head__eyebrow">{eyebrow}</span>}
        <h1 className="page-head__title">{title}</h1>
        {lead && <p className="lead page-head__lead">{lead}</p>}
        {children}
      </div>
    </div>
  );
}
