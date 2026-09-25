import { useEffect, useState } from 'react';
import { isTelegramMiniApp } from './telegram';

/** Chrome/Android's install prompt event (not in the TS DOM lib). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** Call once on startup: the event fires early, before React renders. */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    for (const l of listeners) l();
  });
}

const DISMISS_KEY = 'cathub.installDismissed';

export type InstallMode = 'none' | 'prompt' | 'ios';

function detect(): InstallMode {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone || isTelegramMiniApp()) return 'none';
  try {
    if (localStorage.getItem(DISMISS_KEY)) return 'none';
  } catch {
    /* ignore */
  }
  if (deferred) return 'prompt';
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|YaBrowser/.test(ua);
  return iOS && safari ? 'ios' : 'none';
}

export function useInstall() {
  const [mode, setMode] = useState<InstallMode>(detect);
  useEffect(() => {
    const update = () => setMode(detect());
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return {
    mode,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice.catch(() => null);
      deferred = null;
      setMode(detect());
    },
    dismiss: () => {
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* ignore */
      }
      setMode('none');
    },
  };
}
