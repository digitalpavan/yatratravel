'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionState } from '@/components/admin/ActionForm';
import { requireRole } from '@/lib/auth';
import { parseRupees, toPaise } from '@/lib/format';
import { confirmationPath } from '@/lib/server/bookings';
import { emailInvoice, notifyStatusChange } from '@/lib/server/notify';
import { createUserClient } from '@/lib/supabase/clients';

const id = z.uuid();
const done = (ok: string): ActionState => ({ ok, at: Date.now() });

/**
 * The database enforces the workflow (pending → contacted → confirmed → completed; any open state → cancelled),
 * requires an agreed price before confirming, and allows "completed" only from the travel date on.
 * Confirming can carry the agreed price, so both are saved in one step.
 */
export async function updateBookingStatus(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('staff');
  const parsed = z.object({ id, status: z.enum(['contacted', 'confirmed', 'completed', 'cancelled']) }).safeParse({ id: form.get('id'), status: form.get('status') });
  if (!parsed.success) return { error: 'Invalid request.' };
  const { status } = parsed.data;
  const quoted = form.has('quoted') ? parseRupees(String(form.get('quoted'))) : null;
  if (quoted === 'invalid') return { error: 'Check the agreed price: numbers only, for example 11999.' };
  if (status === 'confirmed' && form.has('quoted') && quoted === null) return { error: 'Enter the agreed price to confirm the booking.' };
  const db = await createUserClient();
  const { data: b, error } = await db.from('bookings')
    .update({ status, ...(status === 'confirmed' && quoted !== null && { quoted_price_paise: toPaise(quoted) }) }).eq('id', parsed.data.id)
    .select('id, reference, status, name, email, package_title, travel_date, quoted_price_paise').single();
  // check_violation (23514) messages come from the workflow trigger and are written for staff.
  if (error) return { error: error.code === '23514' ? error.message : 'Could not update the status.' };

  // Customers who gave an email are told straight away; the rest get the WhatsApp message from the booking page.
  const emailed = await notifyStatusChange({ ...b, confirmationPath: confirmationPath(b.reference) });
  if (emailed) await db.from('bookings').update({ customer_notified_status: b.status, customer_notified_at: new Date().toISOString() }).eq('id', parsed.data.id);
  revalidatePath('/admin', 'layout');
  return done(emailed ? `Booking marked ${parsed.data.status}. The customer has been emailed.` : `Booking marked ${parsed.data.status}. Now let the customer know.`);
}

/** Emails the invoice PDF to the customer again (it shows the payments received so far). */
export async function sendInvoice(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('staff');
  const parsed = id.safeParse(form.get('id'));
  if (!parsed.success) return { error: 'Invalid request.' };
  const db = await createUserClient();
  const { data: b } = await db.from('bookings').select('id, reference, name, email, package_title, travel_date').eq('id', parsed.data).maybeSingle();
  if (!b) return { error: 'Booking not found.' };
  const result = await emailInvoice(b);
  if (result === 'no-email') return { error: 'This customer has no email address. Download the invoice and send it on WhatsApp instead.' };
  if (result === 'no-invoice') return { error: 'Invoices are made for confirmed bookings with an agreed price.' };
  if (result === 'failed') return { error: 'The email could not be sent. Check the email settings (RESEND_API_KEY) and try again.' };
  return done(`Invoice emailed to ${b.email}.`);
}

/** Click-to-chat can't confirm a message was sent, so staff record it after sending the update. */
export async function markCustomerNotified(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('staff');
  const parsed = z.object({ id, status: z.enum(['pending', 'contacted', 'confirmed', 'completed', 'cancelled']) }).safeParse({ id: form.get('id'), status: form.get('status') });
  if (!parsed.success) return { error: 'Invalid request.' };
  const db = await createUserClient();
  const { error } = await db.from('bookings').update({ customer_notified_status: parsed.data.status, customer_notified_at: new Date().toISOString() })
    .eq('id', parsed.data.id).eq('status', parsed.data.status);
  if (error) return { error: 'Could not save.' };
  revalidatePath(`/admin/bookings/${parsed.data.id}`);
  return done('Noted: customer updated.');
}

const rupees = z.coerce.number().min(0).max(10_000_000);

/** The agreed price and the payment status. Amounts received are recorded as payments (below), never typed over. */
export async function updatePayment(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('staff');
  const parsed = z.object({
    id,
    payment_status: z.enum(['unpaid', 'pending', 'paid', 'refunded', 'failed']),
    quoted_price_paise: z.union([z.literal(''), rupees]).transform(v => toPaise(v === '' ? null : v)),
  }).safeParse({ id: form.get('id'), payment_status: form.get('payment_status'), quoted_price_paise: form.get('quoted') });
  if (!parsed.success) return { error: 'Check the quoted price: numbers only, without commas.' };
  const { id: bookingId, ...values } = parsed.data;
  const db = await createUserClient();
  const { error } = await db.from('bookings').update(values).eq('id', bookingId);
  if (error) return { error: 'Could not save payment details.' };
  revalidatePath('/admin', 'layout');
  return done('Payment details saved.');
}

/** Adds a payment or refund. The database updates the booking's amount paid and payment status. */
export async function recordPayment(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole('staff');
  const parsed = z.object({
    booking_id: id,
    kind: z.enum(['payment', 'refund']),
    amount_paise: rupees.refine(v => v > 0, 'Enter an amount').transform(v => toPaise(v)!),
    method: z.enum(['cash', 'upi', 'card', 'netbanking', 'wallet', 'bank_transfer', 'other']),
    received_on: z.iso.date(),
    transaction_ref: z.string().trim().max(100),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message === 'Enter an amount' ? 'Enter an amount in rupees.' : 'Check the amount and date.' };
  const db = await createUserClient();
  const { error } = await db.from('payments').insert({ ...parsed.data, recorded_by: user.id });
  if (error) return { error: 'Could not record the payment.' };
  revalidatePath('/admin', 'layout');
  return done(parsed.data.kind === 'refund' ? 'Refund recorded.' : 'Payment recorded.');
}

export async function assignBooking(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('staff');
  const parsed = z.object({ id, assigned_to: z.union([z.literal(''), z.uuid()]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Invalid request.' };
  const db = await createUserClient();
  const { error } = await db.from('bookings').update({ assigned_to: parsed.data.assigned_to || null }).eq('id', parsed.data.id);
  if (error) return { error: 'Could not update the assignment.' };
  revalidatePath(`/admin/bookings/${parsed.data.id}`);
  return done('Assignment updated.');
}

export async function addBookingNote(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole('staff');
  const parsed = z.object({ id, body: z.string().trim().min(1, 'Write a note first').max(2000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await createUserClient();
  const { error } = await db.from('booking_notes').insert({ booking_id: parsed.data.id, body: parsed.data.body, author_id: user.id });
  if (error) return { error: 'Could not save the note.' };
  revalidatePath(`/admin/bookings/${parsed.data.id}`);
  return done('Note added.');
}
