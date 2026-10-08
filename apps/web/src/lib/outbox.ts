import { ClientResponseError } from 'pocketbase';
import { useSyncExternalStore } from 'react';
import { pb, toIso } from './pb';
import type { Completion, User } from './types';

/**
 * Offline queue for completions: marks made without network are stored locally, count toward
 * task statuses right away, and are sent when the connection is back.
 *
 * Every mark gets its record id on the phone before the first attempt. So a retry whose earlier
 * try did reach the server (the answer got lost), or a second tab sending the same queue, is
 * recognised instead of saving the mark twice, and «Отменить» knows the server id in any tab.
 */
export interface QueuedCompletion {
  localId: string;
  /** The record id the mark gets on the server (missing in entries queued by older versions). */
  id?: string;
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
const LOCAL = 'local-';
const listeners = new Set<() => void>();
/** False while localStorage refuses writes: then the in-memory list is the queue. */
let persisted = true;
let items: QueuedCompletion[] = [];
items = read();
/** Old-style entries (no `id`) sent this session: local id → server id. */
const sentIds = new Map<string, string>();

// Another tab or window of the app changed the queue: take its version.
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !persisted) return;
    items = read();
    for (const l of listeners) l();
  });

function read(): QueuedCompletion[] {
  if (!persisted) return items;
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as QueuedCompletion[];
  } catch {
    return items;
  }
}

function write(next: QueuedCompletion[]) {
  items = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    persisted = true;
  } catch {
    persisted = false; // storage full or unavailable: keep the queue in memory
  }
  for (const l of listeners) l();
}

/** A new PocketBase record id (15 characters a–z, 0–9). */
export function newRecordId(): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(15)), (b) => abc[b % 36]).join('');
}

/** The server record a mark became (or will become), from the id the app shows for it. */
export function serverIdOf(id: string): string | undefined {
  if (!id.startsWith(LOCAL)) return id;
  const rest = id.slice(LOCAL.length);
  return /^[a-z0-9]{15}$/.test(rest) ? rest : sentIds.get(id);
}

export const outbox = {
  list: () => items,
  add(entry: Omit<QueuedCompletion, 'localId'>): QueuedCompletion {
    const q = {
      ...entry,
      localId: entry.id
        ? `${LOCAL}${entry.id}`
        : `${LOCAL}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    write([...read(), q]);
    return q;
  },
  remove(localId: string) {
    write(read().filter((q) => q.localId !== localId));
  },
  /** Still waiting to be sent? */
  has: (localId: string) => read().some((q) => q.localId === localId),
  clear() {
    write([]);
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

/** Snoozes a mark cleared, by the mark's server id, so «Отменить» can put them back. */
const clearedSnoozes = new Map<
  string,
  Array<{ task: string; household: string; until: string; user: string }>
>();

/**
 * A done chore is no longer snoozed. With `before` (a mark dated in the past), only snoozes set
 * by then go: one set later, e.g. for the evening slot after a queued morning mark, stays.
 */
export async function clearSnoozes(markId: string, task: string, before: Date | null) {
  const list = await pb
    .collection('snoozes')
    .getFullList<{ id: string; task: string; household: string; until: string; user: string }>({
      filter: before
        ? pb.filter('task = {:t} && created <= {:at}', { t: task, at: before })
        : pb.filter('task = {:t}', { t: task }),
    });
  await Promise.all(list.map((s) => pb.collection('snoozes').delete(s.id)));
  if (list.length)
    clearedSnoozes.set(
      markId,
      list.map(({ task, household, until, user }) => ({ task, household, until, user })),
    );
}

/** Puts back the snoozes a mark cleared (after the mark was undone). */
export async function restoreSnoozes(markId: string) {
  for (const s of clearedSnoozes.get(markId) ?? [])
    await pb
      .collection('snoozes')
      .create(s)
      .catch(() => {});
  clearedSnoozes.delete(markId);
}

export function useOutbox(): QueuedCompletion[] {
  return useSyncExternalStore(outbox.subscribe, outbox.list);
}

/** A queued mark shown like a regular completion (its id is the local one; `fish` comes later). */
export function asCompletion(q: QueuedCompletion, user?: User | null): Completion {
  return {
    ...q,
    id: q.localId,
    collectionId: '',
    collectionName: 'completions',
    done_at: toIso(q.done_at),
    value: q.value ?? 0,
    note: q.note ?? '',
    fish: 0,
    rewarded: false,
    expand: user ? { user } : undefined,
  };
}

/** True for failures where retrying later makes sense (no network, server unreachable). */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (err instanceof ClientResponseError) return err.status === 0 || err.status >= 502;
  return err instanceof TypeError; // fetch() network failure
}

/** Worth keeping in the queue and trying later: network trouble, an expired session, overload. */
const retryLater = (err: unknown) =>
  isNetworkError(err) ||
  (err instanceof ClientResponseError && [401, 429, 500].includes(err.status));

export interface FlushHooks {
  /** A queued mark reached the server (put it into the cache before it leaves the queue). */
  sent?: (record: Completion) => void | Promise<void>;
  /** The server refused a queued mark for good. */
  dropped?: (q: QueuedCompletion, err: unknown) => void;
}

/** The server already has a mark with this id (refused as a duplicate): fetch it. */
async function alreadySaved(err: unknown, id: string | undefined): Promise<Completion | null> {
  if (!id || !(err instanceof ClientResponseError) || err.status !== 400) return null;
  return pb
    .collection('completions')
    .getOne<Completion>(id)
    .catch(() => null);
}

let flushing = false;

/** Sends queued completions in order. Returns how many were sent. */
export async function flushOutbox(hooks: FlushHooks = {}): Promise<number> {
  if (flushing || !read().length || !pb.authStore.isValid) return 0;
  flushing = true;
  try {
    // One tab at a time (they share the queue); without Web Locks the ids still prevent doubles.
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    return locks
      ? await locks.request('cathub.outbox', () => flushQueue(hooks))
      : await flushQueue(hooks);
  } finally {
    flushing = false;
  }
}

async function flushQueue(hooks: FlushHooks): Promise<number> {
  items = read();
  let sent = 0;
  for (const q of [...items]) {
    // Undone (or sent by another tab) while we were busy with the previous one.
    if (!outbox.has(q.localId)) continue;
    const { localId, ...body } = q;
    try {
      let record: Completion;
      try {
        record = await pb.collection('completions').create<Completion>(body);
      } catch (err) {
        // Already saved: an earlier try whose answer got lost.
        const saved = await alreadySaved(err, body.id);
        if (!saved) throw err;
        record = saved;
      }
      if (!outbox.has(localId)) {
        // «Отменить» was tapped while it was on its way.
        await pb
          .collection('completions')
          .delete(record.id)
          .catch(() => {});
        continue;
      }
      if (!body.id) sentIds.set(localId, record.id);
      await hooks.sent?.(record);
      outbox.remove(localId);
      sent++;
      // Like a mark made online (a couple of minutes' slack for clocks that differ).
      const before = new Date(Date.parse(toIso(q.done_at)) + 2 * 60_000);
      void clearSnoozes(record.id, q.task, before).catch(() => {});
    } catch (err) {
      if (retryLater(err)) break; // still offline, logged out or busy: try again later
      outbox.remove(localId); // refused for good (e.g. the task was deleted)
      hooks.dropped?.(q, err);
    }
  }
  return sent;
}
