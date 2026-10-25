import type { Contact } from '@/lib/data';
import { businessWhatsappNumber, waLink } from '@/lib/whatsapp';

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

// The business number, used whenever the contact settings don't give one (e.g. while a settings cache refreshes).
const BUSINESS_NUMBER = '919490996614';
const BUSINESS_NUMBER_DISPLAY = '+91 94909 96614';

/** Contact links built from the contact settings managed in /admin/content (WhatsApp: env first, see lib/whatsapp.ts). Server only. */
export function contactLinks(contact: Pick<Contact, 'phone' | 'phoneDisplay' | 'whatsapp'>) {
  const whatsappNumber = businessWhatsappNumber(contact.whatsapp) ?? BUSINESS_NUMBER;
  return {
    whatsappNumber,
    whatsappHref: (message = 'Hello Yatra Travels, I would like to enquire about a trip.') => waLink(whatsappNumber, message),
    phoneHref: `tel:+${contact.phone ?? BUSINESS_NUMBER}`,
    phoneLabel: contact.phoneDisplay ?? BUSINESS_NUMBER_DISPLAY,
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
