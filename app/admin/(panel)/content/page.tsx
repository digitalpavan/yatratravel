import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { ImagePicker } from '@/components/admin/ImagePicker';
import { CountedInput, RecordListEditor } from '@/components/admin/ListEditors';
import { PageTitle } from '@/components/admin/ui';
import { imageOptions } from '@/lib/admin-images';
import { requireRole } from '@/lib/auth';
import type { Settings } from '@/lib/data';
import { createUserClient } from '@/lib/supabase/clients';
import { businessWhatsappNumber } from '@/lib/whatsapp';
import { uploadMedia } from '../media/actions';
import { deleteDestination, saveDestination, saveSetting } from './actions';

export const metadata: Metadata = { title: 'Website content' };

const TABS = [
  ['brand', 'Business & launch'], ['contact', 'Contact details'], ['hero', 'Homepage hero'], ['home', 'Homepage packages & FAQs'],
  ['destinations', 'Destinations'], ['testimonials', 'Reviews'], ['seo', 'SEO defaults'], ['accounting', 'Accounting'],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const tab: Tab = (TABS.find(t => t[0] === sp.tab)?.[0]) ?? 'brand';
  const db = await createUserClient();
  const [{ data: rows }, { data: reviews }, { data: packages }, { data: destinations }, images] = await Promise.all([
    db.from('site_settings').select('key, value'),
    db.from('reviews').select('quote, name, city, package_label').order('sort'),
    db.from('packages').select('slug, title, published').order('popularity', { ascending: false }),
    db.from('destinations').select('*').order('sort'),
    imageOptions(db),
  ]);
  const s = Object.fromEntries((rows ?? []).map(r => [r.key, r.value])) as Partial<Settings> & { accounting?: { revenueReliable: boolean } };
  const brand = s.brand ?? { name: 'Yatra Travels', tagline: '', story: null, serviceArea: [], googleReviewsUrl: null, verified: false };
  const contact = s.contact ?? { phone: null, phoneDisplay: null, whatsapp: null, email: null, address: null, mapsUrl: null, mapsEmbedUrl: null, hours: null };
  const hero = s.hero ?? { eyebrow: '', lines: [], text: '', image: '', mobileImage: '' };
  const home = s.home ?? { packageSlugs: [], faqs: [] };
  const key = (k: string) => <input type="hidden" name="_key" value={k} />;
  const whatsappFromEnv = businessWhatsappNumber(null);

  return (
    <>
      <PageTitle title="Website content" sub="Changes are published to the website as soon as you save." actions={<Link className="btn btn--outline btn--sm" href="/admin/blog">Blog posts</Link>} />
      <nav className="tabs card" aria-label="Content sections">
        {TABS.map(([id, label]) => <Link key={id} className="tab" href={`/admin/content?tab=${id}`} aria-current={tab === id ? 'true' : undefined}>{label}</Link>)}
      </nav>

      {tab === 'brand' && (
        <ActionForm action={saveSetting} className="card card--pad stack">
          {key('brand')}
          <div className="form-grid form-grid--2">
            <div className="field"><label className="label" htmlFor="name">Business name</label><input className="input" id="name" name="name" defaultValue={brand.name} required /></div>
            <div className="field"><label className="label" htmlFor="tagline">Tagline</label><input className="input" id="tagline" name="tagline" defaultValue={brand.tagline} /></div>
          </div>
          <div className="field"><label className="label" htmlFor="story">Company story (About page)</label><textarea className="textarea" id="story" name="story" defaultValue={brand.story ?? ''} rows={8} /><p className="hint">Separate paragraphs with a blank line. Only include facts you can stand behind: no unverified years, customer counts or awards.</p></div>
          <div className="field"><label className="label" htmlFor="serviceArea">Service areas (one per line)</label><textarea className="textarea" id="serviceArea" name="serviceArea" defaultValue={brand.serviceArea.join('\n')} /></div>
          <div className="field"><label className="label" htmlFor="googleReviewsUrl">Google reviews link</label><input className="input" id="googleReviewsUrl" name="googleReviewsUrl" type="url" defaultValue={brand.googleReviewsUrl ?? ''} placeholder="https://g.page/r/…" /></div>
          <div className="notice">
            <label className="check"><input type="checkbox" name="verified" defaultChecked={brand.verified} />
              <span><strong>Business details are verified. Launch the site.</strong> Removes the preview banner and lets search engines index the website. Tick this only once the contact details, prices and photos are real.</span>
            </label>
          </div>
          <div><SubmitButton variant="primary">Save</SubmitButton></div>
        </ActionForm>
      )}

      {tab === 'contact' && (
        <ActionForm action={saveSetting} className="card card--pad form-grid form-grid--2">
          {key('contact')}
          <div className="field"><label className="label" htmlFor="phone">Phone (digits with country code)</label><input className="input" id="phone" name="phone" defaultValue={contact.phone ?? ''} placeholder="919876543210" inputMode="numeric" /></div>
          <div className="field"><label className="label" htmlFor="phoneDisplay">Phone as shown</label><input className="input" id="phoneDisplay" name="phoneDisplay" defaultValue={contact.phoneDisplay ?? ''} placeholder="+91 98765 43210" /></div>
          <div className="field"><label className="label" htmlFor="whatsapp">WhatsApp number (digits with country code)</label><input className="input" id="whatsapp" name="whatsapp" defaultValue={contact.whatsapp ?? ''} placeholder="919876543210" inputMode="numeric" />
            {whatsappFromEnv && <p className="hint">The website uses {whatsappFromEnv}, set by WHATSAPP_BUSINESS_NUMBER on the server. This field is only a fallback.</p>}</div>
          <div className="field"><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" defaultValue={contact.email ?? ''} /></div>
          <div className="field span-all"><label className="label" htmlFor="address">Office address (Tirupati)</label><textarea className="textarea" id="address" name="address" defaultValue={contact.address ?? ''} style={{ minHeight: 80 }} /><p className="hint">Publish only the confirmed office address.</p></div>
          <div className="field"><label className="label" htmlFor="hours">Office hours</label><input className="input" id="hours" name="hours" defaultValue={contact.hours ?? ''} placeholder="Every day, 6 AM – 10 PM" /></div>
          <div className="field"><label className="label" htmlFor="mapsUrl">Google Maps link</label><input className="input" id="mapsUrl" name="mapsUrl" type="url" defaultValue={contact.mapsUrl ?? ''} /></div>
          <div className="field span-all"><label className="label" htmlFor="mapsEmbedUrl">Google Maps embed link</label><input className="input" id="mapsEmbedUrl" name="mapsEmbedUrl" type="url" defaultValue={contact.mapsEmbedUrl ?? ''} placeholder="https://www.google.com/maps/embed?pb=…" /><p className="hint">Google Maps → Share → Embed a map → copy only the src="…" link.</p></div>
          <div className="span-all"><SubmitButton variant="primary">Save contact details</SubmitButton></div>
        </ActionForm>
      )}

      {tab === 'hero' && (
        <ActionForm action={saveSetting} className="card card--pad stack">
          {key('hero')}
          <div className="field"><label className="label" htmlFor="eyebrow">Small line above the headline</label><input className="input" id="eyebrow" name="eyebrow" defaultValue={hero.eyebrow} maxLength={80} /></div>
          <div className="form-grid form-grid--2">
            <div className="field"><label className="label" htmlFor="line1">Headline, line 1</label><input className="input" id="line1" name="line1" defaultValue={hero.lines[0] ?? ''} maxLength={40} required /></div>
            <div className="field"><label className="label" htmlFor="line2">Headline, line 2</label><input className="input" id="line2" name="line2" defaultValue={hero.lines[1] ?? ''} maxLength={40} /></div>
          </div>
          <CountedInput id="text" name="text" label="Supporting text" max={240} defaultValue={hero.text} multiline />
          <ImagePicker name="image" label="Banner image (wide, 16:9)" value={hero.image} options={images} upload={uploadMedia} />
          <ImagePicker name="mobileImage" label="Mobile banner image (tall, 9:16)" value={hero.mobileImage} options={images} upload={uploadMedia} />
          <div><SubmitButton variant="primary">Save hero</SubmitButton></div>
        </ActionForm>
      )}

      {tab === 'home' && (
        <ActionForm action={saveSetting} className="stack-lg">
          {key('home')}
          <section className="card card--pad">
            <h2 className="h4">Homepage packages</h2>
            <p className="hint">Choose up to 3, in the order shown. Only published packages appear.</p>
            <div className="check-grid mt-4">
              {(packages ?? []).map(p => <label className="check" key={p.slug}><input type="checkbox" name="packageSlugs" value={p.slug} defaultChecked={home.packageSlugs.includes(p.slug)} /> {p.title}{!p.published && <span className="text-muted"> (draft)</span>}</label>)}
            </div>
          </section>
          <section className="card card--pad">
            <h2 className="h4">Homepage FAQs</h2>
            <RecordListEditor name="faqs" initial={home.faqs} addLabel="Add question" fields={[{ key: 'q', label: 'Question', required: true }, { key: 'a', label: 'Answer', multiline: true, required: true }]} />
          </section>
          <div><SubmitButton variant="primary">Save homepage</SubmitButton></div>
        </ActionForm>
      )}

      {tab === 'destinations' && (
        <div className="stack-lg">
          <p className="hint">Featured destinations appear on the homepage and darshan page. Packages link to destinations by slug.</p>
          {[...(destinations ?? []), { slug: '', name: '', detail: '', distance: '', image: '', featured: true, sort: (destinations?.length ?? 0) }].map((d, i) => (
            <section className="card card--pad" key={d.slug || 'new'}>
              <h2 className="h4">{d.slug ? d.name : 'Add a destination'}</h2>
              <ActionForm action={saveDestination} className="form-grid form-grid--3 mt-4">
                <div className="field"><label className="label" htmlFor={`d-name-${i}`}>Name</label><input className="input" id={`d-name-${i}`} name="name" defaultValue={d.name} required /></div>
                <div className="field"><label className="label" htmlFor={`d-slug-${i}`}>Slug</label><input className="input" id={`d-slug-${i}`} name="slug" defaultValue={d.slug} required readOnly={!!d.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></div>
                <div className="field"><label className="label" htmlFor={`d-distance-${i}`}>Distance from Tirupati</label><input className="input" id={`d-distance-${i}`} name="distance" defaultValue={d.distance} placeholder="About 36 km" /></div>
                <div className="field span-2"><label className="label" htmlFor={`d-detail-${i}`}>Main temple or attraction</label><input className="input" id={`d-detail-${i}`} name="detail" defaultValue={d.detail} /></div>
                <div className="field"><label className="label" htmlFor={`d-sort-${i}`}>Order</label><input className="input" id={`d-sort-${i}`} name="sort" type="number" min={0} defaultValue={d.sort} /></div>
                <div className="span-all"><ImagePicker name="image" label="Photo" value={d.image} options={images} upload={uploadMedia} /></div>
                <label className="check span-all"><input type="checkbox" name="featured" defaultChecked={d.featured} /> Featured on the homepage</label>
                <div className="span-all"><SubmitButton size="sm">{d.slug ? 'Save' : 'Add destination'}</SubmitButton></div>
              </ActionForm>
              {d.slug && (
                <ActionForm action={deleteDestination} confirm={`Delete ${d.name}?`} className="mt-4">
                  <input type="hidden" name="slug" value={d.slug} /><SubmitButton size="sm" variant="ghost">Delete</SubmitButton>
                </ActionForm>
              )}
            </section>
          ))}
        </div>
      )}

      {tab === 'testimonials' && (
        <ActionForm action={saveSetting} className="card card--pad stack">
          {key('testimonials')}
          <p className="hint">Add only genuine reviews from real customers, with their permission. Never write or edit reviews yourself.</p>
          <RecordListEditor name="items" initial={(reviews ?? []).map(r => ({ quote: r.quote, name: r.name, city: r.city, package: r.package_label }))} addLabel="Add review"
            fields={[{ key: 'quote', label: 'Review', multiline: true, required: true }, { key: 'name', label: 'Customer name (as they agreed to be shown)', required: true }, { key: 'city', label: 'City' }, { key: 'package', label: 'Package' }]} />
          <label className="check"><input type="checkbox" name="consent" /> These are real reviews, shared with the customers' permission.</label>
          <div><SubmitButton variant="primary">Save reviews</SubmitButton></div>
        </ActionForm>
      )}

      {tab === 'seo' && (
        <ActionForm action={saveSetting} className="card card--pad stack">
          {key('seo')}
          <CountedInput id="seo-title" name="title" label="Default page title" max={70} defaultValue={s.seo?.title ?? ''} />
          <CountedInput id="seo-description" name="description" label="Default meta description" max={170} defaultValue={s.seo?.description ?? ''} multiline hint="Aim for 140–160 characters" />
          <p className="hint">Packages and blog posts have their own SEO fields in their editors.</p>
          <div><SubmitButton variant="primary">Save SEO defaults</SubmitButton></div>
        </ActionForm>
      )}

      {tab === 'accounting' && (
        <ActionForm action={saveSetting} className="card card--pad stack">
          {key('accounting')}
          <label className="check"><input type="checkbox" name="revenueReliable" defaultChecked={s.accounting?.revenueReliable ?? false} />
            <span><strong>Revenue figures are reliable.</strong> Shows revenue on the dashboard (administrators only). Tick this only when every booking's payment is recorded in the dashboard. The figures come only from those records.</span>
          </label>
          <div><SubmitButton variant="primary">Save</SubmitButton></div>
        </ActionForm>
      )}
    </>
  );
}
