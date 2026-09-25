import { TZDate } from '@date-fns/tz';
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInHours,
  endOfDay,
  getISODay,
  startOfDay,
} from 'date-fns';
import { parseTimeOfDay, type IntervalUnit, type Schedule, type TaskStatus } from './schedule';

/** A recorded completion (or skip) of a task. */
export interface CompletionLike {
  /** ISO timestamp (UTC) of when it was actually done. */
  doneAt: string;
  kind: 'done' | 'skipped';
}

export interface EvaluateOptions {
  now: Date;
  /** IANA timezone of the household, e.g. "Europe/Moscow". */
  tz: string;
  /** If set and in the future, an unfinished task is treated as snoozed until then. */
  snoozedUntil?: string | null;
}

export interface Evaluation {
  status: TaskStatus;
  /** Start of the current/next due window (UTC). Null only for a finished one-off task. */
  due: Date | null;
  /** Moment after which the task is overdue. */
  overdueAt: Date | null;
  /**
   * Share of the period elapsed, 0 = just done, 1 = due now, >1 = overdue.
   * Drives the green→red "dueness" bar (docs/PLAN.md §6).
   */
  dueness: number;
  /** Completion covering the current slot/period, if any (used for the double-feeding warning). */
  coveredBy: CompletionLike | null;
  lastCompletion: CompletionLike | null;
  snoozed: boolean;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Daily slots: due from the slot time, overdue this long after it. */
const SLOT_GRACE_MS = HOUR;
/** Daily slots: completing up to this long before a slot counts for that slot. */
const SLOT_LEAD_MS = 2 * HOUR;

// ─── helpers ────────────────────────────────────────────────────────────────

const inTz = (d: Date | string | number, tz: string) => new TZDate(new Date(d).getTime(), tz);

export function addInterval(date: Date, every: number, unit: IntervalUnit): Date {
  switch (unit) {
    case 'hour':
      return addHours(date, every);
    case 'day':
      return addDays(date, every);
    case 'week':
      return addWeeks(date, every);
    case 'month':
      return addMonths(date, every);
    case 'year':
      return addYears(date, every);
  }
}

/** Approximate period length, used for "soon" windows and dueness. */
export function periodMs(every: number, unit: IntervalUnit): number {
  const unitMs = { hour: HOUR, day: DAY, week: 7 * DAY, month: 30 * DAY, year: 365 * DAY }[unit];
  return every * unitMs;
}

/**
 * How long before the due date a task shows as "soon": 20% of the period,
 * at least 1 hour and at most 14 days (hours for daily chores, ~2 weeks for yearly ones).
 */
export function soonWindowMs(period: number): number {
  return Math.min(14 * DAY, Math.max(HOUR, period * 0.2));
}

const isDayGranular = (unit: IntervalUnit) => unit !== 'hour';

function sortedCompletions(completions: readonly CompletionLike[]): CompletionLike[] {
  return [...completions].sort((a, b) => Date.parse(a.doneAt) - Date.parse(b.doneAt));
}

function latest(completions: readonly CompletionLike[]): CompletionLike | null {
  return sortedCompletions(completions).at(-1) ?? null;
}

function statusFor(now: number, due: number, overdueAt: number, soonMs: number): TaskStatus {
  if (now >= overdueAt) return 'overdue';
  if (now >= due) return 'due';
  if (now >= due - soonMs) return 'soon';
  return 'upcoming';
}

function clampDueness(start: number, due: number, now: number): number {
  if (due <= start) return now >= due ? 1 : 0;
  return Math.max(0, (now - start) / (due - start));
}

// ─── daily slots ────────────────────────────────────────────────────────────

/** All slot moments (UTC) of a daily_slots schedule within [from, to]. */
export function slotsBetween(
  schedule: Extract<Schedule, { kind: 'daily_slots' }>,
  from: Date,
  to: Date,
  tz: string,
): Date[] {
  const minutes = schedule.times
    .map(parseTimeOfDay)
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b);
  if (minutes.length === 0) return [];
  const out: Date[] = [];
  let day = startOfDay(inTz(from, tz));
  const last = endOfDay(inTz(to, tz));
  while (day.getTime() <= last.getTime()) {
    const weekday = getISODay(day);
    if (!schedule.weekdays?.length || schedule.weekdays.includes(weekday as never)) {
      for (const m of minutes) {
        const slot = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), 0, m, 0, tz);
        if (slot.getTime() >= from.getTime() && slot.getTime() <= to.getTime()) {
          out.push(new Date(slot.getTime()));
        }
      }
    }
    day = addDays(day, 1);
  }
  return out;
}

