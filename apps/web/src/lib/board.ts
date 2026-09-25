import { evaluate, urgencyCompare, type Evaluation } from '@cathub/core';
import { useEffect, useMemo, useState } from 'react';
import { useCompletions, useHousehold, useSnoozes, useTasks } from './queries';
import type { Completion, Task } from './types';

export const DEFAULT_TZ = 'Europe/Moscow';

export interface BoardItem {
  task: Task;
  ev: Evaluation;
  /** Latest completion record (with the user expanded) for "who did it". */
  last: Completion | null;
  /** Record covering the current slot/period (double-completion warning). */
  covered: Completion | null;
}

/** Current time, re-rendering every `ms` so statuses move without reloads. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function useTz() {
  return useHousehold().data?.timezone || DEFAULT_TZ;
}

/** All active tasks evaluated with the core engine, most urgent first. */
export function useBoard() {
  const tasks = useTasks();
  const completions = useCompletions();
  const snoozes = useSnoozes();
  const tz = useTz();
  const tick = useNow();
  // "Now" is never earlier than the last data load: a completion made a second ago must not
  // look like it's in the future (the engine ignores those) until the next tick.
  const nowMs = Math.max(tick.getTime(), completions.dataUpdatedAt, snoozes.dataUpdatedAt);

  const items = useMemo<BoardItem[]>(() => {
    if (!tasks.data || !completions.data) return [];
    const now = new Date(nowMs);
    const byTask = new Map<string, Completion[]>();
    for (const c of completions.data) {
      const list = byTask.get(c.task) ?? [];
      list.push(c);
      byTask.set(c.task, list);
    }
    return tasks.data
      .map((task) => {
        const list = byTask.get(task.id) ?? [];
        const snooze = snoozes.data?.find((s) => s.task === task.id);
        const ev = evaluate(
          task.schedule,
          list.map((c) => ({ doneAt: c.done_at, kind: c.kind })),
          { now, tz, snoozedUntil: snooze?.until ?? null },
        );
        const find = (doneAt?: string) =>
          doneAt ? (list.find((c) => c.done_at === doneAt) ?? null) : null;
        return {
          task,
          ev,
          last: find(ev.lastCompletion?.doneAt),
          covered: find(ev.coveredBy?.doneAt),
        };
      })
      .sort((a, b) => urgencyCompare(a.ev, b.ev));
  }, [tasks.data, completions.data, snoozes.data, nowMs, tz]);

  return {
    items,
    now: useMemo(() => new Date(nowMs), [nowMs]),
    tz,
    isLoading: tasks.isLoading || completions.isLoading,
    error: tasks.error ?? completions.error,
  };
}
