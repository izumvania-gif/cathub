import { evaluate, occurrences, periodMs, type CompletionLike } from './engine';
import type { Schedule } from './schedule';

/** Only rare tasks go to the phone calendar: daily chores would flood it. */
const MIN_PERIOD_MS = 7 * 24 * 3_600_000;

export interface CalendarTask {
  id: string;
  title: string;
  emoji?: string;
  schedule: Schedule;
  medical?: boolean;
  completions: readonly CompletionLike[];
}

export interface CalendarEvent {
  uid: string;
  /** Local date "YYYY-MM-DD" (all-day event) or an exact moment. */
  start: { date: string } | { at: Date };
  summary: string;
  description?: string;
  /** Days before for a reminder alarm (all-day events alarm at 09:00 the day before). */
  alarmDaysBefore?: number;
}

const localDate = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);

/** Events for rare tasks (every week or less often, and one-offs) within the horizon. */
export function calendarEvents(
  tasks: readonly CalendarTask[],
  opts: { now: Date; tz: string; horizonDays?: number; catName?: string },
): CalendarEvent[] {
  const { now, tz } = opts;
  const to = new Date(now.getTime() + (opts.horizonDays ?? 365) * 86_400_000);
  const events: CalendarEvent[] = [];
  for (const t of tasks) {
    const s = t.schedule;
    if (s.kind === 'daily_slots') continue;
    if (s.kind === 'interval' && periodMs(s.every, s.unit) < MIN_PERIOD_MS) continue;
    // Start from today's local midnight so an overdue task still shows today.
    const from = new Date(now.getTime() - 86_400_000);
    const ev = evaluate(s, t.completions, { now, tz });
    const dates = occurrences(s, t.completions, from, to, { now, tz });
    // An overdue floating task has its due date in the past; show it today instead.
    if (s.kind === 'interval' && ev.due && ev.due.getTime() < from.getTime()) dates.unshift(now);
    const title = `${t.emoji ? `${t.emoji} ` : ''}${t.title}${opts.catName ? ` — ${opts.catName}` : ''}`;
    for (const d of dates) {
      const allDay = s.kind === 'interval' && s.unit !== 'hour';
      events.push({
        uid: `${t.id}-${allDay ? localDate(d, tz) : d.getTime()}@cathub`,
        start: allDay ? { date: localDate(d, tz) } : { at: d },
        summary: title,
        description: t.medical ? 'Интервал — ориентир, уточните у ветеринара.' : undefined,
        alarmDaysBefore: t.medical ? 1 : undefined,
      });
    }
  }
  return events.sort((a, b) => startKey(a).localeCompare(startKey(b)));
}

const startKey = (e: CalendarEvent) =>
  'date' in e.start ? e.start.date : e.start.at.toISOString();

// ── RFC 5545 serialization ───────────────────────────────────────────────

function escapeText(s: string) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** UTF-8 byte length of one code point (no TextEncoder: core has no DOM/Node types). */
export function utf8Bytes(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/** Folds lines longer than 75 octets (RFC 5545 §3.1), never splitting a UTF-8 character. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = utf8Bytes(ch);
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** Serializes events into an iCalendar document (CRLF line endings). */
export function buildIcs(
  events: readonly CalendarEvent[],
  opts: { name: string; now: Date },
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CatHub//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    'X-PUBLISHED-TTL:PT6H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${utcStamp(opts.now)}`);
    if ('date' in e.start) {
      const d = e.start.date.replace(/-/g, '');
      const next = new Date(`${e.start.date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      lines.push(
        `DTSTART;VALUE=DATE:${d}`,
        `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`,
      );
    } else {
      lines.push(
        `DTSTART:${utcStamp(e.start.at)}`,
        `DTEND:${utcStamp(new Date(e.start.at.getTime() + 3_600_000))}`,
      );
    }
    lines.push(`SUMMARY:${escapeText(e.summary)}`, 'TRANSP:TRANSPARENT');
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.alarmDaysBefore) {
      // All-day: trigger relative to midnight, so -P1DT... would be odd; use -PT15H → 09:00 the day before.
      const trigger =
        'date' in e.start ? `-PT${e.alarmDaysBefore * 24 - 9}H` : `-P${e.alarmDaysBefore}D`;
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(e.summary)}`,
        `TRIGGER:${trigger}`,
        'END:VALARM',
      );
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