/**
 * The windows that own each daily slot in [from, to]: a completion made within a slot's window
 * covers that slot. Same partition as evaluate() uses.
 */
export function slotWindows(
  schedule: Extract<Schedule, { kind: 'daily_slots' }>,
  from: Date,
  to: Date,
  tz: string,
): { slot: Date; start: number; end: number }[] {
  const slots = slotsBetween(schedule, addDays(from, -2), addDays(to, 2), tz);
  const starts = slots.map((s, i) => {
    const prev = slots[i - 1];
    const lead = s.getTime() - SLOT_LEAD_MS;
    return prev ? Math.max(lead, prev.getTime() + (s.getTime() - prev.getTime()) / 2) : lead;
  });
  return slots
    .map((slot, i) => ({ slot, start: starts[i]!, end: starts[i + 1] ?? Infinity }))
    .filter((w) => w.slot.getTime() >= from.getTime() && w.slot.getTime() < to.getTime());
}

function evaluateSlots(
  schedule: Extract<Schedule, { kind: 'daily_slots' }>,
  completions: CompletionLike[],
  now: Date,
  tz: string,
): Omit<Evaluation, 'lastCompletion' | 'snoozed'> {
  const n = now.getTime();
  // Look back 8 days (weekday-only schedules) and ahead 8 days for the next slot.
  const slots = slotsBetween(schedule, addDays(now, -8), addDays(now, 8), tz);
  if (slots.length === 0) {
    return { status: 'upcoming', due: null, overdueAt: null, dueness: 0, coveredBy: null };
  }
  // Slot windows partition time: slot i owns [start_i, start_{i+1}), where start_i is
  // SLOT_LEAD_MS before the slot but never earlier than halfway from the previous slot.
  const starts = slots.map((s, i) => {
    const prev = slots[i - 1];
    const lead = s.getTime() - SLOT_LEAD_MS;
    return prev ? Math.max(lead, prev.getTime() + (s.getTime() - prev.getTime()) / 2) : lead;
  });
  let idx = -1;
  for (let i = 0; i < slots.length; i++) if (starts[i]! <= n) idx = i;

  const coverOf = (i: number): CompletionLike | null => {
    const start = starts[i]!;
    const end = starts[i + 1] ?? Infinity;
    return (
      completions.findLast((c) => {
        const t = Date.parse(c.doneAt);
        return t >= start && t < end;
      }) ?? null
    );
  };

  if (idx === -1) {
    const first = slots[0]!;
    return {
      status: statusFor(n, first.getTime(), first.getTime() + SLOT_GRACE_MS, SLOT_LEAD_MS),
      due: first,
      overdueAt: new Date(first.getTime() + SLOT_GRACE_MS),
      dueness: 0,
      coveredBy: null,
    };
  }

  const current = slots[idx]!;
  const covered = coverOf(idx);
  if (covered) {
    const next = slots[idx + 1] ?? addDays(current, 1);
    const start = Date.parse(covered.doneAt);
    return {
      status: 'done',
      due: next,
      overdueAt: new Date(next.getTime() + SLOT_GRACE_MS),
      dueness: clampDueness(start, next.getTime(), n),
      coveredBy: covered,
    };
  }
  const prev = slots[idx - 1];
  const start = prev ? prev.getTime() : current.getTime() - DAY;
  return {
    status: statusFor(n, current.getTime(), current.getTime() + SLOT_GRACE_MS, SLOT_LEAD_MS),
    due: current,
    overdueAt: new Date(current.getTime() + SLOT_GRACE_MS),
    dueness: clampDueness(start, current.getTime(), n),
    coveredBy: null,
  };
}

// ─── interval ───────────────────────────────────────────────────────────────

/** For day-granular units the due moment is the local start of the due day. */
function normalizeDue(d: Date, unit: IntervalUnit, tz: string): Date {
  return isDayGranular(unit) ? new Date(startOfDay(inTz(d, tz)).getTime()) : d;
}

function overdueMoment(due: Date, unit: IntervalUnit, graceDays: number, tz: string): Date {
  if (!isDayGranular(unit)) return new Date(due.getTime() + Math.max(HOUR, graceDays * DAY));
  // Due for the whole due day (+ grace days); overdue from the next local midnight.
  return new Date(startOfDay(addDays(inTz(due, tz), 1 + graceDays)).getTime());
}

