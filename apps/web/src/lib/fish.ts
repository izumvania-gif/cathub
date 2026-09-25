import { rewardFor, taskWeight } from '@cathub/core';
import { useMemo } from 'react';
import { useOutbox } from './outbox';
import { toIso } from './pb';
import { useCompletions, useFishBalance, useHousehold, useTasks } from './queries';
import { DEFAULT_TZ } from './board';

/**
 * Fish 🐟 to show: the server balance plus marks the bot hasn't priced yet (it does so within
 * a tick) and marks still waiting offline, priced here with the same core formula.
 */
export function useFish(): { balance: number; pending: number; isLoading: boolean } {
  const server = useFishBalance();
  const tasks = useTasks();
  const completions = useCompletions();
  const queued = useOutbox();
  const tz = useHousehold().data?.timezone || DEFAULT_TZ;

  const pending = useMemo(() => {
    if (!tasks.data || !completions.data) return 0;
    const all = [
      ...completions.data.map((c) => ({
        task: c.task,
        doneAt: c.done_at,
        kind: c.kind,
        priced: c.rewarded,
      })),
      ...queued.map((q) => ({
        task: q.task,
        doneAt: toIso(q.done_at),
        kind: (q.kind ?? 'done') as 'done' | 'skipped',
        priced: false,
      })),
    ];
    let sum = 0;
    for (const c of all) {
      if (c.priced || c.kind !== 'done') continue;
      const task = tasks.data.find((t) => t.id === c.task);
      if (!task) continue;
      sum += rewardFor({
        schedule: task.schedule,
        weight: taskWeight(task),
        others: all.filter((o) => o.task === c.task),
        completion: c,
        tz,
      });
    }
    return sum;
  }, [tasks.data, completions.data, queued, tz]);

  return {
    balance: (server.data ?? 0) + pending,
    pending,
    isLoading: server.isLoading,
  };
}
