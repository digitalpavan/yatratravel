import { z } from 'zod';
import { todayInIndia } from '@/lib/format';

// Shared by the browser (instant feedback) and the API routes (the real check).
// Checks that need the database (package, vehicle capacity, current price) run on the server in lib/server/bookings.ts.

/** Accepts 98765 43210, +91 98765 43210, 098765-43210 → 9876543210 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

const name = z.string().trim().min(2, 'Enter your name').max(80, 'Name is too long');
const phone = z
  .string()
  .trim()
  .min(1, 'Enter your mobile number')
  .transform(normalisePhone)
  .refine(v => /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number');
const email = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform(v => v || undefined)
  .refine(v => !v || z.email().safeParse(v).success, 'Enter a valid email address, or leave it blank');
const travelDate = z
  .string()
  .min(1, 'Choose a travel date')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a travel date')
  .refine(v => v >= todayInIndia(), 'Choose today or a later date')
  .refine(v => v <= addDays(todayInIndia(), 365), 'We take requests up to one year ahead');
const consent = z.literal(true, { error: 'Please agree so we can contact you about this request' });
const idempotencyKey = z.uuid();
// Honeypot: real visitors never see or fill this field.
const website = z.string().max(0, 'Your request could not be sent. Please contact us on WhatsApp.').optional();

export const bookingSchema = z
  .object({
    name,
    phone,
    email,
    packageSlug: z.string().min(1, 'Choose a package or service'),
    travelDate,
    passengers: z.coerce.number({ error: 'Enter the number of travellers' }).int().min(1, 'At least 1 traveller').max(50, 'For more than 50 travellers, please contact us'),
    pickup: z.string().trim().min(3, 'Enter a pickup point').max(200),
    vehicle: z.string().min(1, 'Choose a vehicle, or "Suggest for me"'),
    requests: z.string().trim().max(1000, 'Please keep this under 1000 characters').optional(),
    // The price the form showed for this package and vehicle (null = on request). The server compares it with the live price.
    listedPricePaise: z.number().int().min(0).nullable().optional(),
    consent,
    idempotencyKey,
    website,
  });

export function capacityError(vehicle: { name: string; passengers: number } | undefined, passengers: number): string | null {
  return vehicle && passengers > vehicle.passengers ? `The ${vehicle.name} seats up to ${vehicle.passengers}. Choose a larger vehicle or "Suggest for me".` : null;
}

export function groupSizeError(pkg: { passengers: { min: number; max: number } } | undefined, passengers: number): string | null {
  if (!pkg) return null;
  if (passengers < pkg.passengers.min) return `This package is for at least ${pkg.passengers.min} travellers`;
  if (passengers > pkg.passengers.max) return `This package takes up to ${pkg.passengers.max} travellers. For a larger group, contact us`;
  return null;
}

export type BookingInput = z.input<typeof bookingSchema>;
export type Booking = z.output<typeof bookingSchema>;

export const enquirySchema = z.object({
  name,
  phone,
  email,
  message: z.string().trim().min(5, 'Tell us a little about your trip').max(1500, 'Please keep this under 1500 characters'),
  packageSlug: z.string().max(80).optional(),
  travelDate: z.union([z.literal(''), travelDate]).optional().transform(v => v || undefined),
  source: z.enum(['contact', 'package', 'darshan', 'vehicles']),
  consent,
  idempotencyKey,
  website,
});
export type EnquiryInput = z.input<typeof enquirySchema>;
export type Enquiry = z.output<typeof enquirySchema>;

/** Flattens zod issues into { field: firstMessage } for the form UI. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
