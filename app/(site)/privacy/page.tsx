import type { Metadata } from 'next';
import { PageHero, Pending } from '@/components/ui';
import { getSettings } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Yatra Travels collects, uses and protects the personal details you share when you request a booking or send an enquiry.',
  alternates: { canonical: '/privacy' },
};

// Draft in plain language. Have it reviewed against the Digital Personal Data Protection Act, 2023 before launch.
export default async function PrivacyPage() {
  const { brand, contact } = await getSettings();
  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Home' }, { label: 'Privacy policy' }]} title="Privacy policy" />
      <div className="container section">
        <div className="prose">
          {!brand.verified && <p><Pending>Draft: to be reviewed before launch</Pending></p>}
          <h2>What we collect</h2>
          <p>When you request a booking or send an enquiry, we collect your name, mobile number, email address (required for bookings, so we can send your confirmation and invoice; optional for enquiries), travel date, number of travellers, pickup location, vehicle preference and any notes you add.</p>
          <h2>Why we use it</h2>
          <ul>
            <li>To check availability, confirm your trip and price, and arrange your driver and vehicle.</li>
            <li>To contact you about your request by phone, WhatsApp or email.</li>
            <li>To keep a record of bookings for accounts and to resolve any problems.</li>
          </ul>
          <p>We don't sell your details or use them for marketing without your separate consent.</p>
          <h2>Who we share it with</h2>
          <p>Only the driver assigned to your trip receives the details needed for pickup (your name, number, pickup point and time). Our website host and messaging providers process data on our behalf.</p>
          <h2>How long we keep it</h2>
          <p>Booking records are kept for as long as needed for the trip and for legal and accounting requirements, then deleted. <Pending>Retention period to be confirmed</Pending></p>
          <h2>Your choices</h2>
          <p>You can ask us to see, correct or delete your details, or withdraw your consent, by contacting us{contact.email ? <> at <a href={`mailto:${contact.email}`}>{contact.email}</a></> : null}. Withdrawing consent doesn't affect anything we did before you asked.</p>
          <h2>Security</h2>
          <p>Booking pages are only shown through a private link, and access to booking records is limited to our staff.</p>
        </div>
      </div>
    </>
  );
}
