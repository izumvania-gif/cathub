import { TZDate } from '@date-fns/tz';
import { localDate } from './reminders';
import type { Schedule, Weekday } from './schedule';
import type { TaskCategory } from './templates';

/**
 * Who does a task on a given occurrence (docs/PLAN.md §6.5). Pure: the app, the bot and the
 * weekly view all ask this, so everyone agrees on "whose turn is it".
 */

/** How a task picks its person. '' (older tasks) is read from assignee/rotation. */
export type AssignMode = 'zone' | 'anyone' | 'one' | 'rotation' | 'weekday' | 'slot';

export const ASSIGN_MODE_LABELS: Record<AssignMode, string> = {
  zone: 'По зоне',
  anyone: 'Любой',
  one: 'Один человек',
  rotation: 'По очереди',
  weekday: 'По дням недели',
  slot: 'По времени',
};

/** Zone of responsibility: a category's default person, optionally different on some weekdays. */
export interface DutyZone {
  user: string;
  weekdays?: Partial<Record<Weekday, string>>;
}
export type DutyZones = Partial<Record<TaskCategory, DutyZone>>;

export interface AssignableTask {
  id: string;
  category?: string | null;
  schedule: Schedule;
  assign_mode?: string | null;
  assignee?: string | null;
  rotation?: readonly string[] | null;
  /** weekday "1".."7" or slot "HH:MM" → user id */
  duty_map?: Record<string, string> | null;
}

/** "I'll take it" / "pass it to Петя" for one occurrence. */
export interface DutyOverride {
  task: string;
  /** ISO timestamp of the occurrence. */
  occurrence: string;
  user: string;
}

/** Away from home on local dates [from, to], inclusive ("YYYY-MM-DD"). */
export interface Absence {
  user: string;
  from: string;
  to: string;
}

export interface DutyContext {
  tz: string;
  zones?: DutyZones | null;
  overrides?: readonly DutyOverride[];
  absences?: readonly Absence[];
}

export interface Assignment {
  /** Who should do it, or null for "anyone". */
  user: string | null;
  source: 'override' | 'task' | 'zone' | 'anyone';
  /** Set when the usual person is away and it falls to anyone. */
  away?: string;
}

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Вс',
};

export function assignMode(t: AssignableTask): AssignMode {
  const m = t.assign_mode;
  if (
    m === 'zone' ||
    m === 'anyone' ||
    m === 'one' ||
    m === 'rotation' ||
    m === 'weekday' ||
    m === 'slot'
  )
    return m;
  if (t.rotation?.length) return 'rotation';
  return t.assignee ? 'one' : 'anyone';
}

/** ISO weekday (1 = Monday) of a moment in the timezone. */
export function localWeekday(d: Date, tz: string): Weekday {
  const day = new TZDate(d.getTime(), tz).getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

function localTime(d: Date, tz: string): string {
  const l = new TZDate(d.getTime(), tz);
  return `${String(l.getHours()).padStart(2, '0')}:${String(l.getMinutes()).padStart(2, '0')}`;
}

export function isAway(user: string, at: Date, tz: string, absences: readonly Absence[] = []) {
  const day = localDate(at, tz);
  return absences.some((a) => a.user === user && a.from <= day && day <= a.to);
}

/** The person the task itself (or its zone) names for this occurrence, before overrides. */
function planned(task: AssignableTask, at: Date | null, ctx: DutyContext): Assignment {
  const map = task.duty_map ?? {};
  const pick = (user: string | undefined | null, source: Assignment['source']): Assignment =>
    user ? { user, source } : { user: null, source: 'anyone' };
  switch (assignMode(task)) {
    case 'anyone':
      return { user: null, source: 'anyone' };
    case 'one':
    case 'rotation':
      return pick(task.assignee, 'task');
    case 'weekday':
      return pick(at ? map[String(localWeekday(at, ctx.tz))] : null, 'task');
    case 'slot':
      return pick(at ? map[localTime(at, ctx.tz)] : null, 'task');
    case 'zone': {
      const zone = ctx.zones?.[task.category as TaskCategory];
      if (!zone) return { user: null, source: 'anyone' };
      const byDay = at ? zone.weekdays?.[localWeekday(at, ctx.tz)] : undefined;
      return pick(byDay || zone.user, 'zone');
    }
  }
}

/**
 * Who does this occurrence: an explicit override wins; otherwise the task's mode (or its
 * zone); if that person is away that day, it's anyone's.
 */
export function assigneeFor(
  task: AssignableTask,
  occurrence: Date | null,
  ctx: DutyContext,
): Assignment {
  if (occurrence) {
    const o = ctx.overrides?.find(
      (x) =>
        x.task === task.id && Math.abs(Date.parse(x.occurrence) - occurrence.getTime()) < 60_000,
    );
    if (o) return { user: o.user, source: 'override' };
  }
  const p = planned(task, occurrence, ctx);
  if (p.user && occurrence && isAway(p.user, occurrence, ctx.tz, ctx.absences))
    return { user: null, source: 'anyone', away: p.user };
  return p;
}
