import type { Metadata } from 'next';
import { BookingForm } from '@/components/BookingForm';
import { Icon } from '@/components/Icon';
import { PageHero } from '@/components/ui';
import { getPackages, getSettings, getVehicles } from '@/lib/data';
import { todayInIndia, toPaise } from '@/lib/format';
import { paymentsEnabled } from '@/lib/server/razorpay';
import { contactLinks } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Request a Booking',
  description: 'Request a Tirupati temple tour, Tirumala transport or cab. Get a booking reference instantly; we confirm availability and the price before your trip.',
  alternates: { canonical: '/book' },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BookPage({ searchParams }: Props) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  const [allPackages, allVehicles, settings] = await Promise.all([getPackages(), getVehicles(), getSettings()]);
  const links = contactLinks(settings.contact);
  const packages = allPackages.map(p => ({
    slug: p.slug, title: p.title, vehicles: p.vehicles.map(v => v.slug), passengers: p.passengers,
    prices: Object.fromEntries(p.vehicles.map(v => [v.slug, toPaise(v.price)])), priceUnit: p.priceUnit, payOnline: p.payOnline,
  }));
  const onlinePayment = paymentsEnabled();
  const vehicles = allVehicles.map(v => ({ slug: v.slug, name: v.name, passengers: v.passengers, examples: v.examples }));
  const today = todayInIndia();

  // Prefill only values that are valid, so a crafted link can't inject anything odd.
  const pkg = packages.find(p => p.slug === one('package'));
  const vehicle = vehicles.find(v => v.slug === one('vehicle'));
  const date = one('date');
  const pax = Number(one('passengers'));
  const initial = {
    ...(pkg && { packageSlug: pkg.slug }),
    ...(vehicle && (!pkg || pkg.vehicles.includes(vehicle.slug)) && { vehicle: vehicle.slug }),
    ...(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today && { travelDate: date }),
    ...(Number.isInteger(pax) && pax >= 1 && pax <= 50 && { passengers: String(pax) }),
    ...(one('pickup') && { pickup: one('pickup')!.slice(0, 200) }),
  };

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Home' }, { label: 'Request a booking' }]} title="Request a booking"
        lead="It takes about two minutes. You'll get a booking reference straight away, and we'll confirm availability and the price with you before anything is final." />
      <div className="container booking-layout">
        <BookingForm packages={packages} vehicles={vehicles} initial={initial} today={today} whatsappNumber={links.whatsappNumber} onlinePayment={onlinePayment} />
        <aside aria-label="Help with booking">
          <div className="card aside-card">
            <h2 className="h4">What happens next</h2>
            <ol className="steps-list">
              <li><div><strong>You get a reference</strong><span>Straight away, on screen.</span></div></li>
              {onlinePayment
                ? <li><div><strong>Pay securely online</strong><span>For fixed-price trips: UPI or QR code, debit or credit card, or netbanking. Confirmation arrives on WhatsApp.</span></div></li>
                : <li><div><strong>We confirm with you</strong><span>Availability and final price, by phone or WhatsApp.</span></div></li>}
              <li><div><strong>Driver details</strong><span>Sent before your trip.</span></div></li>
            </ol>
            <hr style={{ border: 0, borderTop: '1px solid var(--border-subtle)', margin: 0 }} />
            <p className="text-sm text-muted">Prefer to talk?</p>
            <a className="btn btn--whatsapp btn--block" href={links.whatsappHref()} target="_blank" rel="noopener"><Icon name="whatsapp" />WhatsApp us</a>
            <a className="btn btn--outline btn--block" href={links.phoneHref}><Icon name="phone" />{links.phoneLabel}</a>
          </div>
        </aside>
      </div>
    </>
  );
}
