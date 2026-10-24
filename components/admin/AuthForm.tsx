'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';

type State = { error?: string; ok?: string };

export function AuthForm({ action, submitLabel, next, children }: {
  action: (state: State, form: FormData) => Promise<State>; submitLabel: string; next?: string; children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const email = useRef('');

  // React resets the form after every action. Put the email back after a failed attempt so only the password needs
  // retyping (passwords are deliberately left cleared).
  useEffect(() => {
    const input = formRef.current?.querySelector<HTMLInputElement>('input[type=email]');
    if (input && state.error && email.current) {
      input.value = email.current;
      formRef.current?.querySelector<HTMLInputElement>('input[type=password]')?.focus();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="stack"
      noValidate
      onSubmit={e => { email.current = (e.currentTarget.querySelector('input[type=email]') as HTMLInputElement | null)?.value ?? ''; }}
    >
      {state.error && <div className="alert alert--error" role="alert"><Icon name="alert" /><div>{state.error}</div></div>}
      {state.ok && <div className="alert alert--success" role="status"><Icon name="check-circle" /><div>{state.ok}</div></div>}
      {next && <input type="hidden" name="next" value={next} />}
      {children}
      <button type="submit" className={`btn btn--secondary btn--block${pending ? ' is-loading' : ''}`} disabled={pending} aria-busy={pending}>{submitLabel}</button>
    </form>
  );
}
