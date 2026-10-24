import Link from 'next/link';
import type { ReactNode } from 'react';

export const bookingStatusLabel: Record<string, [string, string]> = {
  requested: ['badge--pending', 'Requested'],
  confirmed: ['badge--success', 'Confirmed'],
  completed: ['badge--info', 'Completed'],
  cancelled: ['badge--error', 'Cancelled'],
};
export const paymentStatusLabel: Record<string, [string, string]> = {
  unpaid: ['badge--pending', 'Unpaid'],
  advance_paid: ['badge--info', 'Advance paid'],
  paid: ['badge--success', 'Paid'],
  refunded: ['', 'Refunded'],
  not_applicable: ['', 'N/A'],
};
export const enquiryStatusLabel: Record<string, [string, string]> = {
  new: ['badge--pending', 'New'],
  contacted: ['badge--info', 'Contacted'],
  follow_up: ['badge--gold', 'Follow up'],
  converted: ['badge--success', 'Converted'],
  closed: ['', 'Closed'],
};

export function Badge({ map, value }: { map: Record<string, [string, string]>; value: string }) {
  const [cls, label] = map[value] ?? ['', value];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function PageTitle({ title, sub, actions, back }: { title: string; sub?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="page-title">
      <div>
        {back && <Link className="back-link" href={back.href}>← {back.label}</Link>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return <div className={`alert ${error ? 'alert--error' : 'alert--success'}`} role={error ? 'alert' : 'status'}><div>{error ?? ok}</div></div>;
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (n: number) => string }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(n => n === 1 || n === pages || Math.abs(n - page) <= 2);
  return (
    <nav className="pagination" aria-label="Pagination" style={{ marginTop: 'var(--space-5)' }}>
      {nums.map((n, i) => (
        <span key={n} style={{ display: 'contents' }}>
          {i > 0 && n - nums[i - 1] > 1 && <span aria-hidden="true">…</span>}
          <Link href={href(n)} aria-current={n === page ? 'page' : undefined}>{n}</Link>
        </span>
      ))}
    </nav>
  );
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
}

/** Escapes text for PostgREST `or()` filters so search input can't inject filter syntax. */
export function searchTerm(q: string): string {
  return q.replace(/[,()*%\\:"']/g, ' ').trim().slice(0, 60);
}
