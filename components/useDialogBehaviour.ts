'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Modal panel behaviour shared by the site menu and the dashboard menu: moves focus inside when it opens, keeps Tab
 * within it, closes on Escape, locks page scroll (without layout shift), and returns focus to the opener on close.
 */
export function useDialogBehaviour(open: boolean, panelRef: RefObject<HTMLElement | null>, openerRef: RefObject<HTMLElement | null>, close: () => void) {
  // Keep the latest close callback without re-running the effect (which would reset focus) on every render.
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });

  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const body = document.body;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    const focusables = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea') ?? []);
    // The panel is mounted in this same commit; focus on the next frame once it exists.
    const raf = requestAnimationFrame(() => focusables()[0]?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1)!.focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
      else if (!panelRef.current?.contains(document.activeElement)) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      body.style.overflow = '';
      body.style.paddingRight = '';
      opener?.focus();
    };
  }, [open, panelRef, openerRef]);
}
