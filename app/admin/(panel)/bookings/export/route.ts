import { NextResponse, type NextRequest } from 'next/server';
import { searchTerm } from '@/components/admin/ui';
import { checkRole } from '@/lib/auth';
import { createUserClient } from '@/lib/supabase/clients';
import { todayInIndia, toRupees } from '@/lib/format';

// Admin-only CSV export of bookings, using the same filters as the list. Every export is written to the audit log.
export async function GET(request: NextRequest) {
  const auth = await checkRole('admin');
  if ('status' in auth) return new NextResponse(auth.status === 401 ? 'Sign in required' : 'Administrators only', { status: auth.status });

  const sp = request.nextUrl.searchParams;
  const q = searchTerm(sp.get('q') ?? '');
  const status = sp.get('status') ?? '';
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  const db = await createUserClient();

  let query = db.from('bookings').select('reference, status, payment_status, quoted_price_paise, amount_paid_paise, name, phone, email, package_title, travel_date, passengers, pickup, vehicle, created_at');
  if (q) query = query.or(`reference.ilike.*${q}*,name.ilike.*${q}*,phone.ilike.*${q}*`);
  if (['pending', 'contacted', 'confirmed', 'completed', 'cancelled'].includes(status)) query = query.eq('status', status);
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte('travel_date', from);
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lte('travel_date', to);
  const { data, error } = await query.order('travel_date').limit(5000);
  if (error) return new NextResponse('Export failed', { status: 500 });

  await db.rpc('log_event', { p_action: 'export', p_entity: 'bookings', p_entity_id: null, p_details: { rows: data.length, filters: { q, status, from, to } } });

  // Amounts go out in rupees, the unit people expect in a spreadsheet.
  const rows = data.map(({ quoted_price_paise, amount_paid_paise, ...r }) => {
    const { reference, status, payment_status, ...rest } = r;
    return { reference, status, payment_status, quoted_inr: toRupees(quoted_price_paise), paid_inr: toRupees(amount_paid_paise), ...rest };
  });
  const columns = Object.keys(rows[0] ?? { reference: '' });
  // Quote every cell; neutralise spreadsheet formulas (=, +, -, @) so the file is safe to open in Excel.
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [columns.map(cell).join(','), ...rows.map(r => columns.map(c => cell((r as Record<string, unknown>)[c])).join(','))].join('\r\n');

  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="yatra-bookings-${todayInIndia()}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
