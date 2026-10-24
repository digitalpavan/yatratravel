'use client';

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';

export type ActionState = { ok?: string; error?: string; fields?: Record<string, string>; at?: number };

export const PendingContext = createContext(false);

/**
 * Server-action form with a pending state and an inline result message.
 * Submits through a transition rather than the `action` prop, because React resets `action` forms after every
 * submission, which would wipe an admin's edits whenever a save fails validation.
 */
export function ActionForm({ action, children, className = 'stack', resetOnSuccess = false, confirm, id }: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  /** Asks for confirmation first (for destructive or irreversible actions). */
  confirm?: string;
  id?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  return (
    <PendingContext.Provider value={pending}>
      <form
        ref={ref}
        id={id}
        className={className}
        onSubmit={e => {
          e.preventDefault();
          if (pending || (confirm && !window.confirm(confirm))) return;
          const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          startTransition(() => formAction(data));
        }}
      >
        {state.error && (
          <div className="alert alert--error" role="alert"><Icon name="alert" /><div>
            <strong>{state.error}</strong>
            {state.fields && <ul className="error-summary">{Object.entries(state.fields).map(([k, v]) => <li key={k}>{v}</li>)}</ul>}
          </div></div>
        )}
        {state.ok && <div className="alert alert--success" role="status" key={state.at}><Icon name="check-circle" /><div>{state.ok}</div></div>}
        {children}
      </form>
    </PendingContext.Provider>
  );
}

export function SubmitButton({ children, variant = 'secondary', size, name, value }: { children: ReactNode; variant?: string; size?: 'sm'; name?: string; value?: string }) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" name={name} value={value} className={`btn btn--${variant}${size ? ` btn--${size}` : ''}${pending ? ' is-loading' : ''}`} disabled={pending} aria-busy={pending}>
      {children}
    </button>
  );
}
