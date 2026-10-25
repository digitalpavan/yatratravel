'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionState } from '@/components/admin/ActionForm';
import { requireRole } from '@/lib/auth';
import { createServiceClient, createUserClient } from '@/lib/supabase/clients';

export type UserActionState = ActionState & { password?: string; email?: string };

const tempPassword = () => crypto.randomBytes(15).toString('base64url');

/**
 * Creates a staff account with a one-time password that the admin passes on privately.
 * The person must set their own password at first sign-in. Uses the service client (only it can create auth users),
 * after the admin check, and writes the event to the audit log as the admin.
 */
export async function createStaff(_: UserActionState, form: FormData): Promise<UserActionState> {
  await requireRole('admin');
  const parsed = z.object({
    email: z.email('Enter a valid email').transform(v => v.toLowerCase()),
    full_name: z.string().trim().min(2, 'Enter their name').max(80),
    role: z.enum(['admin', 'staff']),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const service = createServiceClient();
  const password = tempPassword();
  const { data, error } = await service.auth.admin.createUser({ email: parsed.data.email, password, email_confirm: true, user_metadata: { full_name: parsed.data.full_name } });
  if (error || !data.user) return { error: error?.message.includes('already') ? 'An account with this email already exists.' : 'Could not create the account.' };
  const profile = await service.from('profiles').insert({ id: data.user.id, email: parsed.data.email, full_name: parsed.data.full_name, role: parsed.data.role, must_change_password: true });
  if (profile.error) {
    await service.auth.admin.deleteUser(data.user.id);
    return { error: 'Could not create the account.' };
  }
  const db = await createUserClient();
  await db.rpc('log_event', { p_action: 'create_user', p_entity: 'profiles', p_entity_id: data.user.id, p_details: { email: parsed.data.email, role: parsed.data.role } });
  revalidatePath('/admin/users');
  return { ok: 'Account created. Share this one-time password privately (for example, in person or by phone), not by email:', password, email: parsed.data.email, at: Date.now() };
}

/**
 * Name, role and access changes run as the admin, so RLS, the profile guard trigger and the audit trigger all apply.
 * Admins can rename themselves, but not change their own role or access.
 */
export async function updateStaff(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireRole('admin');
  const self = form.get('id') === me.id;
  const parsed = z.object({
    id: z.uuid(),
    full_name: z.string().trim().min(2, 'Enter their name').max(80),
    role: z.enum(['admin', 'staff']).optional(),
    active: z.boolean().optional(),
  }).safeParse({
    id: form.get('id'), full_name: form.get('full_name'),
    ...(!self && { role: form.get('role'), active: form.get('active') === 'on' }),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...values } = parsed.data;
  const db = await createUserClient();
  const { error } = await db.from('profiles').update(values).eq('id', id);
  if (error) return { error: error.message.includes('own role') ? error.message : 'Could not update the account.' };
  revalidatePath('/admin', 'layout');
  return { ok: values.active === false ? 'Saved. Access removed: they can no longer use the dashboard.' : 'Saved.', at: Date.now() };
}

/**
 * Removes a team member. Someone with no activity is deleted outright. Someone who has written notes, been assigned
 * bookings or uploaded images is referenced by that history, so their account is switched off instead: they can't
 * sign in (every request checks `active`), and the records they touched stay intact.
 */
export async function removeStaff(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireRole('admin');
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { error: 'Invalid request.' };
  if (id.data === me.id) return { error: "You can't remove your own account. Ask another administrator." };
  const db = await createUserClient();
  const { data: person } = await db.from('profiles').select('email').eq('id', id.data).maybeSingle();
  if (!person) return { error: 'This account no longer exists.' };

  const { error } = await createServiceClient().auth.admin.deleteUser(id.data);
  if (error) {
    const off = await db.from('profiles').update({ active: false }).eq('id', id.data);
    if (off.error) return { error: 'Could not remove the account.' };
    await db.rpc('log_event', { p_action: 'deactivate_user', p_entity: 'profiles', p_entity_id: id.data, p_details: { email: person.email, reason: 'has history' } });
    revalidatePath('/admin', 'layout');
    return { ok: `${person.email} has activity on record (notes, bookings or uploads), so the account was switched off instead of deleted. They can no longer sign in, and their history is kept.`, at: Date.now() };
  }
  await db.rpc('log_event', { p_action: 'delete_user', p_entity: 'profiles', p_entity_id: id.data, p_details: { email: person.email } });
  revalidatePath('/admin', 'layout');
  return { ok: `${person.email} has been removed.`, at: Date.now() };
}

export async function resetStaffPassword(_: UserActionState, form: FormData): Promise<UserActionState> {
  const me = await requireRole('admin');
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { error: 'Invalid request.' };
  if (id.data === me.id) return { error: 'Change your own password under My account.' };
  const service = createServiceClient();
  const password = tempPassword();
  const { error } = await service.auth.admin.updateUserById(id.data, { password });
  if (error) return { error: 'Could not reset the password.' };
  await service.from('profiles').update({ must_change_password: true }).eq('id', id.data);
  const db = await createUserClient();
  await db.rpc('log_event', { p_action: 'reset_password', p_entity: 'profiles', p_entity_id: id.data, p_details: {} });
  return { ok: 'Password reset. Share this one-time password privately:', password, at: Date.now() };
}
