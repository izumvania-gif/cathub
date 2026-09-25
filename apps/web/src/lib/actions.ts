import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { pb, toPbDate } from './pb';
import { keys } from './queries';
import type { Completion, Task } from './types';

export function useTaskActions() {
  const qc = useQueryClient();
  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: keys.completions }),
      qc.invalidateQueries({ queryKey: keys.snoozes }),
    ]);
  }, [qc]);

  const clearSnooze = async (task: Task) => {
    const list = await pb
      .collection('snoozes')
      .getFullList({ filter: pb.filter('task = {:t}', { t: task.id }) });
    await Promise.all(list.map((s) => pb.collection('snoozes').delete(s.id)));
  };

  const complete = async (
    task: Task,
    opts: { at?: Date; kind?: 'done' | 'skipped'; value?: number | null; note?: string } = {},
  ) => {
    const record = await pb.collection('completions').create<Completion>({
      household: task.household,
      task: task.id,
      user: pb.authStore.record!.id,
      done_at: toPbDate(opts.at ?? new Date()),
      kind: opts.kind ?? 'done',
      ...(opts.value != null ? { value: opts.value } : {}),
      ...(opts.note ? { note: opts.note } : {}),
    });
    await clearSnooze(task).catch(() => {});
    await refresh();
    return record;
  };

  const undo = async (completionId: string) => {
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
