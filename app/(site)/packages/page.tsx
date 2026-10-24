import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PackageExplorer } from '@/components/PackageExplorer';
import { PageHero } from '@/components/ui';
import { toSummary } from '@/lib/catalog';
import { getDestinations, getPackages } from '@/lib/data';
import { PackagesSkeleton } from '@/components/PackagesSkeleton';

export const metadata: Metadata = {
  title: 'Tirupati Tour Packages, Temple Tours & Cabs',
  description: 'Compare Tirupati temple tours, Tirumala transport, day trips to Kanipakam, Srikalahasti and Vellore, and airport transfers. Prices per vehicle with inclusions listed.',
  alternates: { canonical: '/packages' },
};

export default async function PackagesPage() {
  const [packages, destinations] = await Promise.all([getPackages(), getDestinations()]);
  return (
    <>
      <PageHero
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Packages' }]}
        title="Packages & tours"
        lead="Temple tours, Tirumala transport and cabs from Tirupati. Prices are per vehicle, not per person, and every package lists what's included."
      />
      <div className="container section" style={{ paddingTop: 'var(--space-6)' }}>
        {/* useSearchParams needs a Suspense boundary; the skeleton shows while it resolves. */}
        <Suspense fallback={<PackagesSkeleton />}>
          <PackageExplorer packages={packages.map(p => toSummary(p, destinations))} />
        </Suspense>
      </div>
    </>
  );
}
