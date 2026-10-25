import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyButton } from '@/components/CopyButton';
import { Icon } from '@/components/Icon';
import { Intro, IntroItem } from '@/components/motion';
import { SuccessIcon } from '@/components/SuccessIcon';
import { getSettings, getVehicles } from '@/lib/data';
import { formatDate, formatPaise } from '@/lib/format';
import { getBookingForCustomer, verifyAccessToken, type BookingStatus } from '@/lib/server/bookings';
import { contactLinks } from '@/lib/site';
import { customerAboutBookingMessage } from '@/lib/whatsapp';

export const metadata: Metadata = {
  title: 'Your booking',
  robots: { index: false, follow: false },
};

// What the customer sees for each status. This private page is where they come back for updates.
const STATUS: Record<BookingStatus, { badge: [string, string]; heading: string; lead: string }> = {
  pending: { badge: ['badge--pending', 'Awaiting confirmation'], heading: 'Booking request received', lead: "Your trip is not confirmed yet. We'll check availability and contact you by phone or WhatsApp to confirm the details and price." },
  contacted: { badge: ['badge--info', 'Checking availability'], heading: "We're on it", lead: "We've been in touch and are checking availability. Your trip is not confirmed until we agree the price with you." },
  confirmed: { badge: ['badge--success', 'Confirmed'], heading: 'Your trip is confirmed', lead: "We'll send the driver's name, number and vehicle before your travel date." },
  completed: { badge: ['badge--info', 'Completed'], heading: 'Thank you for travelling with us', lead: 'Your trip is complete. We hope it went well.' },
  cancelled: { badge: ['badge--error', 'Cancelled'], heading: 'This booking was cancelled', lead: 'Contact us if you have questions or would like to book again.' },
};

type Props = { params: Promise<{ reference: string }>; searchParams: Promise<{ t?: string | string[] }> };

export default async function ConfirmationPage({ params, searchParams }: Props) {
  const { reference } = await params;
  const { t } = await searchParams;
  const token = typeof t === 'string' ? t : undefined;
  const settings = await getSettings();
  const links = contactLinks(settings.contact);

  // Without a valid signed token we show nothing about the booking, and the response is the same whether the
  // reference exists or not, so references can't be guessed or enumerated.
  const booking = verifyAccessToken(reference, token) ? await getBookingForCustomer(reference) : null;
  if (!booking) return <InvalidLink whatsappHref={links.whatsappHref('Hello, I need help with my booking. My reference is ')} />;

  const vehicle = (await getVehicles()).find(v => v.slug === booking.vehicle);
  const firstName = booking.name.split(/\s+/)[0];
  const status = STATUS[booking.status];
  const balance = booking.quoted_price_paise !== null ? Number(booking.quoted_price_paise) - Number(booking.amount_paid_paise) : null;

  return (
    <div className="container container--narrow confirm">
      {/* Success-state reveal: the badge pops in, then the heading and next steps follow. */}
      <Intro className="confirm-hero">
        <SuccessIcon />
        <IntroItem as="h1">{status.heading}</IntroItem>
        <IntroItem as="p" className="lead">Thank you, {firstName}. {status.lead}</IntroItem>
      </Intro>

      <section className="ref" aria-labelledby="ref-label">
        <span className="ref__label" id="ref-label">Your booking reference</span>
        <span className="ref__code">{booking.reference}</span>
        <CopyButton text={booking.reference} />
        <p>Please keep this reference and quote it whenever you contact us. Bookmark this page to come back to it; the link is private to you.</p>
      </section>

      <section className="card card--pad" aria-labelledby="details-title">
        <div className="flex justify-between items-center gap-3 flex-wrap" style={{ marginBottom: 'var(--space-5)' }}>
          <h2 id="details-title" className="h4">Your request</h2>
          <span className={`badge ${status.badge[0]}`}>{status.badge[1]}</span>
        </div>
        <dl className="details-list">
          <div><dt>Package</dt><dd>{booking.package_title}</dd></div>
          <div><dt>Travel date</dt><dd>{formatDate(booking.travel_date)}</dd></div>
          <div><dt>Travellers</dt><dd>{booking.passengers}</dd></div>
          <div><dt>Vehicle</dt><dd>{vehicle?.name ?? 'We will suggest one'}</dd></div>
          {(booking.status === 'confirmed' || booking.status === 'completed') && booking.quoted_price_paise !== null && <>
            <div><dt>Agreed price</dt><dd>{formatPaise(booking.quoted_price_paise)}</dd></div>
            <div><dt>Paid</dt><dd>{formatPaise(booking.amount_paid_paise)}{balance !== null && balance > 0 && <> · {formatPaise(balance)} due</>}</dd></div>
          </>}
        </dl>
      </section>

      {(booking.status === 'pending' || booking.status === 'contacted') && <section className="card card--pad" aria-labelledby="next-title">
        <h2 id="next-title" className="h4" style={{ marginBottom: 'var(--space-5)' }}>Next steps</h2>
        <ol className="steps-list">
          <li><div><strong>We review your request</strong><span>We check vehicle availability for your date.</span></div></li>
          <li><div><strong>We contact you to confirm</strong><span>By phone or WhatsApp, with the final price and pickup time. Your trip is confirmed only after this.</span></div></li>
          <li><div><strong>Driver details before the trip</strong><span>The driver's name, number and vehicle are sent to you before your travel date.</span></div></li>
        </ol>
      </section>}

      <div className="grid grid--2">
        <a className="btn btn--whatsapp btn--lg" href={links.whatsappHref(customerAboutBookingMessage(booking))} target="_blank" rel="noopener"><Icon name="whatsapp" />Message us on WhatsApp</a>
        <a className="btn btn--outline btn--lg" href={links.phoneHref}><Icon name="phone" />Call {links.phoneLabel}</a>
      </div>
      <p className="text-center text-sm text-muted-page">
        {settings.contact.email && <>Email <a href={`mailto:${settings.contact.email}?subject=${encodeURIComponent(booking.reference)}`}>{settings.contact.email}</a> · </>}
        <Link href="/">Back to home</Link>
      </p>
    </div>
  );
}

function InvalidLink({ whatsappHref }: { whatsappHref: string }) {
  return (
    <div className="container container--narrow section">
      <div className="empty-state">
        <span className="empty-state__icon"><Icon name="alert" size={28} /></span>
        <h1 className="h4">We couldn't open this booking</h1>
        <p>The link may be incomplete or out of date. For your privacy, booking details are only shown through the private link you received after booking.</p>
        <p>Need help? Contact us with your booking reference.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a className="btn btn--whatsapp" href={whatsappHref} target="_blank" rel="noopener"><Icon name="whatsapp" />WhatsApp us</a>
          <Link className="btn btn--outline" href="/contact">Contact page</Link>
        </div>
      </div>
    </div>
  );
}
