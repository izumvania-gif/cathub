import { describe, expect, it } from 'vitest';
import { evaluate, occurrences, type CompletionLike } from './engine';
import type { Schedule } from './schedule';

const TZ = 'Europe/Moscow'; // UTC+3, no DST
/** Moscow local time → Date. */
const msk = (s: string) => new Date(`${s}+03:00`);
const done = (s: string): CompletionLike => ({ doneAt: msk(s).toISOString(), kind: 'done' });
const skip = (s: string): CompletionLike => ({ doneAt: msk(s).toISOString(), kind: 'skipped' });
const at = (now: string) => ({ now: msk(now), tz: TZ });

const feeding: Schedule = { kind: 'daily_slots', times: ['08:00', '20:00'] };

describe('daily slots (feeding 08:00 and 20:00)', () => {
  it('is soon shortly before the slot and due at the slot', () => {
    expect(evaluate(feeding, [], at('2026-09-25T07:00:00')).status).toBe('soon');
    const ev = evaluate(feeding, [], at('2026-09-25T08:10:00'));
    expect(ev.status).toBe('due');
    expect(ev.due).toEqual(msk('2026-09-25T08:00:00'));
  });

  it('is overdue an hour after the slot', () => {
    expect(evaluate(feeding, [], at('2026-09-25T09:30:00')).status).toBe('overdue');
  });

  it('a completion covers the current slot and points to the next one', () => {
    const ev = evaluate(feeding, [done('2026-09-25T08:12:00')], at('2026-09-25T10:00:00'));
    expect(ev.status).toBe('done');
    expect(ev.coveredBy?.doneAt).toBe(msk('2026-09-25T08:12:00').toISOString());
    expect(ev.due).toEqual(msk('2026-09-25T20:00:00'));
  });

  it('completing a bit early still counts for the slot', () => {
    const ev = evaluate(feeding, [done('2026-09-25T07:20:00')], at('2026-09-25T08:30:00'));
    expect(ev.status).toBe('done');
  });

  it('the morning feeding does not cover the evening slot', () => {
    const ev = evaluate(feeding, [done('2026-09-25T08:05:00')], at('2026-09-25T20:30:00'));
    expect(ev.status).toBe('due');
    expect(ev.due).toEqual(msk('2026-09-25T20:00:00'));
  });

  it('exposes the covering completion so the UI can warn about double feeding', () => {
    const ev = evaluate(feeding, [done('2026-09-25T19:55:00')], at('2026-09-25T20:10:00'));
    expect(ev.coveredBy).not.toBeNull();
  });

  it('respects weekdays', () => {
    const weekend: Schedule = { kind: 'daily_slots', times: ['10:00'], weekdays: [6, 7] };
    // 2026-09-25 is a Friday → next slot is Saturday 10:00
    const ev = evaluate(weekend, [done('2026-09-20T10:00:00')], at('2026-09-25T12:00:00'));
    expect(ev.due).toEqual(msk('2026-09-26T10:00:00'));
  });

  it('ignores completions in the future', () => {
    const ev = evaluate(feeding, [done('2026-09-25T20:00:00')], at('2026-09-25T08:30:00'));
    expect(ev.status).toBe('due');
  });
});

