import 'server-only';
import crypto from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/clients';
import type { Booking, Enquiry } from '@/lib/validation';
import { DEMO } from '@/lib/demo-data';

// Demo-data mode only: bookings live in memory so the booking flow can be tried without a database.
// Kept on globalThis: route handlers and pages can load separate copies of this module.
const g = globalThis as unknown as { __yatraDemoBookings?: Map<string, PublicBooking & { key: string }> };
const demoBookings = (g.__yatraDemoBookings ??= new Map());

// ---------- Booking reference ----------
// YT-YYMMDD-XXXX: short enough to read over the phone; no 0/O, 1/I/L. The reference alone never grants access.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERENCE_PATTERN = /^YT-\d{6}-[A-HJKMNP-Z2-9]{4}$/;

function newReference(): string {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: '2-digit', month: '2-digit', day: '2-digit' })
    .format(new Date())
    .replace(/-/g, '');
  const code = Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
  return `YT-${ymd}-${code}`;
}

// ---------- Access token ----------
// The confirmation link carries an HMAC of the reference: unguessable, not stored, and the same on a retried submission.
function secret(): string {
  const s = process.env.BOOKING_TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error('BOOKING_TOKEN_SECRET must be set (at least 32 characters). Generate one with: openssl rand -hex 32');
  return s;
}

export function accessToken(reference: string): string {
  return crypto.createHmac('sha256', secret()).update(`booking:${reference}`).digest('base64url');
}

export function verifyAccessToken(reference: string, token: string | undefined): boolean {
  if (!token || !REFERENCE_PATTERN.test(reference)) return false;
  const expected = Buffer.from(accessToken(reference));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function confirmationPath(reference: string): string {
  return `/booking-confirmation/${reference}?t=${accessToken(reference)}`;
}

// ---------- Bookings ----------
export type PublicBooking = {
  reference: string;
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled';
  name: string;
  package_title: string;
  travel_date: string;
  passengers: number;
  vehicle: string;
};

const UNIQUE_VIOLATION = '23505';

/**
 * Stores a booking request with status "requested". It is never auto-confirmed; staff confirm it in the dashboard.
 * The same idempotency key always returns the original reference, so double clicks or retries can't create duplicates.
 * Uses the service client: the public role has no access to the bookings table, and input was validated by the caller.
 */
export async function createBooking(input: Booking, packageTitle: string): Promise<{ reference: string; duplicate: boolean }> {
  if (DEMO) {
    const existing = [...demoBookings.values()].find(b => b.key === input.idempotencyKey);
    if (existing) return { reference: existing.reference, duplicate: true };
    const reference = newReference();
    demoBookings.set(reference, { key: input.idempotencyKey, reference, status: 'requested', name: input.name, package_title: packageTitle, travel_date: input.travelDate, passengers: input.passengers, vehicle: input.vehicle });
    return { reference, duplicate: false };
  }
  const db = createServiceClient();
  const existing = await db.from('bookings').select('reference').eq('idempotency_key', input.idempotencyKey).maybeSingle();
  if (existing.data) return { reference: existing.data.reference, duplicate: true };

  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = newReference();
    const { error } = await db.from('bookings').insert({
      reference,
      idempotency_key: input.idempotencyKey,
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      package_slug: input.packageSlug,
      package_title: packageTitle,
      travel_date: input.travelDate,
      passengers: input.passengers,
      pickup: input.pickup,
      vehicle: input.vehicle,
      requests: input.requests || null,
      consent_at: new Date().toISOString(),
    });
    if (!error) return { reference, duplicate: false };
    if (error.code === UNIQUE_VIOLATION && error.message.includes('idempotency_key')) {
      const row = await db.from('bookings').select('reference').eq('idempotency_key', input.idempotencyKey).single();
      return { reference: row.data!.reference, duplicate: true };
    }
    if (error.code === UNIQUE_VIOLATION) continue; // reference collision: try another code
    throw new Error(error.message);
  }
  throw new Error('Could not allocate a booking reference');
}

/** Only called after verifyAccessToken has passed. Returns the minimum needed for the confirmation page. */
export async function getBookingForCustomer(reference: string): Promise<PublicBooking | null> {
  if (!REFERENCE_PATTERN.test(reference)) return null;
  if (DEMO) return demoBookings.get(reference) ?? null;
  const { data } = await createServiceClient()
    .from('bookings')
    .select('reference, status, name, package_title, travel_date, passengers, vehicle')
    .eq('reference', reference)
    .maybeSingle();
  return (data as PublicBooking | null) ?? null;
}

// ---------- Enquiries ----------
export async function createEnquiry(input: Enquiry): Promise<{ duplicate: boolean }> {
  if (DEMO) return { duplicate: false };
  const { error } = await createServiceClient().from('enquiries').insert({
    idempotency_key: input.idempotencyKey,
    source: input.source,
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    package_slug: input.packageSlug ?? null,
    travel_date: input.travelDate ?? null,
    message: input.message,
    consent_at: new Date().toISOString(),
  });
  if (!error) return { duplicate: false };
  if (error.code === UNIQUE_VIOLATION) return { duplicate: true };
  throw new Error(error.message);
}
