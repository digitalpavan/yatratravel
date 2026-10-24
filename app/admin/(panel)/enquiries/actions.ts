'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionState } from '@/components/admin/ActionForm';
import { requireRole } from '@/lib/auth';
import { createUserClient } from '@/lib/supabase/clients';

export async function updateEnquiry(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('staff');
  const parsed = z.object({
    id: z.uuid(),
    status: z.enum(['new', 'contacted', 'follow_up', 'converted', 'closed']),
    next_follow_up: z.union([z.literal(''), z.iso.date()]).transform(v => v || null),
    assigned_to: z.union([z.literal(''), z.uuid()]).transform(v => v || null),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Check the follow-up date and try again.' };
  const { id, ...values } = parsed.data;
  const db = await createUserClient();
  const { error } = await db.from('enquiries').update(values).eq('id', id);
  if (error) return { error: 'Could not save the follow-up.' };
  revalidatePath('/admin', 'layout');
  return { ok: 'Follow-up saved.', at: Date.now() };
}

export async function addEnquiryNote(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole('staff');
  const parsed = z.object({ id: z.uuid(), body: z.string().trim().min(1, 'Write a note first').max(2000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await createUserClient();
  const { error } = await db.from('enquiry_notes').insert({ enquiry_id: parsed.data.id, body: parsed.data.body, author_id: user.id });
  if (error) return { error: 'Could not save the note.' };
  revalidatePath(`/admin/enquiries/${parsed.data.id}`);
  return { ok: 'Note added.', at: Date.now() };
}
