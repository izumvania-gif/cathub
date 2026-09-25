import {
  addInterval,
  type OnboardingAnswers,
  type Schedule,
  type TaskTemplate,
} from '@cathub/core';
import { TZDate } from '@date-fns/tz';
import { startOfDay } from 'date-fns';

/** Local midnight today in the household timezone, as ISO. */
export function todayIso(tz: string) {
  return new Date(startOfDay(new TZDate(Date.now(), tz)).getTime()).toISOString();
}

/**
 * Turns a template into a concrete schedule. For interval tasks the first due date is
 * "last done + interval" if the user told us when it was last done, otherwise today.
 */
export function scheduleFromTemplate(
  t: TaskTemplate,
  answers: OnboardingAnswers,
  tz: string,
  lastDone?: string | null,
): Schedule {
  const spec = t.schedule(answers);
  if (spec.kind === 'daily_slots') return spec;
  let start = todayIso(tz);
  if (lastDone) {
    const last = new TZDate(new Date(`${lastDone}T12:00:00`).getTime(), tz);
    start = new Date(startOfDay(addInterval(last, spec.every, spec.unit)).getTime()).toISOString();
  }
  return { ...spec, startDate: start };
}
