import type { DutyZones } from '@cathub/core';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from './auth';
import { pb, toPbDate } from './pb';
import { keys, useOverrides } from './queries';
import type { Task } from './types';

/** Hand-overs, zones and absences (docs/PLAN.md §6.5). */
export function useDutyActions() {
  const qc = useQueryClient();
  const user = useUser();
  const overrides = useOverrides();
  const refresh = (key: readonly unknown[]) => qc.invalidateQueries({ queryKey: key });

  const find = (task: Task, occurrence: Date) =>
    (overrides.data ?? []).find(
      (o) =>
        o.task === task.id && Math.abs(Date.parse(o.occurrence_at) - occurrence.getTime()) < 60_000,
    );

  return {
    overrideFor: find,
    /** This occurrence goes to `to` (me for "I'll take it"). */
    async handOver(task: Task, occurrence: Date, to: string) {
      const old = find(task, occurrence);
      if (old) await pb.collection('duty_overrides').delete(old.id);
      await pb.collection('duty_overrides').create({
        household: task.household,
        task: task.id,
        occurrence_at: toPbDate(occurrence),
        user: to,
        by: user!.id,
      });
      await refresh(keys.overrides);
    },
    async undoHandOver(task: Task, occurrence: Date) {
      const old = find(task, occurrence);
      if (old) await pb.collection('duty_overrides').delete(old.id);
      await refresh(keys.overrides);
    },
    async saveZones(zones: DutyZones) {
      await pb.collection('households').update(user!.household, { duty_zones: zones });
      await refresh(keys.household);
    },
    async addAbsence(from: string, to: string, note = '') {
      await pb.collection('absences').create({
        household: user!.household,
        user: user!.id,
        from,
        to,
        note,
      });
      await refresh(keys.absences);
    },
    async removeAbsence(id: string) {
      await pb.collection('absences').delete(id);
      await refresh(keys.absences);
    },
  };
}
