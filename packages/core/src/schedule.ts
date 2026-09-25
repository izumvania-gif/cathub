/**
 * Task schedule. See docs/PLAN.md §4.
 * Times of day are local to the household timezone; timestamps are ISO strings in UTC.
 */
export type Schedule =
  /** Fixed times of day, e.g. feeding at 08:00 and 20:00. Each time is a separate slot. */
  | { kind: 'daily_slots'; times: TimeOfDay[]; weekdays?: Weekday[] }
  | {
      kind: 'interval';
      every: number;
      unit: IntervalUnit;
      /**
       * 'completion' — floating: next = last completion + interval (litter change, nails, vaccines).
       * 'calendar'   — fixed grid from startDate, independent of completions.
       */
      anchor: 'completion' | 'calendar';
      startDate: string;
      /** Days after the due date before the task counts as overdue. */
      graceDays?: number;
    }
  /** One-off task, e.g. a vet appointment. */
  | { kind: 'once'; at: string };

export type IntervalUnit = 'hour' | 'day' | 'week' | 'month' | 'year';

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** "HH:MM", 24-hour clock. */
export type TimeOfDay = `${number}:${number}`;

export type TaskStatus = 'done' | 'upcoming' | 'soon' | 'due' | 'overdue';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Parses "HH:MM" into minutes since midnight; returns null for invalid input. */
export function parseTimeOfDay(value: string): number | null {
  const m = TIME_RE.exec(value);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function isTimeOfDay(value: string): value is TimeOfDay {
  return parseTimeOfDay(value) !== null;
}
