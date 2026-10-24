import Link from 'next/link';
import { AuthForm } from '@/components/admin/AuthForm';
import { requestPasswordReset } from '../actions';

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="h4">Reset your password</h1>
      <p className="text-sm text-muted">Enter your work email. We'll send a link to set a new password.</p>
      <AuthForm action={requestPasswordReset} submitLabel="Send reset link">
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </div>
      </AuthForm>
      <p className="text-sm text-center"><Link href="/admin/login">Back to sign in</Link></p>
    </>
  );
}
