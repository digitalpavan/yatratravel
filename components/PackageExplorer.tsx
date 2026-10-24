'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useMemo, useState, useTransition } from 'react';
import { m } from 'motion/react';
import { Icon } from '@/components/Icon';
import { PackageCard } from '@/components/ui';
import { stagger, variants } from '@/lib/motion';
import {
  categoryLabels, durationBucket, durationLabels,
  type DurationBucket, type PackageCategory, type PackageSummary,
} from '@/lib/catalog';

const PAGE_SIZE = 9;
type Sort = 'popular' | 'price-asc' | 'price-desc';

/**
 * Search, filters and sort run in the browser (the catalogue is small) and are mirrored to the URL,
 * so filtered views can be shared and the back button works.
 */
export function PackageExplorer({ packages }: { packages: PackageSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const deferredQuery = useDeferredValue(query);

  const types = params.getAll('type') as PackageCategory[];
  const durations = params.getAll('duration') as DurationBucket[];
  const sort = (params.get('sort') as Sort) || 'popular';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const update = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    mutate(next);
    next.delete('page');
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  };
  const toggle = (key: string, value: string) =>
    update(p => {
      const values = p.getAll(key);
      p.delete(key);
      (values.includes(value) ? values.filter(v => v !== value) : [...values, value]).forEach(v => p.append(key, v));
    });

  const results = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const filtered = packages.filter(p => {
      if (types.length && !types.includes(p.category)) return false;
      if (durations.length && !durations.includes(durationBucket(p.durationDays))) return false;
      if (!q) return true;
      const haystack = `${p.title} ${p.summary} ${p.destinationText}`.toLowerCase();
      return q.split(/\s+/).every(word => haystack.includes(word));
    });
    // Packages without a confirmed price sort after priced ones.
    const price = (p: PackageSummary, dir: 1 | -1) => (p.fromPrice === null ? Infinity : p.fromPrice * dir);
    return filtered.sort((a, b) =>
      sort === 'price-asc' ? price(a, 1) - price(b, 1) : sort === 'price-desc' ? price(a, -1) - price(b, -1) : b.popularity - a.popularity,
    );
  }, [packages, types, durations, sort, deferredQuery]);

  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilters = types.length + durations.length + (query ? 1 : 0);
  const hasPrices = packages.some(p => p.fromPrice !== null);
  const resultsKey = `${types.join()}|${durations.join()}|${sort}|${deferredQuery}|${page}`;
  const pageHref = (n: number) => { const p = new URLSearchParams(params); if (n > 1) p.set('page', String(n)); else p.delete('page'); return `${pathname}?${p}`; };

  const clearAll = () => { setQuery(''); startTransition(() => router.replace(pathname, { scroll: false })); };

  return (
    <div className="explorer">
      <div className="explorer__search">
        <label className="visually-hidden" htmlFor="pkg-search">Search by destination or temple</label>
        <Icon name="search" size={20} className="explorer__search-icon" />
        <input
          id="pkg-search"
          className="input"
          type="search"
          placeholder="Search a destination or temple, e.g. Srikalahasti"
          value={query}
          onChange={e => { setQuery(e.target.value); update(p => (e.target.value ? p.set('q', e.target.value) : p.delete('q'))); }}
        />
      </div>

      <div className="explorer__filters">
        <fieldset className="filter-row">
          <legend>Package type</legend>
          <div className="chips">
            {(Object.keys(categoryLabels) as PackageCategory[]).map(c => (
              <button key={c} type="button" className="chip" aria-pressed={types.includes(c)} onClick={() => toggle('type', c)}>{categoryLabels[c]}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="filter-row">
          <legend>Duration</legend>
          <div className="chips">
            {(Object.keys(durationLabels) as DurationBucket[]).map(d => (
              <button key={d} type="button" className="chip" aria-pressed={durations.includes(d)} onClick={() => toggle('duration', d)}>{durationLabels[d]}</button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="toolbar">
        <p className="results-count" role="status" aria-live="polite">
          {results.length === 1 ? '1 package' : `${results.length} packages`}
          {activeFilters > 0 && <> · <button type="button" className="link-button" onClick={clearAll}>Clear filters</button></>}
        </p>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-page" htmlFor="sort">Sort by</label>
          <select id="sort" className="select select--sm" value={sort} onChange={e => update(p => (e.target.value === 'popular' ? p.delete('sort') : p.set('sort', e.target.value)))}>
            <option value="popular">Most popular</option>
            <option value="price-asc" disabled={!hasPrices}>Price: low to high</option>
            <option value="price-desc" disabled={!hasPrices}>Price: high to low</option>
          </select>
        </div>
      </div>

      <div className={`explorer__results${pending ? ' is-pending' : ''}`} aria-busy={pending}>
        {visible.length > 0 ? (
          <m.div className="grid grid--3" key={resultsKey} initial="hidden" animate="visible" variants={stagger(0.06)}>
            {visible.map(p => (
              <m.div className="reveal-item" variants={variants.up} key={p.slug}>
                <PackageCard pkg={p} showInclusions headingLevel={2} />
              </m.div>
            ))}
          </m.div>
        ) : (
          <div className="empty-state">
            <span className="empty-state__icon"><Icon name="search" size={28} /></span>
            <h2 className="h4">No packages match your search</h2>
            <p>Try another destination or remove a filter. Or tell us where you want to go and we'll plan it for you.</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button type="button" className="btn btn--outline" onClick={clearAll}>Clear filters</button>
              <Link className="btn btn--primary" href="/book?package=custom-pilgrimage-itinerary">Plan a custom trip</Link>
            </div>
          </div>
        )}
      </div>

      {pages > 1 && (
        <nav className="pagination" aria-label="Pagination">
          {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
            <Link key={n} href={pageHref(n)} scroll={false} aria-current={n === page ? 'page' : undefined}>{n}</Link>
          ))}
        </nav>
      )}
    </div>
  );
}
