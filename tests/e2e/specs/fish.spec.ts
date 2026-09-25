import { expect, test } from '@playwright/test';
import {
  api,
  createHousehold,
  createTask,
  createUser,
  dueTodayTask,
  mskTime,
  statusOf,
  superuserToken,
} from '../support/api';

// Fish 🐟 and the room shop (pb_migrations/1758890000_fish_and_room.js, pb_hooks/room.pb.js,
// the bot's ReminderService.rewardPending).

type Completion = { id: string; fish: number; rewarded: boolean };
type Balance = { id: string; from_tasks: number; from_bonuses: number; spent: number };

async function priced(id: string, token: string): Promise<Completion> {
  let c: Completion | null = null;
  await expect
    .poll(
      async () => {
        c = await api<Completion>(
          'GET',
          `/api/collections/completions/records/${id}`,
          undefined,
          token,
        );
        return c.rewarded;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return c!;
}

const balanceOf = async (household: string, token: string) => {
  const b = await api<Balance>(
    'GET',
    `/api/collections/fish_balance/records/${household}`,
    undefined,
    token,
  );
  return b.from_tasks + b.from_bonuses - b.spent;
};

const complete = (token: string, household: string, task: string, user: string, extra = {}) =>
  api<Completion>(
    'POST',
    '/api/collections/completions/records',
    { household, task, user, done_at: new Date().toISOString(), kind: 'done', ...extra },
    token,
  );

test('the bot prices completions: on time pays more, a repeat mark pays nothing', async () => {
  const owner = await createUser('Маша');
  const { household } = await createHousehold(owner);
  const litter = await createTask(owner, household.id, dueTodayTask('Сменить наполнитель'));

  const first = await priced(
    (await complete(owner.token, household.id, litter.id, owner.id)).id,
    owner.token,
  );
  expect(first.fish).toBe(15); // weight 2 × 5, on time × 1.5
  const again = await priced(
    (await complete(owner.token, household.id, litter.id, owner.id)).id,
    owner.token,
  );
  expect(again.fish).toBe(0);

  // Feeding (weight 1) an hour and a half after its slot: overdue, no bonus.
  const feed = await createTask(owner, household.id, {
    title: 'Покормить',
    category: 'feeding',
    template_key: 'feeding',
    schedule: { kind: 'daily_slots', times: [mskTime(-90)] },
  });
  const late = await priced(
    (await complete(owner.token, household.id, feed.id, owner.id)).id,
    owner.token,
  );
  expect(late.fish).toBe(5);

  expect(await balanceOf(household.id, owner.token)).toBe(20);
  const byUser = await api<{ items: Array<{ id: string; fish: number }> }>(
    'GET',
    '/api/collections/fish_by_user/records',
    undefined,
    owner.token,
  );
  expect(byUser.items).toEqual([expect.objectContaining({ id: owner.id, fish: 20 })]);
});

test('members cannot award themselves fish', async () => {
  const owner = await createUser('Маша');
  const { household } = await createHousehold(owner);
  const task = await createTask(owner, household.id, dueTodayTask('Лоток'));
  expect(
    await statusOf(complete(owner.token, household.id, task.id, owner.id, { fish: 999 })),
  ).toBe(400);
  const c = await complete(owner.token, household.id, task.id, owner.id);
  expect(
    await statusOf(
      api(
        'PATCH',
        `/api/collections/completions/records/${c.id}`,
        { fish: 999, rewarded: true },
        owner.token,
      ),
    ),
  ).not.toBe(200);
  // Another household can't see our balance.
  const stranger = await createUser('Чужой');
  await createHousehold(stranger);
  expect(
    await statusOf(
      api(
        'GET',
        `/api/collections/fish_balance/records/${household.id}`,
        undefined,
        stranger.token,
      ),
    ),
  ).toBe(404);
});

test('buying room items: balance checked on the server, once per item, put away and back', async () => {
  const owner = await createUser('Маша');
  const petya = await createUser('Петя');
  const { household } = await createHousehold(owner, [petya]);
  const task = await createTask(owner, household.id, dueTodayTask('Лоток'));
  const c = await priced(
    (await complete(owner.token, household.id, task.id, owner.id)).id,
    owner.token,
  );

  const buy = (item: string, token = owner.token) =>
    api<{ id: string; price: number; placed: boolean }>(
      'POST',
      '/api/cathub/room/buy',
      { item },
      token,
    );
  await expect(buy('rug')).rejects.toThrow(/нужно 40 🐟, есть 15 🐟/);
  expect(await statusOf(buy('window'))).toBe(400); // starter, already there
  expect(await statusOf(buy('sofa'))).toBe(400);
  // Nobody can create items directly.
  expect(
    await statusOf(
      api(
        'POST',
        '/api/collections/room_items/records',
        { household: household.id, item: 'tree', price: 0 },
        owner.token,
      ),
    ),
  ).toBe(403);

  // Top up as the bot would (superuser) and buy.
  const su = await superuserToken();
  await api('PATCH', `/api/collections/completions/records/${c.id}`, { fish: 100 }, su);
  const rug = await buy('rug', petya.token);
  expect(rug).toMatchObject({ price: 40, placed: true });
  expect(await balanceOf(household.id, owner.token)).toBe(60);
  expect(await statusOf(buy('rug'))).toBe(400);
  expect(await statusOf(buy('bed'))).toBe(400); // 60 < 120

  // Put away and back; the price can't be changed.
  const put = (body: Record<string, unknown>) =>
    api('PATCH', `/api/collections/room_items/records/${rug.id}`, body, owner.token);
  expect(await put({ placed: false })).toMatchObject({ placed: false });
  expect(await statusOf(put({ price: 0 }))).not.toBe(200);
  expect(await balanceOf(household.id, owner.token)).toBe(60);
});
