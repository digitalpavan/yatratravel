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

/** Role and access changes run as the admin, so RLS, the profile guard trigger and the audit trigger all apply. */
export async function updateStaff(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireRole('admin');
  const parsed = z.object({ id: z.uuid(), role: z.enum(['admin', 'staff']), active: z.boolean() })
    .safeParse({ id: form.get('id'), role: form.get('role'), active: form.get('active') === 'on' });
  if (!parsed.success) return { error: 'Invalid request.' };
  if (parsed.data.id === me.id) return { error: "You can't change your own role or access. Ask another administrator." };
  const db = await createUserClient();
  const { error } = await db.from('profiles').update({ role: parsed.data.role, active: parsed.data.active }).eq('id', parsed.data.id);
  if (error) return { error: error.message.includes('own role') ? error.message : 'Could not update the account.' };
  if (!parsed.data.active) await createServiceClient().auth.admin.signOut(parsed.data.id).catch(() => {});
  revalidatePath('/admin/users');
  return { ok: parsed.data.active ? 'Access updated.' : 'Access removed. They can no longer use the dashboard.', at: Date.now() };
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
