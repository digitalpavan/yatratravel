import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ActionForm, SubmitButton, type ActionState } from '@/components/admin/ActionForm';
import { PageTitle } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { createServiceClient, createUserClient } from '@/lib/supabase/clients';

export const metadata: Metadata = { title: 'My account' };

async function changePassword(_: ActionState, form: FormData): Promise<ActionState> {
  'use server';
  const user = await requireRole('staff', { allowPendingPassword: true });
  const parsed = z.object({
    current: z.string().min(1, 'Enter your current password'),
    password: z.string().min(12, 'Use at least 12 characters').max(128).refine(p => /[A-Za-z]/.test(p) && /\d/.test(p), 'Use letters and numbers'),
    confirm: z.string(),
  }).refine(v => v.password === v.confirm, { path: ['confirm'], message: 'The new passwords do not match' })
    .refine(v => v.password !== v.current, { path: ['password'], message: 'Choose a different password from the current one' })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = await createUserClient();
  // Re-check the current password before changing it, so an unattended signed-in browser can't be used to take over the account.
  const check = await db.auth.signInWithPassword({ email: user.email, password: parsed.data.current });
  if (check.error) return { error: 'Your current password is incorrect.' };
  const { error } = await db.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message.includes('weak') || error.message.includes('Password') ? error.message : 'Could not change your password.' };
  await createServiceClient().from('profiles').update({ must_change_password: false }).eq('id', user.id);
  redirect('/admin?password=1');
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const user = await requireRole('staff', { allowPendingPassword: true });
  const { first } = await searchParams;
  return (
    <>
      <PageTitle title="My account" sub={`${user.email} · ${user.role === 'admin' ? 'Administrator' : 'Staff'}`} />
      {(first || user.mustChangePassword) && <div className="alert alert--info" role="status"><div><strong>Choose your own password to continue.</strong> You signed in with a one-time password.</div></div>}
      <ActionForm action={changePassword} className="card card--pad stack" >
        <h2 className="h4">Change password</h2>
        <div className="field"><label className="label" htmlFor="current">Current password</label><input className="input" id="current" name="current" type="password" autoComplete="current-password" required /></div>
        <div className="field"><label className="label" htmlFor="password">New password</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={12} required /><p className="hint">At least 12 characters, with letters and numbers. A short phrase works well.</p></div>
        <div className="field"><label className="label" htmlFor="confirm">Repeat new password</label><input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" required /></div>
        <div><SubmitButton variant="primary">Change password</SubmitButton></div>
      </ActionForm>
    </>
  );
}
