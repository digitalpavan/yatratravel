'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { LogoMark } from '@/components/Logo';
import { Avatar } from '@/components/admin/AvatarPicker';
import { useDialogBehaviour } from '@/components/useDialogBehaviour';
import { motionTokens, transition } from '@/lib/motion';

export type AdminNavItem = { href: string; label: string; icon: IconName; count?: number; group?: string };

/** Layout chrome only. Which items appear is decided on the server by role, and every page re-checks access itself. */
export function AdminShell({ nav, user, signOut, children }: {
  nav: AdminNavItem[]; user: { name: string; email: string; role: string; avatarUrl: string }; signOut: () => Promise<void>; children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useDialogBehaviour(open, drawerRef, toggleRef, () => setOpen(false));

  const isCurrent = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  const navList = (animated: boolean) => (
    <ul className="admin-nav">
      {nav.map((item, i) => {
        const content = (
          <>
            {item.group && item.group !== nav[i - 1]?.group && <span className="admin-nav__group">{item.group}</span>}
            <Link href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}>
              <Icon name={item.icon} />{item.label}
              {!!item.count && <span className="count" aria-label={`${item.count} need attention`}>{item.count}</span>}
            </Link>
          </>
        );
        return animated
          ? <m.li key={item.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={transition(motionTokens.normal, 0.1 + i * 0.03)}>{content}</m.li>
          : <li key={item.href}>{content}</li>;
      })}
    </ul>
  );

  return (
    <div className="admin">
      <a className="skip-link" href="#admin-main">Skip to main content</a>
      <aside className="admin-sidebar" aria-label="Dashboard">
        <Link className="logo" href="/admin"><LogoMark size={48} /><span className="logo__text">Yatra Travels<small>Dashboard</small></span></Link>
        <nav aria-label="Dashboard sections">{navList(false)}</nav>
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <m.div key="backdrop" className="drawer-backdrop is-open" aria-hidden="true" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <m.div key="drawer" ref={drawerRef} className="drawer drawer--left admin-drawer is-open" role="dialog" aria-modal="true" aria-label="Dashboard menu" id="admin-drawer"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={transition(motionTokens.slow)}>
              <div className="drawer__head">
                <span className="logo"><span className="logo__text">Yatra Travels<small>Dashboard</small></span></span>
                <button className="icon-btn" type="button" aria-label="Close menu" onClick={() => setOpen(false)}><Icon name="close" size={24} /></button>
              </div>
              <nav className="drawer__nav" aria-label="Dashboard sections (mobile)">{navList(true)}</nav>
            </m.div>
          </>
        )}
      </AnimatePresence>

      <div className="admin-main">
        <header className="admin-topbar">
          <button ref={toggleRef} className="icon-btn nav-toggle" type="button" aria-controls="admin-drawer" aria-expanded={open} aria-label="Open menu" onClick={() => setOpen(true)}><Icon name="menu" size={24} /></button>
          <form className="search" role="search" action="/admin/bookings">
            <label className="visually-hidden" htmlFor="admin-search">Search bookings by reference, name or phone</label>
            <input className="input" id="admin-search" name="q" type="search" placeholder="Search bookings: reference, name or phone" />
          </form>
          <div className="topbar-actions">
            <Link className="btn btn--ghost btn--sm" href="/" target="_blank">View site</Link>
            <Link className="avatar-link" href="/admin/account" title={`${user.email} (${user.role})`} aria-label={`Settings: ${user.email}, ${user.role}`}><Avatar src={user.avatarUrl} name={user.name} email={user.email} /></Link>
            <form action={signOut}><button className="btn btn--ghost btn--sm" type="submit"><Icon name="logout" />Sign out</button></form>
          </div>
        </header>
        <main id="admin-main" className="admin-content">{children}</main>
      </div>
    </div>
  );
}