/** k-th occurrence of a calendar-anchored schedule, computed from the start to avoid drift. */
function calendarOccurrence(
  start: Date,
  every: number,
  unit: IntervalUnit,
  k: number,
  tz: string,
): Date {
  // Month/year math must happen in the household timezone, not UTC.
  return new Date(addInterval(inTz(start, tz), every * k, unit).getTime());
}

/** Index of the last calendar occurrence at or before `t` (−1 if before the start). */
function calendarIndexAt(
  start: Date,
  every: number,
  unit: IntervalUnit,
  t: Date,
  tz: string,
): number {
  if (t.getTime() < start.getTime()) return -1;
  const s = inTz(start, tz);
  const x = inTz(t, tz);
  let k: number;
  switch (unit) {
    case 'hour':
      k = Math.floor(differenceInHours(x, s) / every);
      break;
    case 'day':
      k = Math.floor(differenceInCalendarDays(x, s) / every);
      break;
    case 'week':
      k = Math.floor(differenceInCalendarDays(x, s) / (7 * every));
      break;
    case 'month':
      k = Math.floor(differenceInCalendarMonths(x, s) / every);
      break;
    case 'year':
      k = Math.floor(differenceInCalendarMonths(x, s) / (12 * every));
      break;
  }
  // Correct for day-of-month / time-of-day boundaries.
  while (k > 0 && calendarOccurrence(s, every, unit, k, tz).getTime() > t.getTime()) k--;
  while (calendarOccurrence(s, every, unit, k + 1, tz).getTime() <= t.getTime()) k++;
  return k;
}

function evaluateInterval(
  schedule: Extract<Schedule, { kind: 'interval' }>,
  completions: CompletionLike[],
  now: Date,
  tz: string,
): Omit<Evaluation, 'lastCompletion' | 'snoozed'> {
  const { every, unit } = schedule;
  const grace = schedule.graceDays ?? 0;
  const n = now.getTime();
  const period = periodMs(every, unit);
  const soon = soonWindowMs(period);
  const start = normalizeDue(new Date(schedule.startDate), unit, tz);
  const last = completions.at(-1) ?? null;

  if (schedule.anchor === 'completion') {
    // Floating: next = last completion (or skip) + interval; before any completion, startDate.
    const due = last
      ? normalizeDue(addInterval(inTz(last.doneAt, tz), every, unit), unit, tz)
      : start;
    const overdueAt = overdueMoment(due, unit, grace, tz);
    const periodStart = last ? Date.parse(last.doneAt) : due.getTime() - period;
    const doneRecently =
      last !== null &&
      last.kind === 'done' &&
      (isDayGranular(unit)
        ? differenceInCalendarDays(inTz(now, tz), inTz(last.doneAt, tz)) === 0
        : n - Date.parse(last.doneAt) < Math.min(period / 2, 6 * HOUR));
    const status = statusFor(n, due.getTime(), overdueAt.getTime(), soon);
    return {
      status: doneRecently && status === 'upcoming' ? 'done' : status,
      due,
      overdueAt,
      dueness: clampDueness(periodStart, due.getTime(), n),
      coveredBy: null,
    };
  }

  // Calendar grid: occurrences start + k·interval. Missed occurrences don't pile up —
  // only the latest one that has started matters (Todoist `every` semantics).
  const k = calendarIndexAt(start, every, unit, new Date(n + soon), tz);
  if (k < 0) {
    return {
      status: statusFor(n, start.getTime(), overdueMoment(start, unit, grace, tz).getTime(), soon),
      due: start,
      overdueAt: overdueMoment(start, unit, grace, tz),
      dueness: 0,
      coveredBy: null,
    };
  }
  const occ = normalizeDue(calendarOccurrence(start, every, unit, k, tz), unit, tz);
  const nextOcc = normalizeDue(calendarOccurrence(start, every, unit, k + 1, tz), unit, tz);
  const prevOcc =
    k > 0 ? normalizeDue(calendarOccurrence(start, every, unit, k - 1, tz), unit, tz) : null;
  // A completion counts for `occ` if made within its "soon" lead window or later.
  const windowStart = Math.max(occ.getTime() - soon, prevOcc ? prevOcc.getTime() + 1 : -Infinity);
  const covered = completions.findLast((c) => Date.parse(c.doneAt) >= windowStart) ?? null;
  if (covered) {
    const overdueAt = overdueMoment(nextOcc, unit, grace, tz);
    const status = statusFor(n, nextOcc.getTime(), overdueAt.getTime(), soon);
    return {
      status: status === 'upcoming' ? 'done' : status,
      due: nextOcc,
      overdueAt,
      dueness: clampDueness(Date.parse(covered.doneAt), nextOcc.getTime(), n),
      coveredBy: covered,
    };
  }
  const overdueAt = overdueMoment(occ, unit, grace, tz);
  return {
    status: statusFor(n, occ.getTime(), overdueAt.getTime(), soon),
    due: occ,
    overdueAt,
    dueness: clampDueness(occ.getTime() - period, occ.getTime(), n),
    coveredBy: null,
  };
}

