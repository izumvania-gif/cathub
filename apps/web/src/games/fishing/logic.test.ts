import { plausible } from '@cathub/core';
import { describe, expect, it } from 'vitest';
import { DURATION, inBand, init, multiplier, stats, step, tap } from './logic';

const DT = 1 / 60;

function play(seed: number, policy: (s: ReturnType<typeof init>) => boolean) {
  const s = init(seed, 220);
  while (!s.over) {
    step(s, DT);
    if (policy(s)) tap(s);
  }
  return s;
}

describe('fishing', () => {
  it('ends after 45 seconds', () => {
    const s = play(1, () => false);
    expect(s.t).toBeGreaterThanOrEqual(DURATION);
    expect(s.caught).toBe(0);
  });

  it('a sharp player can reach the top achievement, and the result stays believable', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      // Tap when a non-ruff fish is in the band.
      const s = play(seed, (s) => {
        const f = inBand(s);
        return Boolean(f && f.kind !== 'ruff');
      });
      expect(s.caught).toBeGreaterThanOrEqual(30);
      expect(s.bestStreak).toBeGreaterThanOrEqual(10);
      expect(plausible('fishing', stats(s), s.t * 1000)).toBe(true);
    }
  });

  it('tapping nonstop earns little: a miss rests the paw', () => {
    for (const seed of [7, 8, 9]) {
      let k = 0;
      const s = play(seed, () => ++k % 15 === 0); // four taps a second
      expect(s.caught).toBeLessThan(15);
      expect(s.bestStreak).toBeLessThan(10);
    }
  });

  it('the multiplier grows every three catches up to ×4', () => {
    expect([0, 2, 3, 6, 9, 30].map(multiplier)).toEqual([1, 1, 2, 3, 4, 4]);
  });
});
