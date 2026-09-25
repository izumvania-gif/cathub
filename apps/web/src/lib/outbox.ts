import { ClientResponseError } from 'pocketbase';
import { useSyncExternalStore } from 'react';
import { pb } from './pb';

/**
 * Offline queue for completions: marks made without network are stored locally, count toward
 * task statuses right away, and are sent when the connection is back.
 */
export interface QueuedCompletion {
  localId: string;
  household: string;
  task: string;
  user: string;
  /** PocketBase date string. */
  done_at: string;
  kind: 'done' | 'skipped';
  value?: number;
  note?: string;
}

const KEY = 'cathub.outbox';
const listeners = new Set<() => void>();
let items: QueuedCompletion[] = read();

function read(): QueuedCompletion[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as QueuedCompletion[];
  } catch {
    return [];
  }
}

function write(next: QueuedCompletion[]) {
  items = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or unavailable: keep in memory */
  }
  for (const l of listeners) l();
}

export const outbox = {
  list: () => items,
  add(entry: Omit<QueuedCompletion, 'localId'>): QueuedCompletion {
    const q = {
      ...entry,
      localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    write([...items, q]);
    return q;
  },
  remove(localId: string) {
    write(items.filter((q) => q.localId !== localId));
  },
  clear() {
    write([]);
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useOutbox(): QueuedCompletion[] {
  return useSyncExternalStore(outbox.subscribe, outbox.list);
}

/** True for failures where retrying later makes sense (no network, server unreachable). */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (err instanceof ClientResponseError) return err.status === 0 || err.status >= 502;
  return err instanceof TypeError; // fetch() network failure
}

let flushing = false;

/** Sends queued completions in order. Returns how many were sent. */
export async function flushOutbox(): Promise<number> {
  if (flushing || !items.length || !pb.authStore.isValid) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const q of [...items]) {
      const { localId, ...body } = q;
      try {
        await pb.collection('completions').create(body);
        outbox.remove(localId);
        sent++;
      } catch (err) {
        if (isNetworkError(err)) break; // still offline: try again later
        outbox.remove(localId); // rejected by the server (e.g. task deleted): drop it
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}
