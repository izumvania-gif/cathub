import { describe, expect, it } from 'vitest';
import {
  ACCESSORY_SOURCE,
  ACHIEVEMENT_INFO,
  GAME_RULES,
  achievementsMet,
  capFish,
  gameFish,
  plausible,
  unlockedAccessories,
} from './games';

describe('game rewards', () => {
  it('prices a run by score tiers', () => {
    expect(gameFish('jump', 10)).toBe(0);
    expect(gameFish('jump', 50)).toBe(1);
    expect(gameFish('jump', 499)).toBe(5);
    expect(gameFish('jump', 9000)).toBe(8);
    expect(gameFish('fishing', 30)).toBe(3);
  });

  it('keeps games under the daily cap', () => {
    expect(capFish(8, 0)).toBe(8);
    expect(capFish(8, 5)).toBe(5);
    expect(capFish(8, 10)).toBe(0);
    expect(capFish(3, 12)).toBe(0);
  });

  it('a good run is worth less than a chore done on time', () => {
    for (const g of Object.values(GAME_RULES.games))
      expect(Math.max(...g.tiers.map((t) => t[1]))).toBeLessThan(15);
  });

  it('checks that a run is believable', () => {
    expect(plausible('jump', { score: 300, coins: 5 }, 60_000)).toBe(true);
    expect(plausible('jump', { score: 3000, coins: 5 }, 10_000)).toBe(false);
    expect(plausible('defense', { score: 600, waves: 5, food: 100 }, 120_000)).toBe(true);
    expect(plausible('defense', { score: 600, waves: 5, food: 100 }, 30_000)).toBe(false);
    expect(plausible('cards', { score: 50, floors: 4, hp: 10 }, 999_999)).toBe(false);
    expect(plausible('fishing', { score: 1.5, caught: 1, streak: 1 }, 45_000)).toBe(false);
  });

  it('finds the achievements a run meets', () => {
    expect(achievementsMet('defense', { waves: 5, food: 90 }).map((a) => a.key)).toEqual([
      'defense_3',
      'defense_5',
    ]);
    expect(achievementsMet('defense', { waves: 5, food: 100 }).map((a) => a.key)).toContain(
      'defense_perfect',
    );
  });

  it('every achievement has a text, every accessory one source', () => {
    for (const a of GAME_RULES.achievements) expect(ACHIEVEMENT_INFO[a.key]).toBeTruthy();
    expect(Object.keys(ACCESSORY_SOURCE).sort()).toEqual(['crown', 'fisher', 'medal', 'propeller']);
    expect([...unlockedAccessories(['cards_3', 'jump_200'])]).toEqual(['crown']);
  });
});
