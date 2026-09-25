import {
  healthEventsFromTasks,
  healthPlan,
  visibleTips,
  type HealthEvent,
  type HealthTip,
} from '@cathub/core';
import { TZDate } from '@date-fns/tz';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useUser } from './auth';
import { useBoard } from './board';
import { pb, toIso } from './pb';
import { keys, useCat, useCompletions, useHealthRecords, useHealthTips, useTasks } from './queries';

/** Age-based tips for the cat (core's healthPlan) minus the ones the family already handled. */
export function useHealthPlan(): { tips: HealthTip[]; isLoading: boolean } {
  const cat = useCat();
  const records = useHealthRecords();
  const tasks = useTasks();
  const completions = useCompletions();
  const handled = useHealthTips();
  const { now } = useBoard();

  const tips = useMemo(() => {
    if (!cat.data) return [];
    const history: HealthEvent[] = [
      ...(records.data ?? []).map((r) => ({ type: r.type, date: r.date, title: r.title })),
      ...healthEventsFromTasks(
        (tasks.data ?? []).map((t) => ({
          template_key: t.template_key,
          title: t.title,
          completions: (completions.data ?? [])
            .filter((c) => c.task === t.id)
            .map((c) => ({ doneAt: c.done_at, kind: c.kind })),
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
  }, [cat.data, records.data, tasks.data, completions.data, handled.data, now]);

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
  const mark = (tip: HealthTip, state: 'dismissed' | 'done' | 'added', task = '') =>
    pb.collection('health_tips').create({ household: user!.household, tip: tip.key, state, task });

  return {
    dismiss: async (tip: HealthTip) => {
      await mark(tip, 'dismissed');
      await refresh();
    },
    done: async (tip: HealthTip) => {
      await mark(tip, 'done');
      await refresh();
    },
    /** A one-off chore at 10:00 on the tip's date (or tomorrow if that's past). */
    addToChores: async (tip: HealthTip, tz: string, now: Date): Promise<Date> => {
      const base =
        tip.due.getTime() > now.getTime() ? tip.due : new Date(now.getTime() + 86_400_000);
      const l = new TZDate(base.getTime(), tz);
      const at = new Date(
        new TZDate(l.getFullYear(), l.getMonth(), l.getDate(), 10, 0, 0, tz).getTime(),
      );
      const task = await pb.collection('tasks').create({
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
      });
      await mark(tip, 'added', task.id);
      await refresh();
      return at;
    },
  };
}
