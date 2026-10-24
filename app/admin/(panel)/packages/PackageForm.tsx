import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { ImagePicker } from '@/components/admin/ImagePicker';
import { CountedInput, ItineraryEditor, RecordListEditor } from '@/components/admin/ListEditors';
import type { ImageOption } from '@/lib/admin-images';
import { categoryLabels } from '@/lib/catalog';
import { uploadMedia } from '../media/actions';
import { savePackage } from './actions';

export type PackageRow = {
  id?: string; slug: string; title: string; category: string; destinations: string[]; duration_days: number | null; duration_label: string;
  summary: string; overview: string; image: string; gallery: string[]; passengers_min: number; passengers_max: number; price_unit: string;
  itinerary: { day: number; title: string; stops: { name: string; note?: string }[] }[]; inclusions: string[]; exclusions: string[];
  faqs: { q: string; a: string }[]; popularity: number; featured: boolean; published: boolean; seo_title: string; seo_description: string;
};

type Props = {
  pkg: PackageRow;
  prices: Record<string, number | null>; // vehicle_id → price (present = offered)
  vehicles: { id: string; name: string; passengers: number }[];
  destinations: { slug: string; name: string }[];
  images: ImageOption[];
};

export function PackageForm({ pkg, prices, vehicles, destinations, images }: Props) {
  return (
    <ActionForm action={savePackage} className="stack-lg package-form">
      {pkg.id && <input type="hidden" name="id" value={pkg.id} />}

      <section className="card card--pad form-grid form-grid--2" aria-labelledby="basics">
        <h2 id="basics" className="h4 span-all">Basics</h2>
        <div className="field"><label className="label" htmlFor="title">Title</label><input className="input" id="title" name="title" defaultValue={pkg.title} required maxLength={120} /></div>
        <div className="field"><label className="label" htmlFor="slug">URL slug</label><input className="input" id="slug" name="slug" defaultValue={pkg.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} /><p className="hint">Shown as /packages/<strong>{pkg.slug || 'your-slug'}</strong>. Changing it breaks old links.</p></div>
        <div className="field"><label className="label" htmlFor="category">Type</label>
          <select className="select" id="category" name="category" defaultValue={pkg.category}>
            {Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field"><label className="label" htmlFor="popularity">Sort order (0–100, higher first)</label><input className="input" id="popularity" name="popularity" type="number" min={0} max={100} defaultValue={pkg.popularity} /></div>
        <div className="field span-all"><label className="label" htmlFor="summary">One-line summary</label><input className="input" id="summary" name="summary" defaultValue={pkg.summary} maxLength={300} required /></div>
        <div className="field span-all"><label className="label" htmlFor="overview">Overview</label><textarea className="textarea" id="overview" name="overview" defaultValue={pkg.overview} maxLength={3000} /></div>
      </section>

      <section className="card card--pad form-grid form-grid--3" aria-labelledby="dur">
        <h2 id="dur" className="h4 span-all">Duration and group size</h2>
        <div className="field"><label className="label" htmlFor="duration_label">Duration shown to customers</label><input className="input" id="duration_label" name="duration_label" defaultValue={pkg.duration_label} placeholder="Full day, 8–9 hours" required /></div>
        <div className="field"><label className="label" htmlFor="duration_days">Days (for filters)</label><input className="input" id="duration_days" name="duration_days" type="number" step="0.5" min={0.5} max={30} defaultValue={pkg.duration_days ?? ''} /><p className="hint">0.5 = a few hours. Leave empty for "Flexible".</p></div>
        <div className="flex gap-3">
          <div className="field"><label className="label" htmlFor="passengers_min">Min travellers</label><input className="input" id="passengers_min" name="passengers_min" type="number" min={1} max={60} defaultValue={pkg.passengers_min} /></div>
          <div className="field"><label className="label" htmlFor="passengers_max">Max travellers</label><input className="input" id="passengers_max" name="passengers_max" type="number" min={1} max={60} defaultValue={pkg.passengers_max} /></div>
        </div>
      </section>

      <section className="card card--pad" aria-labelledby="pricing">
        <h2 id="pricing" className="h4">Vehicles and pricing</h2>
        <p className="hint">Tick each vehicle offered. Leave the price empty to show "On request". Only enter prices the business has confirmed.</p>
        <div className="table-wrap mt-4">
          <table className="table">
            <thead><tr><th scope="col">Offered</th><th scope="col">Vehicle</th><th scope="col">Price per vehicle (₹)</th></tr></thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id}>
                  <td><input type="checkbox" name="vehicle_ids" value={v.id} defaultChecked={v.id in prices} aria-label={`Offer ${v.name}`} /></td>
                  <td>{v.name} <span className="text-muted">· up to {v.passengers}</span></td>
                  <td><input className="input input--sm" name={`price_${v.id}`} inputMode="decimal" defaultValue={prices[v.id] ?? ''} placeholder="On request" aria-label={`${v.name} price`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="field mt-4"><label className="label" htmlFor="price_unit">Price basis</label><input className="input" id="price_unit" name="price_unit" defaultValue={pkg.price_unit} placeholder="per vehicle, full day" /></div>
      </section>

      <section className="card card--pad" aria-labelledby="dest">
        <h2 id="dest" className="h4">Destinations</h2>
        <p className="hint">Used for search and the destination chips. <Link href="/admin/content?tab=destinations">Manage destinations</Link></p>
        <div className="check-grid mt-4">
          {destinations.map(d => <label className="check" key={d.slug}><input type="checkbox" name="destinations" value={d.slug} defaultChecked={pkg.destinations.includes(d.slug)} /> {d.name}</label>)}
        </div>
      </section>

      <section className="card card--pad" aria-labelledby="itin">
        <h2 id="itin" className="h4">Day-by-day itinerary</h2>
        <ItineraryEditor name="itinerary" initial={pkg.itinerary} />
      </section>

      <section className="card card--pad form-grid form-grid--2" aria-labelledby="incl">
        <h2 id="incl" className="h4 span-all">Inclusions and exclusions</h2>
        <div className="field"><label className="label" htmlFor="inclusions">Included (one per line)</label><textarea className="textarea" id="inclusions" name="inclusions" defaultValue={pkg.inclusions.join('\n')} /></div>
        <div className="field"><label className="label" htmlFor="exclusions">Not included (one per line)</label><textarea className="textarea" id="exclusions" name="exclusions" defaultValue={pkg.exclusions.join('\n')} /></div>
      </section>

      <section className="card card--pad stack" aria-labelledby="imgs">
        <h2 id="imgs" className="h4">Images</h2>
        <ImagePicker name="image" label="Main image" value={pkg.image} options={images} upload={uploadMedia} />
        {[0, 1, 2].map(i => <ImagePicker key={i} name="gallery" label={`Gallery image ${i + 1}`} value={pkg.gallery[i] ?? ''} options={images} upload={uploadMedia} />)}
      </section>

      <section className="card card--pad" aria-labelledby="faq">
        <h2 id="faq" className="h4">FAQs</h2>
        <RecordListEditor name="faqs" initial={pkg.faqs} addLabel="Add question" fields={[{ key: 'q', label: 'Question', required: true }, { key: 'a', label: 'Answer', multiline: true, required: true }]} />
      </section>

      <section className="card card--pad" aria-labelledby="seo">
        <h2 id="seo" className="h4">Search engines (SEO)</h2>
        <p className="hint">Optional. If empty, the title and summary are used.</p>
        <CountedInput id="seo_title" name="seo_title" label="SEO title" max={70} defaultValue={pkg.seo_title} />
        <CountedInput id="seo_description" name="seo_description" label="Meta description" max={170} defaultValue={pkg.seo_description} multiline hint="Aim for 140–160 characters" />
      </section>

      <section className="card card--pad sticky-save" aria-label="Publish">
        <label className="check"><input type="checkbox" name="published" defaultChecked={pkg.published} /> <strong>Published</strong>: visible on the website</label>
        <label className="check"><input type="checkbox" name="featured" defaultChecked={pkg.featured} /> Featured (used on the homepage if no packages are chosen there)</label>
        <SubmitButton variant="primary">Save package</SubmitButton>
      </section>
    </ActionForm>
  );
}
