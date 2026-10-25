import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/styles/admin.css';
import { LogoMark } from '@/components/Logo';

export const metadata: Metadata = { title: 'Sign in · Yatra Travels admin', robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card card">
        <div className="auth-card__brand"><LogoMark size={64} /><div><strong>Yatra Travels</strong><span>Staff dashboard</span></div></div>
        {children}
      </div>
    </main>
  );
}
