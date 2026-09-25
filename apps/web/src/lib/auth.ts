import { useSyncExternalStore } from 'react';
import { pb } from './pb';
import type { User } from './types';

// pb.authStore.record re-parses localStorage on every access and returns a new object,
// so keep a stable snapshot for useSyncExternalStore and refresh it on auth changes.
let snapshot: User | null = read();
const listeners = new Set<() => void>();

function read(): User | null {
  return pb.authStore.isValid ? (pb.authStore.record as User | null) : null;
}

pb.authStore.onChange(() => {
  snapshot = read();
  for (const l of listeners) l();
});

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Current user record (or null), re-rendering on login/logout/refresh. */
export function useUser(): User | null {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/** Reloads the auth record (e.g. after joining a household on the server). */
export async function refreshAuth() {
  if (pb.authStore.isValid) await pb.collection('users').authRefresh();
}

export function logout() {
  // Don't leave the previous account's data and unsent marks on this device.
  for (const key of ['cathub.cache', 'cathub.outbox']) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  pb.authStore.clear();
  window.location.assign('/');
}
