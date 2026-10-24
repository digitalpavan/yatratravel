import Link from 'next/link';
import { AuthForm } from '@/components/admin/AuthForm';
import { signIn } from '../actions';

type Props = { searchParams: Promise<{ next?: string; reset?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, reset, error } = await searchParams;
  return (
    <>
      <h1 className="h4">Sign in</h1>
      {reset && <p className="alert alert--success" role="status">Password updated. Please sign in again.</p>}
      {error === 'link' && <p className="alert alert--error" role="alert">That link has expired or was already used. Request a new one.</p>}
      <AuthForm action={signIn} submitLabel="Sign in" next={next}>
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
      </AuthForm>
      <p className="text-sm text-center"><Link href="/admin/forgot-password">Forgotten your password?</Link></p>
    </>
  );
}
