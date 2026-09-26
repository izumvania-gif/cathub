import { plausible } from '@cathub/core';
import { describe, expect, it } from 'vitest';
import {
  HELPERS,
  init,
  moveCat,
  place,
  ROWS,
  rowAt,
  rowY,
  SLOTS,
  stats,
  step,
  type State,
} from './logic';

const DT = 1 / 60;

/** A decent player: guard the row with the most urgent mouse, build kittens and posts. */
function smart(s: State) {
  const alive = s.mice.filter((m) => m.hp > 0);
  const urgency = (row: number) =>
    Math.min(999, ...alive.filter((m) => m.row === row).map((m) => m.x));
  const rows = [...Array(ROWS).keys()].sort((a, b) => urgency(a) - urgency(b));
  if (urgency(rows[0]!) < 110 && rows[0] !== s.cat.row) moveCat(s, rows[0]!);
  // A kitten for the busiest row without one, then posts in rows the cat isn't guarding.
  const kittens = (row: number) =>
    s.helpers.filter((h) => h.row === row && h.kind === 'kitten').length;
  const busiest = [...Array(ROWS).keys()].sort(
    (a, b) => kittens(a) - kittens(b) || urgency(a) - urgency(b),
  )[0]!;
  if (s.cheese >= HELPERS.kitten.cost && kittens(busiest) < 2) place(s, 'kitten', busiest);
  const second = rows[1]!;
  if (urgency(second) < 45 && s.cheese >= HELPERS.yarn.cost) place(s, 'yarn', second);
}

function play(seed: number, bot: ((s: State) => void) | null) {
  const s = init(seed, 220);
  let k = 0;
  while (!s.over && s.t < 900) {
    step(s, DT);
    if (bot && ++k % 18 === 0) bot(s); // a person reacts every ~0.3 s
  }
  return s;
}

describe('defense', () => {
  it('doing nothing loses the kitchen', () => {
    const s = play(1, null);
    expect(s.won).toBe(false);
    expect(s.cleared).toBeLessThan(3);
  });

  it('a decent player wins, and the result is believable', () => {
    const results = [1, 2, 3, 4, 5, 6].map((seed) => play(seed, smart));
    for (const s of results) expect(plausible('defense', stats(s), s.t * 1000)).toBe(true);
    const text = results.map((s) => `${s.cleared}/${s.food}`).join(' ');
    expect(results.filter((s) => s.won).length, text).toBeGreaterThanOrEqual(4);
  });

  it('helpers cost cheese and need a free cell', () => {
    const s = init(1, 220);
    s.cheese = 100;
    for (let i = 0; i < SLOTS.length; i++) expect(place(s, 'post', 0)).toBe(true);
    expect(place(s, 'post', 0)).toBe(false);
    expect(s.cheese).toBe(100 - 3 * HELPERS.post.cost);
  });

  it('a helper goes to the free cell nearest the tap, and taps map to the drawn shelves', () => {
    const s = init(1, 180);
    s.cheese = 100;
    expect(place(s, 'post', 1, SLOTS[2]! + 3)).toBe(true);
    expect(s.helpers.at(-1)!.slot).toBe(2);
    expect(place(s, 'post', 1, SLOTS[2]!)).toBe(true); // taken: the nearest free one
    expect(s.helpers.at(-1)!.slot).toBe(1);
    for (let r = 0; r < ROWS; r++) {
      expect(rowAt(180, rowY(180, r) - 1)).toBe(r); // just above the board
      expect(rowAt(180, rowY(180, r) - 20)).toBe(r); // high above it, still that shelf
    }
  });
});
