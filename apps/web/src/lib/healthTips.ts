import {
  healthEventsFromTasks,
  healthPlan,
  visibleTips,
  type HealthEvent,
  type HealthTip,
} from '@cathub/core';
import { TZDate } from '@date-fns/tz';
import { useQueryClient } from '@tanstack/react-query';
import { ClientResponseError } from 'pocketbase';
import { useMemo } from 'react';
import { useUser } from './auth';
import { useBoard } from './board';
import { useOutbox } from './outbox';
import { pb, toIso } from './pb';
import { keys, useCat, useCompletions, useHealthRecords, useHealthTips, useTasks } from './queries';

/** Age-based tips for the cat (core's healthPlan) minus the ones the family already handled. */
export function useHealthPlan(): { tips: HealthTip[]; isLoading: boolean } {
  const cat = useCat();
  const records = useHealthRecords();
  const tasks = useTasks();
  const completions = useCompletions();
  const handled = useHealthTips();
  const queued = useOutbox();
  const { now } = useBoard();

  const tips = useMemo(() => {
    if (!cat.data) return [];
    const history: HealthEvent[] = [
      ...(records.data ?? []).map((r) => ({ type: r.type, date: r.date, title: r.title })),
      ...healthEventsFromTasks(
        (tasks.data ?? []).map((t) => ({
          template_key: t.template_key,
          title: t.title,
          // Marks saved without network count too (like on the board).
          completions: [
            ...(completions.data ?? []).map((c) => ({
              task: c.task,
              doneAt: c.done_at,
              kind: c.kind,
            })),
            ...queued.map((q) => ({ task: q.task, doneAt: toIso(q.done_at), kind: q.kind })),
          ]
            .filter((c) => c.task === t.id)
            .map(({ doneAt, kind }) => ({ doneAt, kind })),
        })),
      ),
    ];
    const plan = healthPlan({
      birthDate: cat.data.birth_date ? toIso(cat.data.birth_date) : null,
      neutered: cat.data.neutered,
      history,
      now,
    });
    return visibleTips(plan, new Set((handled.data ?? []).map((h) => h.tip)));
  }, [cat.data, records.data, tasks.data, completions.data, queued, handled.data, now]);

  return { tips, isLoading: cat.isLoading || records.isLoading || handled.isLoading };
}

export function useTipActions() {
  const qc = useQueryClient();
  const user = useUser();
  const cat = useCat();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.healthTips }),
      qc.invalidateQueries({ queryKey: keys.tasks }),
    ]);
  // A tip is handled once per household (unique index). If it already was (on another phone, or
  // the screen showed an old list), say so instead of doing it twice.
  const mark = async (tip: HealthTip, state: 'dismissed' | 'done' | 'added') => {
    try {
      return await pb
        .collection('health_tips')
        .create<{ id: string }>({ household: user!.household, tip: tip.key, state });
    } catch (err) {
      const data = err instanceof ClientResponseError ? err.response?.data : undefined;
      if ((data as { tip?: { code?: string } } | undefined)?.tip?.code === 'validation_not_unique')
        throw new Error('С этим советом уже разобрались, список обновлён', { cause: err });
      throw err;
    }
  };
  /** Runs an action, then always re-syncs the list (also after a failure). */
  const synced = async <T>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } finally {
      await refresh();
    }
  };

  return {
    dismiss: (tip: HealthTip) => synced(() => mark(tip, 'dismissed')),
    done: (tip: HealthTip) => synced(() => mark(tip, 'done')),
    /** A one-off chore at 10:00 on the tip's date (or tomorrow if that's past). */
    addToChores: (tip: HealthTip, tz: string, now: Date): Promise<Date> =>
      synced(async () => {
        const base =
          tip.due.getTime() > now.getTime() ? tip.due : new Date(now.getTime() + 86_400_000);
        const l = new TZDate(base.getTime(), tz);
        const at = new Date(
          new TZDate(l.getFullYear(), l.getMonth(), l.getDate(), 10, 0, 0, tz).getTime(),
        );
        // The tip first: if it was already handled, no second chore is created.
        const handled = await mark(tip, 'added');
        const task = await pb
          .collection('tasks')
          .create({
            household: user!.household,
            cat: cat.data?.id ?? '',
            title: tip.title,
            emoji: tip.emoji,
            category: tip.category,
            schedule: { kind: 'once', at: at.toISOString() },
            medical:
              tip.category === 'vaccines' || tip.category === 'parasites' || tip.category === 'vet',
            notes: tip.why,
            assign_mode: 'zone',
            sort: Date.now() % 1_000_000,
          })
          .catch(async (err: unknown) => {
            // No chore after all: bring the tip back.
            await pb
              .collection('health_tips')
              .delete(handled.id)
              .catch(() => {});
            throw err;
          });
        await pb
          .collection('health_tips')
          .update(handled.id, { task: task.id })
          .catch(() => {});
        return at;
      }),
  };
}
