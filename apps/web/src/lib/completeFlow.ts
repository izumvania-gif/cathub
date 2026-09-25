import { fishForStatus, taskWeight } from '@cathub/core';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTaskActions } from './actions';
import type { BoardItem } from './board';
import { errorMessage } from './pb';
import type { Task } from './types';

/** Mark done with an undo toast; asks first if the current slot/period is already covered. */
export function useCompleteFlow() {
  const actions = useTaskActions();
  const [confirm, setConfirm] = useState<BoardItem | null>(null);

  const run = async (
    task: Task,
    opts?: Parameters<typeof actions.complete>[1],
    /** Fish this mark brings, if known (shown in the toast). */
    fish = 0,
  ) => {
    try {
      const rec = await actions.complete(task, opts);
      const label = rec.queued
        ? 'Сохранено без сети, отправим позже'
        : opts?.kind === 'skipped'
          ? 'Пропущено'
          : 'Отмечено';
      const reward = fish > 0 && opts?.kind !== 'skipped' ? ` · +${fish} 🐟` : '';
      toast.success(`${label}: ${task.title}${reward}`, {
        action: { label: 'Отменить', onClick: () => void actions.undo(rec.id).catch(() => {}) },
      });
      navigator.vibrate?.(12);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const request = (item: BoardItem) => {
    if (item.covered && item.covered.kind === 'done') setConfirm(item);
    else void run(item.task, undefined, fishForStatus(item.ev.status, taskWeight(item.task)));
  };

  return { run, request, confirm, setConfirm };
}
