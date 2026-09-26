import { plausible } from '@cathub/core';
import { describe, expect, it } from 'vitest';
import { init, JUMP, GRAVITY, PLAT_W, score, stats, step, W, type State } from './logic';

const DT = 1 / 60;

/** A simple bot: steer to the best shelf to land on. */
function steer(s: State): number {
  // The highest solid shelf below the top of this jump.
  const peak = s.vy < 0 ? s.y - (s.vy * s.vy) / (2 * GRAVITY) : s.y;
  const wrap = (d: number) => (d > W / 2 ? d - W : d < -W / 2 ? d + W : d);
  // Keep clear of a vacuum in the way.
  const danger = s.things.find(
    (v) =>
      v.kind === 'vacuum' &&
      !v.gone &&
      v.y > peak - 10 &&
      v.y < s.y + 20 &&
      Math.abs(wrap(v.x - s.x)) < 22,
  );
  if (danger && !(s.vy > 0 && s.y < danger.y - 10)) return -Math.sign(wrap(danger.x - s.x)) || 1;
  const target = s.plats
    .filter((p) => p.kind !== 'fragile' && p.broken === null && p.y >= peak + 3 && p.y < s.y + 150)
    .sort((a, b) => a.y - b.y)[0];
  if (!target) return 0;
  const cx = target.x + PLAT_W / 2;
  let dx = cx - s.x;
  if (dx > W / 2) dx -= W;
  if (dx < -W / 2) dx += W;
  return Math.abs(dx) < 3 ? 0 : Math.sign(dx);
}

function run(seed: number, seconds: number) {
  const s = init(seed, 220);
  while (!s.over && s.t < seconds) step(s, DT, s.over ? 0 : steer(s));
  return s;
}

describe('jump', () => {
  it('path shelves are always within reach', () => {
    const s = init(3, 220);
    for (let i = 0; i < 20_000 && s.plats.length; i++) {
      s.camY -= 5;
      step(s, 0, 0); // generate more without moving the cat much
      if (s.over) break;
    }
    // The gap between consecutive path shelves never exceeds the jump height.
    const reach = (JUMP * JUMP) / (2 * GRAVITY);
    const path = s.plats
      .filter((p) => p.kind !== 'fragile')
      .map((p) => p.y)
      .sort((a, b) => b - a);
    for (let i = 1; i < path.length; i++) expect(path[i - 1]! - path[i]!).toBeLessThan(reach);
  });

  it('a steady bot climbs high, and the result stays believable', () => {
    const scores = [1, 2, 3, 4, 5, 6].map((seed) => {
      const s = run(seed, 400);
      expect(plausible('jump', stats(s), s.t * 1000)).toBe(true);
      return score(s);
    });
    // A simple bot gets close to the top achievement (1000); a person can pass it.
    expect(Math.max(...scores)).toBeGreaterThanOrEqual(700);
    expect(scores.filter((x) => x >= 200).length).toBeGreaterThanOrEqual(5);
  });

  it('standing still just bounces on the first shelf', () => {
    const s = init(9, 220);
    while (s.t < 60) step(s, DT, 0);
    expect(s.over).toBe(false);
    expect(score(s)).toBeLessThan(20);
  });
});
