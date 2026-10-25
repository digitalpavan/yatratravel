import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { ImagePicker } from '@/components/admin/ImagePicker';
import { PageTitle } from '@/components/admin/ui';
import { imageOptions } from '@/lib/admin-images';
import { requireRole } from '@/lib/auth';
import { formatDate, todayInIndia, toRupees } from '@/lib/format';
import { createUserClient } from '@/lib/supabase/clients';
import { uploadMedia } from '../../media/actions';
import { addBlock, deleteVehicle, removeBlock, saveVehicle } from '../actions';

export const metadata: Metadata = { title: 'Vehicle' };
type Props = { params: Promise<{ id: string }> };

export default async function VehicleEditor({ params }: Props) {
  const user = await requireRole('staff');
  const { id } = await params;
  const isNew = id === 'new';
  if (isNew && user.role !== 'admin') notFound();
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const isAdmin = user.role === 'admin';
  const db = await createUserClient();

  const [vRes, iRes, blocks, images] = await Promise.all([
    isNew ? Promise.resolve({ data: null }) : db.from('vehicles').select('*').eq('id', id).maybeSingle(),
    isNew ? Promise.resolve({ data: null }) : db.from('vehicle_internal').select('*').eq('vehicle_id', id).maybeSingle(),
    isNew ? Promise.resolve({ data: [] }) : db.from('vehicle_blocks').select('id, start_date, end_date, units, reason').eq('vehicle_id', id).gte('end_date', todayInIndia()).order('start_date'),
    isAdmin ? imageOptions(db) : Promise.resolve([]),
  ]);
  const v = vRes.data ?? { slug: '', name: '', examples: '', passengers: 4, luggage: '', ac: true, image: '', best_for: '', features: [], active: true, verified: false, sort: 0 };
  const i = iRes.data ?? { fleet_count: 0, fleet_details: '', per_km_rate_paise: null, min_km_per_day: null, driver_allowance_per_day_paise: null, night_charge_paise: null, extra_hour_rate_paise: null, pricing_notes: '' };
  const rupees = (paise: number | null) => toRupees(paise) ?? '';
  if (!isNew && !vRes.data) notFound();

  return (
    <>
      <PageTitle back={{ href: '/admin/vehicles', label: 'Vehicles' }} title={isNew ? 'Add a vehicle' : v.name}
        sub={isAdmin ? undefined : 'You can view this vehicle and manage unavailable dates. Only administrators can change its details.'} />

      <ActionForm action={saveVehicle} className="stack-lg">
        <input type="hidden" name="id" value={isNew ? '' : id} />
        <fieldset className="card card--pad form-grid form-grid--2" disabled={!isAdmin}>
          <legend className="h4 span-all">Shown on the website</legend>
          <div className="field"><label className="label" htmlFor="name">Category name</label><input className="input" id="name" name="name" defaultValue={v.name} required /></div>
          <div className="field"><label className="label" htmlFor="slug">Slug</label><input className="input" id="slug" name="slug" defaultValue={v.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></div>
          <div className="field"><label className="label" htmlFor="examples">Example models</label><input className="input" id="examples" name="examples" defaultValue={v.examples} placeholder="Toyota Innova Crysta or similar" /></div>
          <div className="field"><label className="label" htmlFor="passengers">Passenger capacity (excluding driver)</label><input className="input" id="passengers" name="passengers" type="number" min={1} max={60} defaultValue={v.passengers} required /></div>
          <div className="field"><label className="label" htmlFor="luggage">Luggage capacity</label><input className="input" id="luggage" name="luggage" defaultValue={v.luggage} placeholder="3 medium bags" /></div>
          <div className="field"><label className="label" htmlFor="sort">Display order</label><input className="input" id="sort" name="sort" type="number" min={0} defaultValue={v.sort} /></div>
          <div className="field span-all"><label className="label" htmlFor="best_for">Best for</label><input className="input" id="best_for" name="best_for" defaultValue={v.best_for} /></div>
          <div className="field span-all"><label className="label" htmlFor="features">Features (one per line)</label><textarea className="textarea" id="features" name="features" defaultValue={(v.features as string[]).join('\n')} /></div>
          {isAdmin ? <div className="span-all"><ImagePicker name="image" label="Photo" value={v.image} options={images} upload={uploadMedia} /></div> : <input type="hidden" name="image" value={v.image} />}
          <div className="span-all flex flex-wrap gap-5">
            <label className="check"><input type="checkbox" name="ac" defaultChecked={v.ac} /> Air-conditioned</label>
            <label className="check"><input type="checkbox" name="active" defaultChecked={v.active} /> Active (shown on the website)</label>
            <label className="check"><input type="checkbox" name="verified" defaultChecked={v.verified} /> Capacity and photo verified against the real fleet</label>
          </div>
        </fieldset>

        <fieldset className="card card--pad form-grid form-grid--3" disabled={!isAdmin}>
          <legend className="h4 span-all">Fleet and pricing rules (internal, never shown publicly)</legend>
          <div className="field"><label className="label" htmlFor="fleet_count">Vehicles in fleet</label><input className="input" id="fleet_count" name="fleet_count" type="number" min={0} defaultValue={i.fleet_count} /></div>
          <div className="field span-2"><label className="label" htmlFor="fleet_details">Actual fleet (model, registration, driver)</label><textarea className="textarea" id="fleet_details" name="fleet_details" defaultValue={i.fleet_details} placeholder={'AP 03 XX 1234: Innova Crysta 2022, driver Ramesh\n…'} /></div>
          <div className="field"><label className="label" htmlFor="per_km_rate_paise">Rate per km (₹)</label><input className="input" id="per_km_rate_paise" name="per_km_rate_paise" inputMode="decimal" defaultValue={rupees(i.per_km_rate_paise)} /></div>
          <div className="field"><label className="label" htmlFor="min_km_per_day">Minimum km per day</label><input className="input" id="min_km_per_day" name="min_km_per_day" inputMode="numeric" defaultValue={i.min_km_per_day ?? ''} /></div>
          <div className="field"><label className="label" htmlFor="driver_allowance_per_day_paise">Driver allowance per day (₹)</label><input className="input" id="driver_allowance_per_day_paise" name="driver_allowance_per_day_paise" inputMode="decimal" defaultValue={rupees(i.driver_allowance_per_day_paise)} /></div>
          <div className="field"><label className="label" htmlFor="night_charge_paise">Night charge (₹)</label><input className="input" id="night_charge_paise" name="night_charge_paise" inputMode="decimal" defaultValue={rupees(i.night_charge_paise)} /></div>
          <div className="field"><label className="label" htmlFor="extra_hour_rate_paise">Extra hour (₹)</label><input className="input" id="extra_hour_rate_paise" name="extra_hour_rate_paise" inputMode="decimal" defaultValue={rupees(i.extra_hour_rate_paise)} /></div>
          <div className="field span-all"><label className="label" htmlFor="pricing_notes">Pricing notes</label><textarea className="textarea" id="pricing_notes" name="pricing_notes" defaultValue={i.pricing_notes} placeholder="Toll and parking extra; interstate permit for Tamil Nadu…" /></div>
        </fieldset>
        {isAdmin && <div><SubmitButton variant="primary">Save vehicle</SubmitButton></div>}
      </ActionForm>

      {!isNew && (
        <section className="card card--pad" aria-labelledby="avail-title">
          <h2 id="avail-title" className="h4">Unavailable dates</h2>
          <p className="hint">Block dates when vehicles in this category are already out, in service or off the road.</p>
          <ActionForm action={addBlock} resetOnSuccess className="form-grid form-grid--4 mt-4">
            <input type="hidden" name="vehicle_id" value={id} />
            <div className="field"><label className="label" htmlFor="start_date">From</label><input className="input" id="start_date" name="start_date" type="date" min={todayInIndia()} required /></div>
            <div className="field"><label className="label" htmlFor="end_date">To</label><input className="input" id="end_date" name="end_date" type="date" min={todayInIndia()} required /></div>
            <div className="field"><label className="label" htmlFor="units">Vehicles</label><input className="input" id="units" name="units" type="number" min={1} defaultValue={1} /></div>
            <div className="field"><label className="label" htmlFor="reason">Reason</label><input className="input" id="reason" name="reason" placeholder="Service, booked, etc." /></div>
            <div className="span-all"><SubmitButton size="sm" variant="outline">Block dates</SubmitButton></div>
          </ActionForm>
          <ul className="list mt-4">
            {(blocks.data ?? []).map(b => (
              <li key={b.id}>
                <div><strong>{formatDate(b.start_date, { day: 'numeric', month: 'short' })} – {formatDate(b.end_date, { day: 'numeric', month: 'short', year: 'numeric' })}</strong><span>{b.units} vehicle{b.units > 1 ? 's' : ''}{b.reason && ` · ${b.reason}`}</span></div>
                <ActionForm action={removeBlock} className="" confirm="Remove this block?"><input type="hidden" name="id" value={b.id} /><SubmitButton size="sm" variant="ghost">Remove</SubmitButton></ActionForm>
              </li>
            ))}
            {!(blocks.data ?? []).length && <li className="text-muted text-sm">No upcoming unavailable dates.</li>}
          </ul>
        </section>
      )}

      {!isNew && isAdmin && (
        <section className="card card--pad danger-zone" aria-labelledby="danger">
          <h2 id="danger" className="h4">Remove vehicle</h2>
          <p className="text-sm text-muted">Deletes this vehicle category, its fleet record and unavailable dates, and takes it off every package that offers it. Past bookings keep the vehicle name. To hide it temporarily, untick "Active" instead.</p>
          <ActionForm action={deleteVehicle} confirm={`Remove "${v.name}" permanently?`} className="mt-4">
            <input type="hidden" name="id" value={id} />
            <SubmitButton variant="danger" size="sm"><Icon name="trash" size={16} />Remove vehicle</SubmitButton>
          </ActionForm>
        </section>
      )}
    </>
  );
}
