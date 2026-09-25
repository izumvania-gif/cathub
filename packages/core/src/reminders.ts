import { TZDate } from '@date-fns/tz';
import { evaluate, periodMs, type CompletionLike, type EvaluateOptions } from './engine';
import { parseTimeOfDay, type Schedule } from './schedule';

export type ReminderStage = 'before' | 'due' | 'overdue';

export interface ReminderDecision {
  stage: ReminderStage;
  /** The due moment this reminder is about; together with the stage it identifies the message. */
  occurrence: Date;
}

/** Tasks repeating at least this rarely get a heads-up while "soon" (vaccines, vet, litter change). */
const BEFORE_MIN_PERIOD_MS = 3 * 24 * 3_600_000;

/**
 * Which reminder (if any) should exist for a task right now. The caller sends each
 * (task, occurrence, stage, chat) at most once, so this can be evaluated every minute.
 */
export function reminderPlan(
  schedule: Schedule,
  completions: readonly CompletionLike[],
  opts: EvaluateOptions,
): ReminderDecision | null {
  const ev = evaluate(schedule, completions, opts);
  if (ev.snoozed || !ev.due) return null;
  switch (ev.status) {
    case 'overdue':
      return { stage: 'overdue', occurrence: ev.due };
    case 'due':
      return { stage: 'due', occurrence: ev.due };
    case 'soon': {
      const rare =
        schedule.kind === 'once' ||
        (schedule.kind === 'interval' &&
          periodMs(schedule.every, schedule.unit) >= BEFORE_MIN_PERIOD_MS);
      return rare ? { stage: 'before', occurrence: ev.due } : null;
    }
    default:
      return null;
  }
}

export interface QuietHours {
  /** "HH:MM" local time when quiet hours start, e.g. "23:00". */
  from: string;
  /** "HH:MM" local time when they end, e.g. "08:00". */
  to: string;
}

export const DEFAULT_QUIET_HOURS: QuietHours = { from: '23:00', to: '08:00' };

/** True if `now` falls into the quiet hours in the given timezone (handles overnight ranges). */
export function isQuietTime(
  now: Date,
  tz: string,
  quiet: QuietHours = DEFAULT_QUIET_HOURS,
): boolean {
  const from = parseTimeOfDay(quiet.from);
  const to = parseTimeOfDay(quiet.to);
  if (from === null || to === null || from === to) return false;
  const local = new TZDate(now.getTime(), tz);
  const m = local.getHours() * 60 + local.getMinutes();
  return from < to ? m >= from && m < to : m >= from || m < to;
}

/** Local calendar date "YYYY-MM-DD" in the given timezone. */
export function localDate(now: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
}

/**
 * Whether the morning digest should go out now: the local time has reached `digestTime` and
 * none was sent today. Returns the local date to record as sent, or null.
 * Late starts still send (e.g. the bot restarted at 09:40), but not after noon.
 */
export function digestDue(
  now: Date,
  tz: string,
  digestTime: string | null | undefined,
  sentOn: string | null | undefined,
): string | null {
  const at = digestTime ? parseTimeOfDay(digestTime) : null;
  if (at === null) return null;
  const today = localDate(now, tz);
  if (sentOn === today) return null;
  const local = new TZDate(now.getTime(), tz);
  const m = local.getHours() * 60 + local.getMinutes();
  const latest = Math.max(at + 180, 12 * 60);
  return m >= at && m < latest ? today : null;
}