describe('interval anchored on completion (floating)', () => {
  const litter: Schedule = {
    kind: 'interval',
    every: 14,
    unit: 'day',
    anchor: 'completion',
    startDate: msk('2026-09-20T00:00:00').toISOString(),
    graceDays: 3,
  };

  it('before any completion the start date is the first due date', () => {
    const ev = evaluate(litter, [], at('2026-09-19T12:00:00'));
    expect(ev.due).toEqual(msk('2026-09-20T00:00:00'));
    expect(ev.status).toBe('soon');
  });

  it('next due = last completion + interval, at local start of day', () => {
    const ev = evaluate(litter, [done('2026-09-10T21:30:00')], at('2026-09-12T12:00:00'));
    expect(ev.due).toEqual(msk('2026-09-24T00:00:00'));
    expect(ev.status).toBe('upcoming');
  });

  it('is due for the due day plus grace days, then overdue', () => {
    const c = [done('2026-09-10T21:30:00')];
    expect(evaluate(litter, c, at('2026-09-24T09:00:00')).status).toBe('due');
    expect(evaluate(litter, c, at('2026-09-27T23:59:00')).status).toBe('due');
    expect(evaluate(litter, c, at('2026-09-28T00:00:00')).status).toBe('overdue');
  });

  it('a backdated completion recalculates from its own date', () => {
    const c = [done('2026-09-10T21:30:00'), done('2026-09-24T20:00:00')];
    // recorded later but "done yesterday": order of insertion must not matter
    const ev = evaluate(litter, [c[1]!, c[0]!], at('2026-09-25T10:00:00'));
    expect(ev.due).toEqual(msk('2026-10-08T00:00:00'));
  });

  it('shows as done on the day it was completed', () => {
    const ev = evaluate(litter, [done('2026-09-25T09:00:00')], at('2026-09-25T18:00:00'));
    expect(ev.status).toBe('done');
    expect(evaluate(litter, [done('2026-09-25T09:00:00')], at('2026-09-26T09:00:00')).status).toBe(
      'upcoming',
    );
  });

  it('a skip moves the next due date like a completion', () => {
    const ev = evaluate(litter, [skip('2026-09-25T09:00:00')], at('2026-09-25T10:00:00'));
    expect(ev.due).toEqual(msk('2026-10-09T00:00:00'));
    expect(ev.status).toBe('upcoming');
  });

  it('Jan 31 + 1 month = end of February', () => {
    const monthly: Schedule = { ...litter, every: 1, unit: 'month', graceDays: 0 };
    expect(evaluate(monthly, [done('2027-01-31T10:00:00')], at('2027-02-01T10:00:00')).due).toEqual(
      msk('2027-02-28T00:00:00'),
    );
    expect(evaluate(monthly, [done('2028-01-31T10:00:00')], at('2028-02-01T10:00:00')).due).toEqual(
      msk('2028-02-29T00:00:00'),
    );
  });

  it('Feb 29 + 1 year = Feb 28', () => {
    const yearly: Schedule = { ...litter, every: 1, unit: 'year', graceDays: 0 };
    expect(evaluate(yearly, [done('2028-02-29T10:00:00')], at('2028-03-01T10:00:00')).due).toEqual(
      msk('2029-02-28T00:00:00'),
    );
  });

  it('yearly tasks become "soon" two weeks ahead, not earlier', () => {
    const yearly: Schedule = { ...litter, every: 1, unit: 'year', graceDays: 14 };
    const c = [done('2025-10-15T12:00:00')];
    expect(evaluate(yearly, c, at('2026-09-25T12:00:00')).status).toBe('upcoming');
    expect(evaluate(yearly, c, at('2026-10-02T12:00:00')).status).toBe('soon');
  });

  it('dueness grows from 0 to 1 over the period', () => {
    const c = [done('2026-09-10T00:00:00')];
    expect(evaluate(litter, c, at('2026-09-10T00:00:00')).dueness).toBeCloseTo(0);
    expect(evaluate(litter, c, at('2026-09-17T00:00:00')).dueness).toBeCloseTo(0.5, 1);
    expect(evaluate(litter, c, at('2026-09-24T00:00:00')).dueness).toBeCloseTo(1);
    expect(evaluate(litter, c, at('2026-10-01T00:00:00')).dueness).toBeGreaterThan(1);
  });

  it('hour units use exact timestamps', () => {
    const scoop: Schedule = {
      kind: 'interval',
      every: 12,
      unit: 'hour',
      anchor: 'completion',
      startDate: msk('2026-09-25T00:00:00').toISOString(),
    };
    const ev = evaluate(scoop, [done('2026-09-25T09:15:00')], at('2026-09-25T10:00:00'));
    expect(ev.due).toEqual(msk('2026-09-25T21:15:00'));
  });
});

