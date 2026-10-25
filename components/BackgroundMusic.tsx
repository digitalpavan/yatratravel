'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';

const STORAGE_KEY = 'yt-music';
const VOLUME = 0.35;

function savedChoice(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function saveChoice(value: 'on' | 'off') {
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* private mode: the choice lasts for this visit only */ }
}

/**
 * Looping background music with a floating play/pause button. Lives in the site layout, so it keeps playing
 * across page navigations. Browsers block sound until the visitor interacts with the page, so if autoplay is
 * refused it starts on their first tap or key press instead. A visitor who pauses it is remembered and won't hear it again.
 */
export function BackgroundMusic({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || savedChoice() === 'off') return;
    audio.volume = VOLUME;

    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    const stopWaiting = () => events.forEach(e => window.removeEventListener(e, onFirstInteraction));
    function onFirstInteraction(e: Event) {
      stopWaiting();
      // A tap on the music button itself is handled by its own click handler.
      if (buttonRef.current?.contains(e.target as Node)) return;
      audio!.play().catch(() => {});
    }

    // Wait until the page has finished loading, so the music never competes with the first paint.
    const start = () => audio.play().catch(() => events.forEach(e => window.addEventListener(e, onFirstInteraction, { passive: true })));
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => { window.removeEventListener('load', start); stopWaiting(); };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.volume = VOLUME;
      audio.play().catch(() => {});
      saveChoice('on');
    } else {
      audio.pause();
      saveChoice('off');
    }
  };

  if (broken) return null;
  return (
    <>
      <audio ref={audioRef} src={src} loop preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setBroken(true)} />
      <button ref={buttonRef} type="button" className={`fab-music${playing ? ' is-playing' : ''}`} onClick={toggle}
        aria-pressed={playing} aria-label={playing ? 'Pause background music' : 'Play background music'} title={playing ? 'Pause music' : 'Play music'}>
        <Icon name={playing ? 'volume' : 'mute'} size={24} />
      </button>
    </>
  );
}
