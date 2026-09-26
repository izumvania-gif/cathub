import { expect, test } from '@playwright/test';
import { api, createHousehold, createUser, statusOf } from '../support/api';

// Mini-games (pb_migrations/1758930000_games.js, pb_hooks/games.pb.js, core games.ts).

type Finish = {
  fish: number;
  capped: boolean;
  left: number;
  best: number;
  record: boolean;
  counted: boolean;
  achievements: Array<{ key: string; fish: number; accessory: string | null }>;
};
type Balance = {
  from_tasks: number;
  from_bonuses: number;
  from_games: number;
  from_achievements: number;
  spent: number;
};

const finish = (token: string, game: string, stats: Record<string, number>, durationMs: number) =>
  api<Finish>('POST', '/api/cathub/games/finish', { game, stats, durationMs }, token);

test('games pay a little fish, capped per person per day, plus one-off achievements', async () => {
  const masha = await createUser('Маша');
  const petya = await createUser('Петя');
  const { household } = await createHousehold(masha, [petya]);

  // A good fishing run: 8 fish, three achievements (two with fish, one with the fisher hat).
  const a = await finish(masha.token, 'fishing', { score: 120, caught: 31, streak: 12 }, 45_000);
  expect(a).toMatchObject({ fish: 8, capped: false, left: 2, record: true, counted: true });
  expect(a.achievements.map((x) => x.key).sort()).toEqual([
    'fishing_15',
    'fishing_30',
    'fishing_streak',
  ]);
  expect(a.achievements.find((x) => x.key === 'fishing_30')?.accessory).toBe('fisher');

  // The daily cap: only 2 more today, and the same achievements are not granted twice.
  const b = await finish(masha.token, 'fishing', { score: 130, caught: 32, streak: 12 }, 45_000);
  expect(b).toMatchObject({ fish: 2, capped: true, left: 0, achievements: [] });
  const c = await finish(masha.token, 'jump', { score: 600, coins: 3 }, 90_000);
  expect(c.fish).toBe(0);
  expect(c.achievements.map((x) => x.key).sort()).toEqual(['jump_200', 'jump_500']);

  // Петя has his own cap.
  const d = await finish(petya.token, 'jump', { score: 160 }, 60_000);
  expect(d).toMatchObject({ fish: 3, capped: false });

  // A too-short run is recorded but earns nothing.
  const e = await finish(petya.token, 'defense', { score: 100, waves: 1, food: 0 }, 5_000);
  expect(e).toMatchObject({ fish: 0, counted: false, achievements: [] });

  // Unbelievable results and unknown games are refused.
  expect(await statusOf(finish(masha.token, 'jump', { score: 9000 }, 10_000))).toBe(400);
  expect(
    await statusOf(finish(masha.token, 'defense', { score: 600, waves: 5, food: 100 }, 30_000)),
  ).toBe(400);
  expect(await statusOf(finish(masha.token, 'chess', { score: 1 }, 60_000))).toBe(400);

  // Clients can't write runs or achievements themselves.
  expect(
    await statusOf(
      api(
        'POST',
        '/api/collections/game_runs/records',
        { household: household.id, user: masha.id, game: 'jump', score: 1, fish: 99 },
        masha.token,
      ),
    ),
  ).toBe(403);

  // Game fish and achievement fish are in the family balance: 8 + 2 + 3 runs, 10 + 20 + 10 + 20.
  const bal = await api<Balance>(
    'GET',
    `/api/collections/fish_balance/records/${household.id}`,
    undefined,
    petya.token,
  );
  expect(bal.from_games).toBe(13);
  expect(bal.from_achievements).toBe(60);

  // Family records.
  const records = await api<{ items: Array<{ user: string; game: string; best: number }> }>(
    'GET',
    '/api/collections/game_records/records',
    undefined,
    petya.token,
  );
  expect(records.items.find((r) => r.user === masha.id && r.game === 'fishing')?.best).toBe(130);

  // The room shop counts game fish too (73 🐟 ≥ 40 for the rug).
  const rug = await api<{ item: string }>(
    'POST',
    '/api/cathub/room/buy',
    { item: 'rug' },
    masha.token,
  );
  expect(rug.item).toBe('rug');
});
