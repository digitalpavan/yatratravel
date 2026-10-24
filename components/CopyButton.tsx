'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';

export function CopyButton({ text, label = 'Copy reference' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--outline-inverse btn--sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch { /* clipboard unavailable: the reference is visible to copy by hand */ }
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} />
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}
