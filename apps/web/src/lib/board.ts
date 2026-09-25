import {
  assigneeFor,
  evaluate,
  urgencyCompare,
  type Assignment,
  type DutyContext,
  type Evaluation,
} from '@cathub/core';
import { useEffect, useMemo, useState } from 'react';
import { useOutbox } from './outbox';
import { toIso } from './pb';
import {
  useAbsences,
  useCompletions,
  useHousehold,
  useOverrides,
  useSnoozes,
  useTasks,
} from './queries';
import type { Completion, Task } from './types';

export const DEFAULT_TZ = 'Europe/Moscow';

export interface BoardItem {
  task: Task;
  ev: Evaluation;
  /** Who does the current/next occurrence (core's assigneeFor). */
  who: Assignment;
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

/** Inputs for core's assigneeFor(): zones, hand-overs and absences. */
export function useDutyContext(): DutyContext {
  const household = useHousehold();
  const overrides = useOverrides();
  const absences = useAbsences();
  const tz = household.data?.timezone || DEFAULT_TZ;
  return useMemo(
    () => ({
      tz,
      zones: household.data?.duty_zones ?? null,
      overrides: (overrides.data ?? []).map((o) => ({
        task: o.task,
        occurrence: o.occurrence_at,
        user: o.user,
      })),
      absences: (absences.data ?? []).map((a) => ({ user: a.user, from: a.from, to: a.to })),
    }),
    [tz, household.data?.duty_zones, overrides.data, absences.data],
  );
}

/** All active tasks evaluated with the core engine, most urgent first. */
export function useBoard() {
  const tasks = useTasks();
  const completions = useCompletions();
  const snoozes = useSnoozes();
  const tz = useTz();
  const tick = useNow();
  const queued = useOutbox();
  const duty = useDutyContext();

  // "Now" is never earlier than the last data load: a completion made a second ago must not
  // look like it's in the future (the engine ignores those) until the next tick.
  const nowMs = Math.max(
    tick.getTime(),
    completions.dataUpdatedAt,
    snoozes.dataUpdatedAt,
    ...queued.map((q) => Date.parse(toIso(q.done_at))),
  );

  const items = useMemo<BoardItem[]>(() => {
    if (!tasks.data || !completions.data) return [];
    const now = new Date(nowMs);
    const byTask = new Map<string, Completion[]>();
    // Offline marks count right away (they look like regular completions without `expand`).
    const pending = queued.map(
      (q) =>
        ({
          ...q,
          id: q.localId,
          done_at: toIso(q.done_at),
          value: q.value ?? 0,
          note: q.note ?? '',
        }) as unknown as Completion,
    );
    for (const c of [...completions.data, ...pending]) {
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
          who: assigneeFor(task, ev.due, duty),
          last: find(ev.lastCompletion?.doneAt),
          covered: find(ev.coveredBy?.doneAt),
        };
      })
      .sort((a, b) => urgencyCompare(a.ev, b.ev));
  }, [tasks.data, completions.data, snoozes.data, queued, nowMs, tz, duty]);

  return {
    items,
    now: useMemo(() => new Date(nowMs), [nowMs]),
    tz,
    isLoading: tasks.isLoading || completions.isLoading,
    error: tasks.error ?? completions.error,
  };
}
