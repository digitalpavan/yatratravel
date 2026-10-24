'use client';

import { startTransition, useActionState, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { PendingContext } from '@/components/admin/ActionForm';

type State = { ok?: string; error?: string; password?: string; email?: string };

/** Like ActionForm, but shows a one-time password returned by the action (shown once, never stored in the page). */
export function PasswordResultForm({ action, children, className = 'stack', confirm }: {
  action: (s: State, f: FormData) => Promise<State>; children: ReactNode; className?: string; confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <PendingContext.Provider value={pending}>
      <form className={className} onSubmit={e => {
        e.preventDefault();
        if (pending || (confirm && !window.confirm(confirm))) return;
        const form = e.currentTarget;
        const data = new FormData(form);
        startTransition(async () => { await formAction(data); });
        if (!confirm) form.reset(); // clear the "add person" fields; the result stays visible below
      }}>
        {state.error && <div className="alert alert--error" role="alert"><Icon name="alert" /><div>{state.error}</div></div>}
        {state.ok && (
          <div className="alert alert--success" role="status"><Icon name="check-circle" /><div>
            <strong>{state.ok}</strong>
            {state.password && <p className="one-time">{state.email && <>{state.email}<br /></>}<code>{state.password}</code></p>}
            {state.password && <p className="text-sm">This password won't be shown again. They'll be asked to choose their own when they sign in.</p>}
          </div></div>
        )}
        {children}
      </form>
    </PendingContext.Provider>
  );
}
