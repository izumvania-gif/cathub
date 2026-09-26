/**
 * Mini-games played as your own cat (docs/PLAN.md, Phase 7): what a run is worth in fish, the
 * daily cap, and the achievements. GAME_RULES is plain data because the PocketBase hook
 * (pb_hooks/lib/games.js) needs the same numbers; a bot test checks that the two agree.
 */

export type GameKey = 'jump' | 'defense' | 'cards' | 'fishing';
/** Cat accessories that can't be bought, only earned in games. */
export type GameAccessory = 'propeller' | 'medal' | 'crown' | 'fisher';

export interface StatRule {
  /** Largest believable value. */
  max: number;
  /** Largest believable gain per second of play (checked against the run's duration). */
  perSec?: number;
}

export interface GameRule {
  stats: Record<string, StatRule>;
  /** Shorter runs are recorded but earn nothing. */
  minMs: number;
  maxMs: number;
  /** Fish by score: [minimum score, fish], ascending. */
  tiers: Array<[number, number]>;
}

export interface AchievementRule {
  key: string;
  game: GameKey;
  /** Every listed stat must reach its value in one run. */
  need: Record<string, number>;
  fish?: number;
  accessory?: GameAccessory;
}

export const GAME_RULES: {
  dailyCap: number;
  games: Record<GameKey, GameRule>;
  achievements: AchievementRule[];
} = {
  dailyCap: 10,
  games: {
    jump: {
      stats: { score: { max: 100000, perSec: 40 }, coins: { max: 5000, perSec: 6 } },
      minMs: 3000,
      maxMs: 3600000,
      tiers: [
        [50, 1],
        [150, 3],
        [300, 5],
        [500, 8],
      ],
    },
    defense: {
      stats: { score: { max: 600 }, waves: { max: 5, perSec: 0.07 }, food: { max: 100 } },
      minMs: 20000,
      maxMs: 3600000,
      tiers: [
        [100, 1],
        [300, 3],
        [500, 5],
        [590, 8],
      ],
    },
    cards: {
      stats: { score: { max: 500 }, floors: { max: 3, perSec: 0.02 }, hp: { max: 80 } },
      minMs: 30000,
      maxMs: 86400000,
      tiers: [
        [40, 1],
        [100, 3],
        [200, 5],
        [300, 8],
      ],
    },
    fishing: {
      stats: {
        score: { max: 600, perSec: 14 },
        caught: { max: 120, perSec: 2.5 },
        streak: { max: 120, perSec: 2.5 },
      },
      minMs: 20000,
      maxMs: 90000,
      tiers: [
        [10, 1],
        [30, 3],
        [60, 5],
        [100, 8],
      ],
    },
  },
  achievements: [
    { key: 'jump_200', game: 'jump', need: { score: 200 }, fish: 10 },
    { key: 'jump_500', game: 'jump', need: { score: 500 }, fish: 20 },
    { key: 'jump_1000', game: 'jump', need: { score: 1000 }, accessory: 'propeller' },
    { key: 'defense_3', game: 'defense', need: { waves: 3 }, fish: 10 },
    { key: 'defense_5', game: 'defense', need: { waves: 5 }, fish: 20 },
    { key: 'defense_perfect', game: 'defense', need: { waves: 5, food: 100 }, accessory: 'medal' },
    { key: 'cards_1', game: 'cards', need: { floors: 1 }, fish: 10 },
    { key: 'cards_2', game: 'cards', need: { floors: 2 }, fish: 20 },
    { key: 'cards_3', game: 'cards', need: { floors: 3 }, accessory: 'crown' },
    { key: 'fishing_15', game: 'fishing', need: { caught: 15 }, fish: 10 },
    { key: 'fishing_streak', game: 'fishing', need: { streak: 10 }, fish: 20 },
    { key: 'fishing_30', game: 'fishing', need: { caught: 30 }, accessory: 'fisher' },
  ],
};