describe('interval anchored on calendar', () => {
  const firstOfMonth: Schedule = {
    kind: 'interval',
    every: 1,
    unit: 'month',
    anchor: 'calendar',
    startDate: msk('2026-01-01T00:00:00').toISOString(),
    graceDays: 2,
  };

  it('uses the grid regardless of when it was done', () => {
    const ev = evaluate(firstOfMonth, [done('2026-09-03T12:00:00')], at('2026-09-10T12:00:00'));
    expect(ev.status).toBe('done');
    expect(ev.due).toEqual(msk('2026-10-01T00:00:00'));
  });

  it('missed occurrences do not pile up: only the latest counts', () => {
    const ev = evaluate(firstOfMonth, [done('2026-05-01T12:00:00')], at('2026-09-10T12:00:00'));
    expect(ev.status).toBe('overdue');
    expect(ev.due).toEqual(msk('2026-09-01T00:00:00'));
  });

  it('completing within the soon window counts for the upcoming occurrence', () => {
    const ev = evaluate(firstOfMonth, [done('2026-09-29T12:00:00')], at('2026-09-30T12:00:00'));
    expect(ev.status).toBe('done');
    expect(ev.due).toEqual(msk('2026-11-01T00:00:00'));
  });

  it('does not drift on short months (31st stays the 31st when possible)', () => {
    const on31: Schedule = { ...firstOfMonth, startDate: msk('2026-01-31T00:00:00').toISOString() };
    const occ = occurrences(
      on31,
      [],
      msk('2026-01-01T00:00:00'),
      msk('2026-05-31T23:00:00'),
      at('2026-01-01T00:00:00'),
    );
    expect(occ).toEqual([
      msk('2026-01-31T00:00:00'),
      msk('2026-02-28T00:00:00'),
      msk('2026-03-31T00:00:00'),
      msk('2026-04-30T00:00:00'),
      msk('2026-05-31T00:00:00'),
    ]);
  });
});

describe('once', () => {
  const vet: Schedule = { kind: 'once', at: msk('2026-10-12T15:30:00').toISOString() };

  it('is upcoming, soon the day before, due at the time, done once completed', () => {
    expect(evaluate(vet, [], at('2026-10-01T10:00:00')).status).toBe('upcoming');
    expect(evaluate(vet, [], at('2026-10-11T18:00:00')).status).toBe('soon');
    expect(evaluate(vet, [], at('2026-10-12T15:40:00')).status).toBe('due');
    expect(evaluate(vet, [], at('2026-10-12T19:00:00')).status).toBe('overdue');
    const ev = evaluate(vet, [done('2026-10-12T16:30:00')], at('2026-10-12T19:00:00'));
    expect(ev.status).toBe('done');
    expect(ev.due).toBeNull();
  });
});

describe('snooze', () => {
  it('hides a due task until the snooze ends', () => {
    const opts = {
      ...at('2026-09-25T08:30:00'),
      snoozedUntil: msk('2026-09-25T09:30:00').toISOString(),
    };
    const ev = evaluate(feeding, [], opts);
    expect(ev.snoozed).toBe(true);
    expect(ev.status).toBe('upcoming');
    expect(evaluate(feeding, [], { ...opts, now: msk('2026-09-25T09:31:00') }).snoozed).toBe(false);
  });
});

describe('timezone', () => {
  it('slots are local to the household timezone', () => {
    const ev = evaluate(feeding, [], {
      now: new Date('2026-09-25T05:10:00Z'),
      tz: 'Asia/Yekaterinburg',
    });
    // 05:10Z = 10:10 in Yekaterinburg (UTC+5): the 08:00 slot is overdue
    expect(ev.due).toEqual(new Date('2026-09-25T03:00:00Z'));
    expect(ev.status).toBe('overdue');
  });
});

describe('occurrences for floating schedules', () => {
  it('projects from the next due date', () => {
    const s: Schedule = {
      kind: 'interval',
      every: 1,
      unit: 'week',
      anchor: 'completion',
      startDate: msk('2026-09-01T00:00:00').toISOString(),
    };
    const occ = occurrences(
      s,
      [done('2026-09-20T10:00:00')],
      msk('2026-09-25T00:00:00'),
      msk('2026-10-20T00:00:00'),
      at('2026-09-25T00:00:00'),
    );
    expect(occ).toEqual([
      msk('2026-09-27T00:00:00'),
      msk('2026-10-04T00:00:00'),
      msk('2026-10-11T00:00:00'),
      msk('2026-10-18T00:00:00'),
    ]);
  });
});
