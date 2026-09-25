import { expect, test } from '@playwright/test';
import {
  api,
  createHousehold,
  createTask,
  createUser,
  dueTodayTask,
  statusOf,
} from '../support/api';

// Access rules and household routes (pocketbase/pb_migrations, pb_hooks/household.pb.js).

test('household: create, join by code, rotate invite', async () => {
  const masha = await createUser('Маша');
  const petya = await createUser('Петя');
  const h = await api<{ id: string; invite_code: string }>(
    'POST',
    '/api/cathub/household',
    {},
    masha.token,
  );
  expect(h.invite_code).toMatch(/^[A-Z2-9]{8}$/);

  expect(await statusOf(api('POST', '/api/cathub/household', {}, masha.token))).toBe(400);
  expect(await statusOf(api('POST', '/api/cathub/join', { code: 'NOPE2345' }, petya.token))).toBe(
    404,
  );

  const joined = await api<{ id: string }>(
    'POST',
    '/api/cathub/join',
    { code: h.invite_code.toLowerCase() },
    petya.token,
  );
  expect(joined.id).toBe(h.id);

  expect(await statusOf(api('POST', '/api/cathub/invite', {}, petya.token))).toBe(403);
  const rotated = await api<{ invite_code: string }>('POST', '/api/cathub/invite', {}, masha.token);
  expect(rotated.invite_code).not.toBe(h.invite_code);
});

test('members see their household; strangers see nothing', async () => {
  const owner = await createUser('Маша');
  const member = await createUser('Петя');
  const stranger = await createUser('Чужой');
  const { household } = await createHousehold(owner, [member]);
  const task = await createTask(owner, household.id, dueTodayTask('Сменить наполнитель'));

  const members = await api<{ totalItems: number }>(
    'GET',
    '/api/collections/users/records',
    undefined,
    member.token,
  );
  expect(members.totalItems).toBe(2);
  const own = await api<{ totalItems: number }>(
    'GET',
    '/api/collections/users/records',
    undefined,
    stranger.token,
  );
  expect(own.totalItems).toBe(1);

  const tasks = await api<{ totalItems: number }>(
    'GET',
    '/api/collections/tasks/records',
    undefined,
    stranger.token,
  );
  expect(tasks.totalItems).toBe(0);
  expect(
    await statusOf(
      api('GET', `/api/collections/tasks/records/${task.id}`, undefined, stranger.token),
    ),
  ).toBe(404);
  expect(
    await statusOf(
      api(
        'POST',
        '/api/collections/tasks/records',
        { ...dueTodayTask('x'), household: household.id },
        stranger.token,
      ),
    ),
  ).toBe(400);
});

test('users cannot assign themselves to a household or change their role', async () => {
  const owner = await createUser('Маша');
  const member = await createUser('Петя');
  const stranger = await createUser('Чужой');
  const { household } = await createHousehold(owner, [member]);

  expect(
    await statusOf(
      api(
        'PATCH',
        `/api/collections/users/records/${stranger.id}`,
        { household: household.id },
        stranger.token,
      ),
    ),
  ).not.toBe(200);
  expect(
    await statusOf(
      api('PATCH', `/api/collections/users/records/${member.id}`, { role: 'owner' }, member.token),
    ),
  ).not.toBe(200);
  expect(
    await statusOf(
      api(
        'PATCH',
        `/api/collections/users/records/${member.id}`,
        { telegram_chat_id: '1' },
        member.token,
      ),
    ),
  ).not.toBe(200);
  // Own notification settings are allowed.
  const me = await api<{ digest_time: string }>(
    'PATCH',
    `/api/collections/users/records/${member.id}`,
    { digest_time: '08:30', quiet_hours: { from: '22:00', to: '07:00' } },
    member.token,
  );
  expect(me.digest_time).toBe('08:30');
});

test('completions: record as yourself, undo, no impersonation', async () => {
  const owner = await createUser('Маша');
  const member = await createUser('Петя');
  const { household } = await createHousehold(owner, [member]);
  const task = await createTask(owner, household.id, dueTodayTask('Сменить наполнитель'));
  const base = {
    household: household.id,
    task: task.id,
    done_at: new Date().toISOString().replace('T', ' '),
    kind: 'done',
  };

  const c = await api<{ id: string }>(
    'POST',
    '/api/collections/completions/records',
    { ...base, user: member.id },
    member.token,
  );
  expect(
    await statusOf(
      api(
        'POST',
        '/api/collections/completions/records',
        { ...base, user: owner.id },
        member.token,
      ),
    ),
  ).toBe(400);

  const list = await api<{ items: Array<{ expand: { user: { name: string } } }> }>(
    'GET',
    `/api/collections/completions/records?expand=user`,
    undefined,
    owner.token,
  );
  expect(list.items[0]!.expand.user.name).toBe('Петя');
  await api('DELETE', `/api/collections/completions/records/${c.id}`, undefined, owner.token);
});

test('new users get the 09:00 digest by default', async () => {
  const u = await createUser('Новый');
  const me = await api<{ digest_time: string }>(
    'GET',
    `/api/collections/users/records/${u.id}`,
    undefined,
    u.token,
  );
  expect(me.digest_time).toBe('09:00');
});

test('task schedules are validated on the server', async () => {
  const owner = await createUser('Маша');
  const { household } = await createHousehold(owner);
  const bad = [
    { kind: 'daily_slots', times: ['25:00'] },
    {
      kind: 'interval',
      every: 0,
      unit: 'day',
      anchor: 'completion',
      startDate: '2026-01-01T00:00:00Z',
    },
    {
      kind: 'interval',
      every: 1,
      unit: 'fortnight',
      anchor: 'completion',
      startDate: '2026-01-01T00:00:00Z',
    },
    { kind: 'nope' },
  ];
  for (const schedule of bad) {
    expect(
      await statusOf(
        api(
          'POST',
          '/api/collections/tasks/records',
          { household: household.id, title: 'x', schedule },
          owner.token,
        ),
      ),
    ).toBe(400);
  }
});

test('reminder_log and telegram_links are not exposed to users', async () => {
  const u = await createUser('Маша');
  for (const c of ['reminder_log', 'telegram_links']) {
    const status = await statusOf(api('GET', `/api/collections/${c}/records`, undefined, u.token));
    expect([403, 404]).toContain(status);
  }
});
