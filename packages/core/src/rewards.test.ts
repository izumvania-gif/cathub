import { describe, expect, it } from 'vitest';
import type { CompletionLike } from './engine';
import {
  localDayBounds,
  perfectDay,
  rewardFor,
  rewardNow,
  ROOM_CATALOG,
  STARTER_ITEMS,
  taskWeight,
} from './rewards';
import type { Schedule } from './schedule';

const TZ = 'Europe/Moscow';
const msk = (s: string) => new Date(`${s}+03:00`);
const done = (s: string): CompletionLike => ({ doneAt: msk(s).toISOString(), kind: 'done' });
const feeding: Schedule = { kind: 'daily_slots', times: ['08:00', '20:00'] };

const reward = (c: CompletionLike, others: CompletionLike[], weight: 1 | 2 | 3 = 1) =>
  rewardFor({ schedule: feeding, weight, others, completion: c, tz: TZ });

describe('rewards', () => {
  it('pays weight × 5, with a bonus for being on time', () => {
    expect(reward(done('2026-09-25T08:10:00'), [])).toBe(8); // 5 × 1.5, rounded
    expect(reward(done('2026-09-25T08:10:00'), [], 2)).toBe(15);
    // An hour after the slot it is overdue: no bonus.
    expect(reward(done('2026-09-25T09:30:00'), [], 2)).toBe(10);
  });

  it('pays nothing for a second mark of the same slot, or for a skip', () => {
    const first = done('2026-09-25T08:05:00');
    const second = done('2026-09-25T08:20:00');
    expect(reward(second, [first, second])).toBe(0);
    expect(reward(first, [first, second])).toBe(8); // the later one doesn't affect the first
    expect(reward({ ...first, kind: 'skipped' }, [])).toBe(0);
  });

  it('predicts the reward for marking now', () => {
    expect(rewardNow(feeding, 1, [], msk('2026-09-25T20:05:00'), TZ)).toBe(8);
    expect(
      rewardNow(feeding, 1, [done('2026-09-25T20:01:00')], msk('2026-09-25T20:05:00'), TZ),
    ).toBe(0);
  });

  it('weights: explicit, by template, by category, default', () => {
    expect(taskWeight({ weight: 3, template_key: 'water' })).toBe(3);
    expect(taskWeight({ template_key: 'litter_change' })).toBe(3);
    expect(taskWeight({ template_key: 'water' })).toBe(1);
    expect(taskWeight({ category: 'vet' })).toBe(3);
    expect(taskWeight({ category: 'other', weight: 0 })).toBe(1);
  });

  it('a perfect day needs every daily slot covered', () => {
    const start = msk('2026-09-25T00:00:00');
    const end = msk('2026-09-26T00:00:00');
    const both = [done('2026-09-25T08:05:00'), done('2026-09-25T21:30:00')];
    expect(perfectDay([{ schedule: feeding, completions: both }], start, end, TZ)).toBe(true);
    expect(perfectDay([{ schedule: feeding, completions: both.slice(0, 1) }], start, end, TZ)).toBe(
      false,
    );
    expect(perfectDay([], start, end, TZ)).toBe(false);
  });

  it('starter items are free', () => {
    expect(STARTER_ITEMS).toEqual(['window', 'box', 'ball']);
    expect(ROOM_CATALOG.aquarium).toBeGreaterThan(ROOM_CATALOG.bed);
  });
});

describe('localDayBounds', () => {
  it('is the local midnight to midnight', () => {
    const [a, b] = localDayBounds('2026-09-25', TZ);
    expect(a).toEqual(msk('2026-09-25T00:00:00'));
    expect(b).toEqual(msk('2026-09-26T00:00:00'));
  });
});
