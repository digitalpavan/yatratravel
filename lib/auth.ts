import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createUserClient } from '@/lib/supabase/clients';

export type Role = 'admin' | 'staff';
export type StaffUser = { id: string; email: string; fullName: string; role: Role; mustChangePassword: boolean };

/**
 * The signed-in staff member, verified on the server: the JWT is validated with Supabase and the role is read
 * fresh from the profiles table, so deactivating someone or changing their role takes effect on their next request.
 * Cached per request.
 */
export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase.from('profiles').select('id, email, full_name, role, active, must_change_password').eq('id', userId).maybeSingle();
  if (!profile || !profile.active) return null;
  return { id: profile.id, email: profile.email, fullName: profile.full_name, role: profile.role, mustChangePassword: profile.must_change_password };
});

/**
 * Use at the top of every admin page and server action. Never rely on hidden links alone.
 * Accounts still on a one-time password are sent to set their own first (except on the account page itself).
 */
export async function requireRole(role: Role = 'staff', opts: { allowPendingPassword?: boolean } = {}): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) redirect('/admin/login');
  if (user.mustChangePassword && !opts.allowPendingPassword) redirect('/admin/account?first=1');
  if (role === 'admin' && user.role !== 'admin') redirect('/admin?denied=1');
  return user;
}

/** Variant for route handlers, which return a status instead of redirecting. */
export async function checkRole(role: Role = 'staff'): Promise<{ user: StaffUser } | { status: 401 | 403 }> {
  const user = await getStaffUser();
  if (!user || user.mustChangePassword) return { status: 401 };
  if (role === 'admin' && user.role !== 'admin') return { status: 403 };
  return { user };
}
