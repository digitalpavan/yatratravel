'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createUserClient } from '@/lib/supabase/clients';
import { clientIp, rateLimit } from '@/lib/server/rate-limit';
import { siteUrl } from '@/lib/site';

export type AuthState = { error?: string; ok?: string };

/** Only allow redirects back into the dashboard (prevents open redirects via ?next=). */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = typeof raw === 'string' ? raw : '';
  return next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin';
}

const credentials = z.object({ email: z.email(), password: z.string().min(1).max(200) });

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: String(form.get('email') ?? '').trim().toLowerCase(), password: form.get('password') });
  if (!parsed.success) return { error: 'Enter your email and password.' };

  const ip = clientIp(await headers());
  if (!rateLimit(`login-ip:${ip}`, 10, 15 * 60_000).ok || !rateLimit(`login-email:${parsed.data.email}`, 5, 15 * 60_000).ok) {
    return { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' };
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // Same message for unknown email and wrong password, so accounts can't be discovered.
  if (error || !data.user) return { error: 'Email or password is incorrect.' };

  const { data: profile } = await supabase.from('profiles').select('active').eq('id', data.user.id).maybeSingle();
  if (!profile?.active) {
    await supabase.auth.signOut();
    return { error: 'This account does not have dashboard access. Ask an administrator.' };
  }
  redirect(safeNext(form.get('next')));
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { error: 'Enter a valid email address.' };
  const ip = clientIp(await headers());
  if (!rateLimit(`reset:${ip}`, 5, 60 * 60_000).ok) return { error: 'Too many requests. Please try again later.' };

  const supabase = await createUserClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/admin/auth/confirm?next=/admin/account` });
  // Always the same response, whether or not the email has an account.
  return { ok: 'If that email has dashboard access, a reset link is on its way. It works in this browser only.' };
}

export async function signOut() {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
