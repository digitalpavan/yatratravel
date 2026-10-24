import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createUserClient } from '@/lib/supabase/clients';

// Landing point for password-reset (and invite) emails. Supports both the PKCE `code` link and `token_hash` templates.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const rawNext = url.searchParams.get('next') ?? '/admin/account';
  const next = rawNext.startsWith('/admin') && !rawNext.startsWith('//') ? rawNext : '/admin/account';
  const supabase = await createUserClient();

  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error('missing token') };

  const target = url.clone();
  target.search = '';
  if (error) {
    target.pathname = '/admin/login';
    target.searchParams.set('error', 'link');
    return NextResponse.redirect(target);
  }
  target.pathname = next;
  return NextResponse.redirect(target);
}