export const GAME_INFO: Record<GameKey, { title: string; emoji: string; blurb: string }> = {
  jump: { title: 'Прыг-скок', emoji: '🐾', blurb: 'Прыгай по полкам как можно выше' },
  defense: { title: 'Оборона кухни', emoji: '🧀', blurb: 'Не пусти мышей к миске, 5 волн' },
  cards: { title: 'Девять жизней', emoji: '🃏', blurb: 'Карточный поход через три этажа' },
  fishing: { title: 'Рыбалка', emoji: '🎣', blurb: 'Лови рыбок у аквариума, 45 секунд' },
};

export const GAME_ORDER: GameKey[] = ['jump', 'defense', 'cards', 'fishing'];

export const ACHIEVEMENT_INFO: Record<string, { title: string; how: string }> = {
  jump_200: { title: 'Высоко сижу', how: '200 очков в «Прыг-скоке»' },
  jump_500: { title: 'Под потолком', how: '500 очков в «Прыг-скоке»' },
  jump_1000: { title: 'Космокот', how: '1000 очков в «Прыг-скоке»' },
  defense_3: { title: 'Мышиный патруль', how: 'Отбить 3 волны' },
  defense_5: { title: 'Кухня спасена', how: 'Отбить все 5 волн' },
  defense_perfect: { title: 'Ни крошки', how: 'Отбить 5 волн, не отдав ни крошки корма' },
  cards_1: { title: 'Гроза крыс', how: 'Победить Крысу-вожака' },
  cards_2: { title: 'Тише, пылесос', how: 'Победить Пылесос' },
  cards_3: { title: 'Девять жизней', how: 'Пройти все три этажа и победить Ванну' },
  fishing_15: { title: 'Рыбак', how: 'Поймать 15 рыбок за раз' },
  fishing_streak: { title: 'Без промаха', how: '10 рыбок подряд без промаха' },
  fishing_30: { title: 'Гроза аквариума', how: 'Поймать 30 рыбок за раз' },
};

export const ACCESSORY_LABELS: Record<GameAccessory, string> = {
  propeller: 'Кепка с пропеллером',
  medal: 'Сырная медаль',
  crown: 'Корона',
  fisher: 'Панама рыбака',
};

/** Which achievement unlocks each game accessory. */
export const ACCESSORY_SOURCE = Object.fromEntries(
  GAME_RULES.achievements.filter((a) => a.accessory).map((a) => [a.accessory, a.key]),
) as Record<GameAccessory, string>;

/** Fish a run's score is worth before the daily cap. */
export function gameFish(game: GameKey, score: number): number {
  let fish = 0;
  for (const [min, f] of GAME_RULES.games[game].tiers) if (score >= min) fish = f;
  return fish;
}

/** Fish left under the daily cap after `used` fish from games in the last 24 hours. */
export function capFish(fish: number, used: number): number {
  return Math.max(0, Math.min(fish, GAME_RULES.dailyCap - used));
}

/** Achievements a run meets (whether or not they were earned before). */
export function achievementsMet(game: GameKey, stats: Record<string, number>): AchievementRule[] {
  return GAME_RULES.achievements.filter(
    (a) => a.game === game && Object.entries(a.need).every(([k, v]) => (stats[k] ?? 0) >= v),
  );
}

/** Accessories unlocked by the achievements a household has. */
export function unlockedAccessories(keys: Iterable<string>): Set<GameAccessory> {
  const have = new Set(keys);
  return new Set(
    GAME_RULES.achievements.filter((a) => a.accessory && have.has(a.key)).map((a) => a.accessory!),
  );
}

/**
 * Is a run believable? Every stat within its maximum and its per-second rate. The server runs
 * the same check (pb_hooks/lib/games.js); this copy keeps the client from sending junk.
 */
export function plausible(game: GameKey, stats: Record<string, number>, durationMs: number) {
  const rule = GAME_RULES.games[game];
  const secs = Math.max(durationMs, 0) / 1000;
  return Object.entries(rule.stats).every(([k, r]) => {
    const v = stats[k] ?? 0;
    return (
      Number.isInteger(v) &&
      v >= 0 &&
      v <= r.max &&
      (r.perSec === undefined || v <= r.perSec * secs + 1)
    );
  });
}
