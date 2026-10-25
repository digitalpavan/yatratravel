import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ActionForm, SubmitButton, type ActionState } from '@/components/admin/ActionForm';
import { AvatarPicker } from '@/components/admin/AvatarPicker';
import { PageTitle, formatDateTime } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { createServiceClient, createUserClient } from '@/lib/supabase/clients';
import { removeAvatar, updateProfile, uploadAvatar } from './actions';

export const metadata: Metadata = { title: 'Settings' };

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
  const { data: auth } = await (await createUserClient()).auth.getUser();
  const lastSignIn = auth.user?.last_sign_in_at;

  const passwordForm = (
    <ActionForm action={changePassword} className="card card--pad stack">
      <h2 className="h4">Change password</h2>
      <div className="field"><label className="label" htmlFor="current">Current password</label><input className="input" id="current" name="current" type="password" autoComplete="current-password" required /></div>
      <div className="field"><label className="label" htmlFor="password">New password</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={12} required /><p className="hint">At least 12 characters, with letters and numbers. A short phrase works well.</p></div>
      <div className="field"><label className="label" htmlFor="confirm">Repeat new password</label><input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" required /></div>
      <div><SubmitButton variant="primary">Change password</SubmitButton></div>
    </ActionForm>
  );

  // Until a one-time password is replaced, the password is the only thing on this page.
  if (first || user.mustChangePassword) {
    return (
      <>
        <PageTitle title="Settings" sub={user.email} />
        <div className="alert alert--info" role="status"><div><strong>Choose your own password to continue.</strong> You signed in with a one-time password.</div></div>
        {passwordForm}
      </>
    );
  }

  return (
    <>
      <PageTitle title="Settings" sub="Your profile photo, contact details and password" />
      <div className="admin-grid">
        <div className="stack-lg">
          <ActionForm action={updateProfile} className="card card--pad stack">
            <h2 className="h4">Profile details</h2>
            <div className="field"><label className="label" htmlFor="full_name">Full name</label><input className="input" id="full_name" name="full_name" defaultValue={user.fullName} autoComplete="name" required minLength={2} maxLength={80} /></div>
            <div className="field"><label className="label" htmlFor="job_title">Job title <span className="text-muted">(optional)</span></label><input className="input" id="job_title" name="job_title" defaultValue={user.jobTitle} maxLength={60} placeholder="For example, Booking desk" /></div>
            <div className="field"><label className="label" htmlFor="phone">Phone <span className="text-muted">(optional)</span></label><input className="input" id="phone" name="phone" type="tel" defaultValue={user.phone} autoComplete="tel" maxLength={20} placeholder="+91 98765 43210" /><p className="hint">So teammates can reach you about a booking. Not shown on the website.</p></div>
            <div><SubmitButton variant="primary">Save details</SubmitButton></div>
          </ActionForm>

          <section className="card card--pad stack" aria-labelledby="photo-title">
            <h2 id="photo-title" className="h4">Profile photo</h2>
            <ActionForm action={uploadAvatar} className="stack" resetOnSuccess>
              <AvatarPicker current={user.avatarUrl} name={user.fullName} email={user.email} />
              <div><SubmitButton variant="primary">Upload photo</SubmitButton></div>
            </ActionForm>
            {user.avatarUrl && (
              <ActionForm action={removeAvatar} className="" confirm="Remove your profile photo?">
                <SubmitButton variant="ghost" size="sm">Remove photo</SubmitButton>
              </ActionForm>
            )}
          </section>

          {passwordForm}
        </div>

        <section className="card card--pad" aria-labelledby="account-title">
          <h2 id="account-title" className="h4">Account details</h2>
          <dl className="details-list details-list--single mt-4">
            <div><dt>Sign-in email</dt><dd>{user.email}</dd></div>
            <div><dt>Role</dt><dd>{user.role === 'admin' ? 'Administrator' : 'Staff'}</dd></div>
            <div><dt>Member since</dt><dd>{formatDateTime(user.createdAt)}</dd></div>
            {lastSignIn && <div><dt>Last signed in</dt><dd>{formatDateTime(lastSignIn)}</dd></div>}
          </dl>
          <p className="hint mt-4">To change your sign-in email or role, ask an administrator.</p>
        </section>
      </div>
    </>
  );
}
