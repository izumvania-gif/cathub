import { assigneeFor, type Assignment, type DutyContext } from '@cathub/core';
import type { HouseholdState, TaskRec } from './types';

const DEFAULT_TZ = 'Europe/Moscow';

/** Inputs for core's assigneeFor() from a loaded household. */
export function dutyContext(state: HouseholdState): DutyContext {
  return {
    tz: state.household.timezone || DEFAULT_TZ,
    zones: state.household.duty_zones ?? null,
    overrides: state.overrides.map((o) => ({
      task: o.task,
      occurrence: o.occurrence_at,
      user: o.user,
    })),
    absences: state.absences.map((a) => ({ user: a.user, from: a.from, to: a.to })),
  };
}

export function whoDoes(state: HouseholdState, task: TaskRec, occurrence: Date | null): Assignment {
  return assigneeFor(task, occurrence, dutyContext(state));
}
