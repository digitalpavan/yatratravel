import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Flash, PageTitle } from '@/components/admin/ui';
import { imageOptions } from '@/lib/admin-images';
import { requireRole } from '@/lib/auth';
import { toRupees } from '@/lib/format';
import { createUserClient } from '@/lib/supabase/clients';
import { deletePackage } from '../actions';
import { PackageForm, type PackageRow } from '../PackageForm';

export const metadata: Metadata = { title: 'Edit package' };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

const BLANK: PackageRow = {
  slug: '', title: '', category: 'temple-tour', destinations: [], duration_days: 1, duration_label: '', summary: '', overview: '', image: '', gallery: [],
  passengers_min: 1, passengers_max: 12, price_unit: 'per vehicle', itinerary: [], inclusions: [], exclusions: [], faqs: [], popularity: 50,
  featured: false, published: false, seo_title: '', seo_description: '',
};

// Handles both /admin/packages/new and /admin/packages/<id>.
export default async function PackageEditor({ params, searchParams }: Props) {
  await requireRole('admin');
  const { id } = await params;
  const { created } = await searchParams;
  const isNew = id === 'new';
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();

  const db = await createUserClient();
  const [pkgRes, vehicles, destinations, images] = await Promise.all([
    isNew ? Promise.resolve({ data: null }) : db.from('packages').select('*, package_vehicles(vehicle_id, price_paise), itinerary_days(day, title, stops)').eq('id', id).maybeSingle(),
    db.from('vehicles').select('id, name, passengers').order('sort'),
    db.from('destinations').select('slug, name').order('sort'),
    imageOptions(db),
  ]);
  const row = pkgRes.data as (Omit<PackageRow, 'itinerary'> & { id: string; package_vehicles: { vehicle_id: string; price_paise: number | null }[]; itinerary_days: PackageRow['itinerary'] }) | null;
  if (!isNew && !row) notFound();

  const prices = Object.fromEntries((row?.package_vehicles ?? []).map(v => [v.vehicle_id, toRupees(v.price_paise)]));
  const pkg: PackageRow = row
    ? { ...row, duration_days: row.duration_days === null ? null : Number(row.duration_days), itinerary: [...row.itinerary_days].sort((a, b) => a.day - b.day) }
    : BLANK;

  return (
    <>
      <PageTitle back={{ href: '/admin/packages', label: 'Packages' }} title={isNew ? 'New package' : pkg.title}
        actions={!isNew && pkg.published && <Link className="btn btn--outline btn--sm" href={`/packages/${pkg.slug}`} target="_blank">View on website</Link>} />
      <Flash ok={created ? 'Package created.' : undefined} />
      <PackageForm pkg={pkg} prices={isNew ? {} : prices} vehicles={vehicles.data ?? []} destinations={destinations.data ?? []} images={images} />
      {!isNew && (
        <section className="card card--pad danger-zone" aria-labelledby="danger">
          <h2 id="danger" className="h4">Delete package</h2>
          <p className="text-sm text-muted">Removes it from the website. Existing bookings keep their package name. To hide it temporarily, untick "Published" instead.</p>
          <ActionForm action={deletePackage} confirm={`Delete "${pkg.title}" permanently?`} className="mt-4">
            <input type="hidden" name="id" value={id} />
            <SubmitButton variant="danger" size="sm">Delete package</SubmitButton>
          </ActionForm>
        </section>
      )}
    </>
  );
}
