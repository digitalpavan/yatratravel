import type { Contact } from '@/lib/data';

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

// Placeholder keeps links working in preview builds; the PreviewBanner flags it until the brand is marked verified.
const PLACEHOLDER_NUMBER = '910000000000';

/** Contact links built from the contact settings managed in /admin/content. */
export function contactLinks(contact: Pick<Contact, 'phone' | 'phoneDisplay' | 'whatsapp'>) {
  const whatsappNumber = contact.whatsapp ?? PLACEHOLDER_NUMBER;
  return {
    whatsappNumber,
    whatsappHref: (message = 'Hello Yatra Travels, I would like to enquire about a trip.') =>
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
    phoneHref: `tel:+${contact.phone ?? PLACEHOLDER_NUMBER}`,
    phoneLabel: contact.phoneDisplay ?? '+91 00000 00000',
  };
}
export type ContactLinks = ReturnType<typeof contactLinks>;

export const nav = [
  { href: '/', label: 'Home' },
  { href: '/packages', label: 'Packages' },
  { href: '/tirupati-darshan', label: 'Tirupati Darshan' },
  { href: '/vehicles', label: 'Vehicles' },
  { href: '/blog', label: 'Travel Guides' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;
