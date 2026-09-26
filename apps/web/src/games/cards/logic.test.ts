import { plausible } from '@cathub/core';
import { describe, expect, it } from 'vitest';
import {
  CARDS,
  canPlay,
  chooseRoom,
  endTurn,
  intentOf,
  leaveBox,
  newRun,
  playCard,
  removeCard,
  rest,
  stats,
  takeReward,
  type Run,
} from './logic';

/** A reasonable player: block what's coming, otherwise attack; take attacks as rewards. */
function bot(r: Run) {
  let guard = 0;
  while (r.phase !== 'over' && guard++ < 5000) {
    if (r.phase === 'map') {
      const i = r.choices.findIndex((c) => (r.hp < r.maxHp * 0.5 ? c === 'rest' : c === 'box'));
      chooseRoom(r, Math.max(0, i));
    } else if (r.phase === 'fight') {
      const f = r.fight!;
      const intent = intentOf(f.enemy);
      const incoming =
        intent.kind === 'atk'
          ? intent.dmg * (intent.times ?? 1)
          : intent.kind === 'def'
            ? (intent.dmg ?? 0)
            : 0;
      const order = f.hand
        .map((c, i) => ({ c, i }))
        .filter(({ i }) => canPlay(r, i))
        .sort((a, b) => {
          const needBlock = f.block < incoming;
          const val = (k: typeof a.c) =>
            (CARDS[k].cost === 0 ? 5 : 0) +
            (needBlock ? (CARDS[k].block ?? 0) : (CARDS[k].dmg ?? 0) * (CARDS[k].hits ?? 1));
          return val(b.c) - val(a.c);
        });
      if (order.length) playCard(r, order[0]!.i);
      else endTurn(r);
    } else if (r.phase === 'reward') {
      const i = r.reward.findIndex((k) => CARDS[k].kind === 'attack' || k === 'agile');
      takeReward(r, i >= 0 ? i : 0);
    } else if (r.phase === 'rest') rest(r);
    else if (r.phase === 'bowl') removeCard(r, r.deck.indexOf('hiss'));
    else if (r.phase === 'box') leaveBox(r);
  }
  return r;
}

describe('nine lives', () => {
  it('a run is plain JSON and replays the same from its seed', () => {
    const a = bot(newRun(42));
    const b = bot(newRun(42));
    expect(JSON.parse(JSON.stringify(a))).toEqual(b);
  });

  it('a reasonable player beats the first boss, the last floor stays a challenge', () => {
    const runs = Array.from({ length: 20 }, (_, i) => bot(newRun(i + 1)));
    const floors = runs.map((r) => r.floors);
    expect(floors.filter((f) => f >= 1).length, floors.join(',')).toBeGreaterThanOrEqual(12);
    expect(
      floors.some((f) => f >= 2),
      floors.join(','),
    ).toBe(true);
    for (const r of runs)
      expect(plausible('cards', stats(r), Math.max(30, r.floors * 60) * 1000)).toBe(true);
  });

  it('cards cost energy and damage goes through block', () => {
    const r = newRun(1);
    chooseRoom(r, 0);
    const f = r.fight!;
    f.hand = ['ambush', 'ambush'];
    f.energy = 3;
    f.enemy.block = 4;
    const hp = f.enemy.hp;
    expect(playCard(r, 0)).toBe(true);
    expect(f.enemy.hp).toBe(Math.max(0, hp - 10));
    expect(playCard(r, 0)).toBe(false); // 1 energy left, costs 2
  });
});
