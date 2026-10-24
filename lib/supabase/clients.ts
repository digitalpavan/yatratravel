import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to .env.local (see .env.example).`);
  return v;
}
export const supabaseUrl = () => env('NEXT_PUBLIC_SUPABASE_URL');
export const publishableKey = () => env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

/** Session cookies are only ever read on the server, so they can be HttpOnly. */
export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

/**
 * Signed-in user's client for admin pages and server actions. Every query runs as that user,
 * so row-level security applies on top of the app's own role checks.
 */
export async function createUserClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(supabaseUrl(), publishableKey(), {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => store.getAll(),
      setAll(toSet) {
        // Throws when called while rendering a Server Component; proxy.ts refreshes the session in that case.
        try { toSet.forEach(({ name, value, options }) => store.set(name, value, { ...options, ...authCookieOptions })); } catch {}
      },
    },
  });
}

/** Anonymous client for public pages: reads only what RLS allows the public to see. Safe to use inside caches. */
export function createPublicClient(): SupabaseClient {
  return createClient(supabaseUrl(), publishableKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Bypasses RLS. Use only after the caller has been validated: public booking/enquiry inserts, the confirmation page,
 * and admin-only user management.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(supabaseUrl(), env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
}
