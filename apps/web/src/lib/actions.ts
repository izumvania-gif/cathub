import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { pb, toPbDate } from './pb';
import { ClientResponseError } from 'pocketbase';
import {
  clearSnoozes,
  isNetworkError,
  newRecordId,
  outbox,
  restoreSnoozes,
  serverIdOf,
} from './outbox';
import { keys } from './queries';
import type { Completion, Task } from './types';

export function useTaskActions() {
  const qc = useQueryClient();
  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: keys.completions }),
      qc.invalidateQueries({ queryKey: keys.snoozes }),
      qc.invalidateQueries({ queryKey: keys.measurements }),
    ]);
  }, [qc]);

  const clearSnooze = async (task: Task) => {
    const list = await pb
      .collection('snoozes')
      .getFullList({ filter: pb.filter('task = {:t}', { t: task.id }) });
    await Promise.all(list.map((s) => pb.collection('snoozes').delete(s.id)));
  };

  /** Records a completion; without network it's queued (see lib/outbox.ts) and `queued` is true. */
  const complete = async (
    task: Task,
    opts: { at?: Date; kind?: 'done' | 'skipped'; value?: number | null; note?: string } = {},
  ): Promise<{ id: string; queued: boolean }> => {
    const body = {
      // Made here, so a retry of a save whose answer got lost isn't saved twice (lib/outbox.ts).
      id: newRecordId(),
      household: task.household,
      task: task.id,
      user: pb.authStore.record!.id,
      done_at: toPbDate(opts.at ?? new Date()),
      kind: opts.kind ?? ('done' as const),
      ...(opts.value != null ? { value: opts.value } : {}),
      ...(opts.note ? { note: opts.note } : {}),
    };
    try {
      const record = await pb.collection('completions').create<Completion>(body);
      await clearSnoozes(record.id, task.id, opts.at ?? null).catch(() => {});
      await refresh();
      return { id: record.id, queued: false };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      return { id: outbox.add(body).localId, queued: true };
    }
  };

  const undo = async (completionId: string) => {
    // Not sent yet: just drop it (a send in progress deletes it once it lands).
    if (outbox.has(completionId)) return outbox.remove(completionId);
    const id = serverIdOf(completionId);
    if (!id) return;
    try {
      await pb.collection('completions').delete(id);
    } catch (err) {
      // Already gone (deleted elsewhere, or the server refused the queued mark).
      if (!(err instanceof ClientResponseError && err.status === 404)) throw err;
    }
    // The mark had cleared a snooze: put it back.
    await restoreSnoozes(id);
    await refresh();
  };

  const snooze = async (task: Task, until: Date) => {
    await clearSnooze(task);
    await pb.collection('snoozes').create({
      household: task.household,
      task: task.id,
      until: toPbDate(until),
      user: pb.authStore.record!.id,
    });
    await refresh();
  };

  return { complete, undo, snooze };
}
