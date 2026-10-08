import type { TaskCategory } from '@cathub/core';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from './auth';
import { pb, toPbDate } from './pb';
import { keys, useOverrides } from './queries';
import type { Household, Task } from './types';
import {
  addPendingZone,
  applyZone,
  seedServerCopy,
  withPendingZones,
  zonesAfterFailure,
  type ZoneUpdate,
} from './zones';

/** Zone saves go one at a time, each on top of the one before. */
let zoneQueue: Promise<unknown> = Promise.resolve();

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
    /**
     * Changes one zone. `fn` is applied to the freshest copy, not to what the screen showed: the
     * screen shows the change at once (so the select doesn't jump back while saving), and the save
     * reads the household again right before writing, so quick edits in a row and another
     * member's change to a different zone are not lost.
     */
    saveZone(category: TaskCategory, fn: ZoneUpdate) {
      const key = [...keys.household, user!.household];
      seedServerCopy(qc.getQueryData<Household>(key));
      const settle = addPendingZone({ category, fn });
      qc.setQueryData<Household>(key, (h) =>
        h ? { ...h, duty_zones: applyZone(h.duty_zones, category, fn) } : h,
      );
      const run = async () => {
        const col = pb.collection('households');
        const fresh = await col.getOne<Household>(user!.household);
        const saved = await col.update<Household>(user!.household, {
          duty_zones: applyZone(fresh.duty_zones, category, fn),
        });
        settle();
        qc.setQueryData<Household>(key, withPendingZones(saved));
      };
      const done = zoneQueue.then(run, run);
      zoneQueue = done.catch(() => {});
      return done.catch((err: unknown) => {
        // Not saved: show the server's value again (and other edits still on their way).
        settle();
        const shown = zonesAfterFailure();
        if (shown) qc.setQueryData<Household>(key, shown);
        void refresh(keys.household);
        throw err;
      });
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
