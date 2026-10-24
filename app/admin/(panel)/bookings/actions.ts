'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionState } from '@/components/admin/ActionForm';
import { requireRole } from '@/lib/auth';
import { createUserClient } from '@/lib/supabase/clients';

const id = z.uuid();
const done = (ok: string): ActionState => ({ ok, at: Date.now() });

/** Status moves are also enforced by a database trigger (requested → confirmed → completed; open → cancelled). */
export async function updateBookingStatus(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('staff');
  const parsed = z.object({ id, status: z.enum(['confirmed', 'completed', 'cancelled']) }).safeParse({ id: form.get('id'), status: form.get('status') });
  if (!parsed.success) return { error: 'Invalid request.' };
  const db = await createUserClient();
  const { error } = await db.from('bookings').update({ status: parsed.data.status }).eq('id', parsed.data.id);
  if (error) return { error: error.message.includes('cannot change') ? error.message : 'Could not update the status.' };
  revalidatePath('/admin', 'layout');
  return done(`Booking marked ${parsed.data.status}.`);
}

const money = z.union([z.literal(''), z.coerce.number().min(0).max(10_000_000)]).transform(v => (v === '' ? null : v));

export async function updatePayment(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('staff');
  const parsed = z.object({
    id,
    payment_status: z.enum(['unpaid', 'advance_paid', 'paid', 'refunded', 'not_applicable']),
    amount_quoted: money,
    amount_paid: money,
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Check the amounts: numbers only, without commas.' };
  const { id: bookingId, ...values } = parsed.data;
  const db = await createUserClient();
  const { error } = await db.from('bookings').update(values).eq('id', bookingId);
  if (error) return { error: 'Could not save payment details.' };
  revalidatePath('/admin', 'layout');
  return done('Payment details saved.');
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
