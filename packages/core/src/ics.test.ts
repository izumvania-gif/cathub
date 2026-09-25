import { describe, expect, it } from 'vitest';
import { buildIcs, calendarEvents, utf8Bytes, type CalendarTask } from './ics';

const TZ = 'Europe/Moscow';
const msk = (s: string) => new Date(`${s}+03:00`);
const done = (s: string) => ({ doneAt: msk(s).toISOString(), kind: 'done' as const });
const start = msk('2026-01-01T00:00:00').toISOString();

const tasks: CalendarTask[] = [
  {
    id: 'feed',
    title: 'Покормить',
    schedule: { kind: 'daily_slots', times: ['08:00'] },
    completions: [],
  },
  {
    id: 'brush',
    title: 'Вычесать',
    schedule: { kind: 'interval', every: 3, unit: 'day', anchor: 'completion', startDate: start },
    completions: [],
  },
  {
    id: 'rabies',
    title: 'Прививка от бешенства',
    emoji: '💉',
    medical: true,
    schedule: { kind: 'interval', every: 1, unit: 'year', anchor: 'completion', startDate: start },
    completions: [done('2025-10-10T12:00:00')],
  },
  {
    id: 'nails',
    title: 'Когти',
    schedule: { kind: 'interval', every: 14, unit: 'day', anchor: 'completion', startDate: start },
    completions: [done('2026-09-20T12:00:00')],
  },
  {
    id: 'vet',
    title: 'Ветеринар',
    schedule: { kind: 'once', at: msk('2026-10-12T15:30:00').toISOString() },
    completions: [],
  },
];

describe('calendarEvents', () => {
  const events = calendarEvents(tasks, {
    now: msk('2026-09-25T12:00:00'),
    tz: TZ,
    horizonDays: 60,
    catName: 'Барсик',
  });

  it('skips daily and frequent chores', () => {
    expect(events.some((e) => e.uid.startsWith('feed-') || e.uid.startsWith('brush-'))).toBe(false);
  });

  it('includes rare tasks as all-day events on local dates', () => {
    expect(events.find((e) => e.uid.startsWith('rabies-'))).toMatchObject({
      start: { date: '2026-10-10' },
      summary: '💉 Прививка от бешенства — Барсик',
      alarmDaysBefore: 1,
    });
    expect(
      events
        .filter((e) => e.uid.startsWith('nails-'))
        .map((e) => (e.start as { date: string }).date),
    ).toEqual(['2026-10-04', '2026-10-18', '2026-11-01', '2026-11-15']);
  });

  it('includes one-off appointments with their time', () => {
    expect(events.find((e) => e.uid.startsWith('vet-'))?.start).toEqual({
      at: msk('2026-10-12T15:30:00'),
    });
  });

  it('shows an overdue floating task today', () => {
    const overdue = calendarEvents([{ ...tasks[3]!, completions: [done('2026-08-01T12:00:00')] }], {
      now: msk('2026-09-25T12:00:00'),
      tz: TZ,
      horizonDays: 10,
    });
    expect(overdue[0]?.start).toEqual({ date: '2026-09-25' });
  });
});

describe('utf8Bytes', () => {
  it('counts UTF-8 bytes per code point', () => {
    expect(['a', 'б', '€', '💉'].map(utf8Bytes)).toEqual([1, 2, 3, 4]);
  });
});

describe('buildIcs', () => {
  it('produces a valid, folded iCalendar document', () => {
    const now = msk('2026-09-25T12:00:00');
    const ics = buildIcs(
      calendarEvents(tasks, { now, tz: TZ, horizonDays: 60, catName: 'Барсик' }),
      {
        name: 'CatHub: Барсик',
        now,
      },
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261010');
    expect(ics).toContain('DTEND;VALUE=DATE:20261011');
    expect(ics).toContain('DTSTART:20261012T123000Z');
    expect(ics).toContain('TRIGGER:-PT15H');
    for (const line of ics.split('\r\n'))
      expect([...line].reduce((n, ch) => n + utf8Bytes(ch), 0)).toBeLessThanOrEqual(75);
    expect(ics.split('BEGIN:VEVENT').length - 1).toBe(ics.split('END:VEVENT').length - 1);
  });

  it('escapes special characters', () => {
    const ics = buildIcs([{ uid: 'x', start: { date: '2026-01-01' }, summary: 'a, b; c\\d\ne' }], {
      name: 'n',
      now: new Date(0),
    });
    expect(ics).toContain('SUMMARY:a\\, b\\; c\\\\d\\ne');
  });
});