// ─── once ───────────────────────────────────────────────────────────────────

function evaluateOnce(
  schedule: Extract<Schedule, { kind: 'once' }>,
  completions: CompletionLike[],
  now: Date,
): Omit<Evaluation, 'lastCompletion' | 'snoozed'> {
  const at = new Date(schedule.at);
  const last = completions.at(-1) ?? null;
  if (last) return { status: 'done', due: null, overdueAt: null, dueness: 0, coveredBy: last };
  const overdueAt = new Date(at.getTime() + 2 * HOUR);
  return {
    status: statusFor(now.getTime(), at.getTime(), overdueAt.getTime(), DAY),
    due: at,
    overdueAt,
    dueness: clampDueness(at.getTime() - 7 * DAY, at.getTime(), now.getTime()),
    coveredBy: null,
  };
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Computes the status of a task from its schedule, completions and the current time.
 * This is the single source of truth for due dates (CLAUDE.md): nothing is stored.
 */
export function evaluate(
  schedule: Schedule,
  completions: readonly CompletionLike[],
  opts: EvaluateOptions,
): Evaluation {
  const { now, tz } = opts;
  const past = sortedCompletions(completions).filter((c) => Date.parse(c.doneAt) <= now.getTime());
  const base =
    schedule.kind === 'daily_slots'
      ? evaluateSlots(schedule, past, now, tz)
      : schedule.kind === 'interval'
        ? evaluateInterval(schedule, past, now, tz)
        : evaluateOnce(schedule, past, now);

  const snoozeUntil = opts.snoozedUntil ? Date.parse(opts.snoozedUntil) : NaN;
  const snoozed =
    Number.isFinite(snoozeUntil) &&
    snoozeUntil > now.getTime() &&
    (base.status === 'due' || base.status === 'overdue' || base.status === 'soon');

  return {
    ...base,
    status: snoozed ? 'upcoming' : base.status,
    lastCompletion: latest(past),
    snoozed,
  };
}

/** Convenience: the next due moment, or null for a finished one-off task. */
export function nextDue(
  schedule: Schedule,
  completions: readonly CompletionLike[],
  opts: EvaluateOptions,
): Date | null {
  return evaluate(schedule, completions, opts).due;
}

/**
 * Projected due moments within [from, to] for calendar views. Floating schedules are
 * projected from the current due date assuming each one is done on time.
 */
export function occurrences(
  schedule: Schedule,
  completions: readonly CompletionLike[],
  from: Date,
  to: Date,
  opts: EvaluateOptions,
): Date[] {
  const inRange = (d: Date) => d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
  switch (schedule.kind) {
    case 'once': {
      const at = new Date(schedule.at);
      return completions.length === 0 && inRange(at) ? [at] : [];
    }
    case 'daily_slots':
      return slotsBetween(schedule, from, to, opts.tz);
    case 'interval': {
      const out: Date[] = [];
      const { every, unit, anchor } = schedule;
      if (anchor === 'calendar') {
        const start = normalizeDue(new Date(schedule.startDate), unit, opts.tz);
        let k = Math.max(0, calendarIndexAt(start, every, unit, from, opts.tz));
        for (let guard = 0; guard < 10_000; guard++, k++) {
          const d = normalizeDue(calendarOccurrence(start, every, unit, k, opts.tz), unit, opts.tz);
          if (d.getTime() > to.getTime()) break;
          if (inRange(d)) out.push(d);
        }
        return out;
      }
      let d = evaluate(schedule, completions, opts).due;
      for (let guard = 0; d && guard < 10_000 && d.getTime() <= to.getTime(); guard++) {
        if (inRange(d)) out.push(d);
        d = normalizeDue(addInterval(inTz(d, opts.tz), every, unit), unit, opts.tz);
      }
      return out;
    }
  }
}

/** Sort key for the Today list: most urgent first (by dueness, then due date). */
export function urgencyCompare(a: Evaluation, b: Evaluation): number {
  const rank: Record<TaskStatus, number> = { overdue: 0, due: 1, soon: 2, upcoming: 3, done: 4 };
  if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
  if (a.dueness !== b.dueness) return b.dueness - a.dueness;
  return (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity);
}
