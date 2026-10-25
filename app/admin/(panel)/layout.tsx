import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/styles/admin.css';
import { AdminShell, type AdminNavItem } from '@/components/admin/AdminShell';
import { requireRole } from '@/lib/auth';
import { createUserClient } from '@/lib/supabase/clients';
import { signOut } from '../(auth)/actions';

export const metadata: Metadata = { title: { default: 'Dashboard', template: '%s · Yatra Travels admin' }, robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: ReactNode }) {
  // Pages repeat this check themselves: layouts don't re-render on every navigation.
  const user = await requireRole('staff', { allowPendingPassword: true });

  const supabase = await createUserClient();
  const [pending, fresh] = await Promise.all([
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
  ]);

  const nav: AdminNavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: 'home' },
    { href: '/admin/bookings', label: 'Bookings', icon: 'clipboard', count: pending.count ?? 0 },
    { href: '/admin/enquiries', label: 'Enquiries', icon: 'inbox', count: fresh.count ?? 0 },
    { href: '/admin/vehicles', label: 'Vehicles', icon: 'car', group: 'Catalogue' },
    ...(user.role === 'admin' ? ([
      { href: '/admin/packages', label: 'Packages', icon: 'package', group: 'Catalogue' },
      { href: '/admin/content', label: 'Website content', icon: 'file', group: 'Website' },
      { href: '/admin/blog', label: 'Blog posts', icon: 'edit', group: 'Website' },
      { href: '/admin/users', label: 'Staff & roles', icon: 'users', group: 'Administration' },
      { href: '/admin/audit', label: 'Audit log', icon: 'shield', group: 'Administration' },
    ] as AdminNavItem[]) : []),
  ];

  return (
    <AdminShell nav={nav} user={{ name: user.fullName, email: user.email, role: user.role }} signOut={signOut}>
      {children}
    </AdminShell>
  );
}
