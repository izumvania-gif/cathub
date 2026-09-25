import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { pb, toPbDate } from './pb';
import { isNetworkError, outbox } from './outbox';
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
      await clearSnooze(task).catch(() => {});
      await refresh();
      return { id: record.id, queued: false };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      return { id: outbox.add(body).localId, queued: true };
    }
  };

  const undo = async (completionId: string) => {
    if (completionId.startsWith('local-')) {
      outbox.remove(completionId);
      return;
    }
    await pb.collection('completions').delete(completionId);
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
