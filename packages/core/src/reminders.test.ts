import { describe, expect, it } from 'vitest';
import { digestDue, isQuietTime, localDate, reminderPlan } from './reminders';
import type { Schedule } from './schedule';

const TZ = 'Europe/Moscow';
const msk = (s: string) => new Date(`${s}+03:00`);
const at = (s: string) => ({ now: msk(s), tz: TZ });
const done = (s: string) => ({ doneAt: msk(s).toISOString(), kind: 'done' as const });

const feeding: Schedule = { kind: 'daily_slots', times: ['08:00', '20:00'] };
const vaccine: Schedule = {
  kind: 'interval',
  every: 1,
  unit: 'year',
  anchor: 'completion',
  startDate: msk('2025-01-01T00:00:00').toISOString(),
  graceDays: 14,
};

describe('reminderPlan', () => {
  it('nothing before a daily slot, due at the slot, overdue an hour later', () => {
    expect(reminderPlan(feeding, [], at('2026-09-25T07:30:00'))).toBeNull();
    expect(reminderPlan(feeding, [], at('2026-09-25T08:05:00'))).toEqual({
      stage: 'due',
      occurrence: msk('2026-09-25T08:00:00'),
    });
    expect(reminderPlan(feeding, [], at('2026-09-25T09:05:00'))?.stage).toBe('overdue');
  });

  it('nothing once the slot is covered', () => {
    expect(
      reminderPlan(feeding, [done('2026-09-25T08:02:00')], at('2026-09-25T09:05:00')),
    ).toBeNull();
  });

  it('rare tasks get a heads-up while soon', () => {
    const c = [done('2025-10-10T12:00:00')];
    expect(reminderPlan(vaccine, c, at('2026-09-20T12:00:00'))).toBeNull();
    expect(reminderPlan(vaccine, c, at('2026-10-01T12:00:00'))).toEqual({
      stage: 'before',
      occurrence: msk('2026-10-10T00:00:00'),
    });
    expect(reminderPlan(vaccine, c, at('2026-10-10T10:00:00'))?.stage).toBe('due');
  });

  it('respects snoozes', () => {
    const opts = {
      ...at('2026-09-25T08:30:00'),
      snoozedUntil: msk('2026-09-25T09:30:00').toISOString(),
    };
    expect(reminderPlan(feeding, [], opts)).toBeNull();
  });
});

describe('isQuietTime', () => {
  it('handles overnight ranges', () => {
    expect(isQuietTime(msk('2026-09-25T23:30:00'), TZ)).toBe(true);
    expect(isQuietTime(msk('2026-09-25T03:00:00'), TZ)).toBe(true);
    expect(isQuietTime(msk('2026-09-25T08:00:00'), TZ)).toBe(false);
    expect(isQuietTime(msk('2026-09-25T14:00:00'), TZ)).toBe(false);
  });

  it('handles same-day ranges and disabled ranges', () => {
    expect(isQuietTime(msk('2026-09-25T14:00:00'), TZ, { from: '13:00', to: '15:00' })).toBe(true);
    expect(isQuietTime(msk('2026-09-25T14:00:00'), TZ, { from: '00:00', to: '00:00' })).toBe(false);
  });
});

describe('digestDue', () => {
  it('sends once per day from the digest time', () => {
    expect(digestDue(msk('2026-09-25T08:59:00'), TZ, '09:00', null)).toBeNull();
    expect(digestDue(msk('2026-09-25T09:00:00'), TZ, '09:00', null)).toBe('2026-09-25');
    expect(digestDue(msk('2026-09-25T09:30:00'), TZ, '09:00', '2026-09-25')).toBeNull();
    expect(digestDue(msk('2026-09-26T09:01:00'), TZ, '09:00', '2026-09-25')).toBe('2026-09-26');
  });

  it('is off without a time and does not fire late in the day', () => {
    expect(digestDue(msk('2026-09-25T09:00:00'), TZ, '', null)).toBeNull();
    expect(digestDue(msk('2026-09-25T15:00:00'), TZ, '09:00', null)).toBeNull();
  });

  it('uses the local date of the household timezone', () => {
    // 23:30 UTC on the 24th is already 02:30 on the 25th in Moscow
    expect(localDate(new Date('2026-09-24T23:30:00Z'), TZ)).toBe('2026-09-25');
  });
});
