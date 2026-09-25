import { evaluate, type Schedule } from '@cathub/core';
import { describe, expect, it } from 'vitest';
import type { BoardItem } from './board';
import { catMood } from './catMood';
import type { Completion, Task } from './types';

const TZ = 'Europe/Moscow';
const msk = (s: string) => new Date(`${s}+03:00`);

function item(schedule: Schedule, done: string[], now: Date, task: Partial<Task> = {}): BoardItem {
  const completions = done.map(
    (d, i) => ({ id: `c${i}`, done_at: msk(d).toISOString(), kind: 'done' }) as Completion,
  );
  const ev = evaluate(
    schedule,
    completions.map((c) => ({ doneAt: c.done_at, kind: c.kind })),
    { now, tz: TZ },
  );
  const covered = ev.coveredBy
    ? (completions.find((c) => c.done_at === ev.coveredBy!.doneAt) ?? null)
    : null;
  return {
    task: {
      id: task.title ?? 'x',
      title: 'x',
      category: 'other',
      template_key: '',
      ...task,
    } as Task,
    ev,
    who: { user: null, source: 'anyone' },
    last: completions.at(-1) ?? null,
    covered,
  };
}

const feedingSchedule: Schedule = { kind: 'daily_slots', times: ['08:00', '20:00'] };
const litterSchedule: Schedule = { kind: 'daily_slots', times: ['09:00'] };
const feed = (done: string[], now: Date) =>
  item(feedingSchedule, done, now, {
    template_key: 'feeding',
    category: 'feeding',
    title: 'Покормить',
  });
const litter = (done: string[], now: Date) =>
  item(litterSchedule, done, now, { category: 'litter', title: 'Убрать лоток' });

describe('catMood', () => {
  it('fed right after feeding, for half an hour', () => {
    const now = msk('2026-09-25T08:20:00');
    expect(catMood([feed(['2026-09-25T08:05:00'], now)], now, TZ)).toBe('fed');
    const later = msk('2026-09-25T09:00:00');
    expect(catMood([feed(['2026-09-25T08:05:00'], later)], later, TZ)).not.toBe('fed');
  });

  it('hungry when feeding is due, even if the litter is overdue too', () => {
    const now = msk('2026-09-25T20:30:00');
    expect(
      catMood([feed(['2026-09-25T08:05:00'], now), litter(['2026-09-24T09:00:00'], now)], now, TZ),
    ).toBe('hungry');
  });

  it('grumpy when the litter is overdue', () => {
    const now = msk('2026-09-25T13:00:00');
    expect(
      catMood([feed(['2026-09-25T08:05:00'], now), litter(['2026-09-24T09:00:00'], now)], now, TZ),
    ).toBe('grumpy');
  });

  it('restless with other overdue chores', () => {
    const now = msk('2026-09-25T13:00:00');
    const brush = item({ kind: 'daily_slots', times: ['09:00'] }, [], now, {
      category: 'grooming',
    });
    expect(catMood([feed(['2026-09-25T08:05:00'], now), brush], now, TZ)).toBe('restless');
  });

  it('sleepy at night when nothing is overdue', () => {
    const now = msk('2026-09-26T02:00:00');
    expect(catMood([feed(['2026-09-25T20:05:00'], now)], now, TZ)).toBe('sleepy');
  });

  it('happy when everything due is done, calm otherwise', () => {
    const now = msk('2026-09-25T13:00:00');
    expect(
      catMood([feed(['2026-09-25T08:05:00'], now), litter(['2026-09-25T09:10:00'], now)], now, TZ),
    ).toBe('happy');
    expect(catMood([], now, TZ)).toBe('calm');
  });
});
