import { expect, test } from '@playwright/test';
import {
  api,
  createHousehold,
  createTask,
  createUser,
  dueTodayTask,
  linkTelegram,
  mskTime,
  newChatId,
  signedInitData,
  statusOf,
  tgCallback,
  uid,
  tgCalls,
  tgInject,
  tgMessage,
  type TestUser,
  type TgCall,
} from '../support/api';

// The bot runs against the Telegram mock with a 1 s reminder interval (support/global-setup.ts).

const NO_QUIET = { quiet_hours: { from: '00:00', to: '00:00' } };

async function setUser(u: TestUser, fields: Record<string, unknown>) {
  await api('PATCH', `/api/collections/users/records/${u.id}`, fields, u.token);
}

async function waitForCall(
  chatId: number | undefined,
  pred: (c: TgCall) => boolean,
  label: string,
): Promise<TgCall> {
  let found: TgCall | undefined;
  await expect
    .poll(
      async () => {
        found = (await tgCalls(chatId)).find(pred);
        return Boolean(found);
      },
      { message: label, timeout: 15_000 },
    )
    .toBe(true);
  return found!;
}

const isReminder = (title: string) => (c: TgCall) =>
  c.method === 'sendMessage' &&
  Boolean(c.params.reply_markup?.inline_keyboard) &&
  String(c.params.text).includes(title);

const button = (c: TgCall, label: string) =>
  c.params.reply_markup!.inline_keyboard!.flat().find((b) => b.text.includes(label))!
    .callback_data!;

/** Presses an inline button and waits for the bot's answer to that exact press. */
async function press(fromId: number, chatId: number, data: string): Promise<string> {
  const id = uid();
  await tgInject(tgCallback(fromId, chatId, 1000, data, id));
  const answer = await waitForCall(
    undefined,
    (c) => c.method === 'answerCallbackQuery' && c.params.callback_query_id === id,
    'callback answered',
  );
  return String(answer.params.text ?? '');
}

/** Owner with Telegram linked (quiet hours off, digest off) and a household with a cat. */
async function linkedOwner() {
  const owner = await createUser('Маша');
  const { household } = await createHousehold(owner);
  await setUser(owner, { ...NO_QUIET, digest_time: '' });
  const chat = newChatId();
  await linkTelegram(owner, chat);
  await waitForCall(
    chat,
    (c) => c.method === 'sendMessage' && String(c.params.text).includes('Готово'),
    'link greeting',
  );
  return { owner, household, chat };
}

test('linking via /start <token> binds the chat to the user', async () => {
  const { owner, chat } = await linkedOwner();
  const me = await api<{ telegram_chat_id: string; notify: boolean }>(
    'GET',
    `/api/collections/users/records/${owner.id}`,
    undefined,
    owner.token,
  );
  expect(me.telegram_chat_id).toBe(String(chat));
  expect(me.notify).toBe(true);

  // A used token doesn't work twice.
  const other = newChatId();
  const { url } = await api<{ url: string }>(
    'POST',
    '/api/cathub/telegram/link',
    undefined,
    owner.token,
  );
  const token = new URL(url).searchParams.get('start')!;
  await tgInject(tgMessage(chat, chat, `/start ${token}`));
  await tgInject(tgMessage(other, other, `/start ${token}`));
  await waitForCall(
    other,
    (c) => String(c.params.text).includes('устарела'),
    'reused token rejected',
  );
});

test('due task → reminder → "Сделано" records the completion and edits the message', async () => {
  const { owner, household, chat } = await linkedOwner();
  const task = await createTask(owner, household.id, dueTodayTask('Сменить наполнитель'));

  const reminder = await waitForCall(chat, isReminder('Сменить наполнитель'), 'reminder sent');
  expect(reminder.params.text).toContain('Пора');

  expect(await press(chat, chat, button(reminder, 'Сделано'))).toContain('Отмечено');
  await waitForCall(
    chat,
    (c) =>
      c.method === 'editMessageText' &&
      String(c.params.text).includes('✅ Маша') &&
      // A litter task (weight 2) done on time: 10 × 1.5.
      String(c.params.text).includes('+15 🐟') &&
      String(c.params.text).includes('Сменить наполнитель'),
    'reminder edited with who did it and the fish earned',
  );

  const comps = await api<{ items: Array<{ user: string; kind: string }> }>(
    'GET',
    `/api/collections/completions/records?filter=${encodeURIComponent(`task='${task.id}'`)}`,
    undefined,
    owner.token,
  );
  expect(comps.items).toEqual([expect.objectContaining({ user: owner.id, kind: 'done' })]);

  // Pressing again says it's already done and creates nothing.
  expect(await press(chat, chat, button(reminder, 'Сделано'))).toContain('Уже сделано');

  // No duplicate reminders for the same occurrence.
  await new Promise((r) => setTimeout(r, 2500));
  expect((await tgCalls(chat)).filter(isReminder('Сменить наполнитель'))).toHaveLength(1);
});

test('a task done in the app closes the Telegram reminder', async () => {
  const { owner, household, chat } = await linkedOwner();
  const petya = await createUser('Петя');
  const { invite_code } = await api<{ invite_code: string }>(
    'GET',
    `/api/collections/households/records/${household.id}`,
    undefined,
    owner.token,
  );
  await api('POST', '/api/cathub/join', { code: invite_code }, petya.token);
  const task = await createTask(owner, household.id, dueTodayTask('Подстричь когти'));
  await waitForCall(chat, isReminder('Подстричь когти'), 'reminder sent');

  await api(
    'POST',
    '/api/collections/completions/records',
    {
      household: household.id,
      task: task.id,
      user: petya.id,
      done_at: new Date().toISOString().replace('T', ' '),
      kind: 'done',
    },
    petya.token,
  );
  await waitForCall(
    chat,
    (c) =>
      c.method === 'editMessageText' &&
      String(c.params.text).includes('✅ Петя') &&
      String(c.params.text).includes('когти'),
    'reminder closed with the app user',
  );
});

test('"+1 ч" snoozes the task and marks the message', async () => {
  const { owner, household, chat } = await linkedOwner();
  const task = await createTask(owner, household.id, dueTodayTask('Вычесать'));
  const reminder = await waitForCall(chat, isReminder('Вычесать'), 'reminder sent');
  expect(await press(chat, chat, button(reminder, '+1'))).toContain('Напомню');
  await waitForCall(
    chat,
    (c) => c.method === 'editMessageText' && String(c.params.text).includes('⏰ Отложено'),
    'snoozed',
  );
  const snoozes = await api<{ totalItems: number }>(
    'GET',
    `/api/collections/snoozes/records?filter=${encodeURIComponent(`task='${task.id}'`)}`,
    undefined,
    owner.token,
  );
  expect(snoozes.totalItems).toBe(1);
});

test('quiet hours hold reminders back', async () => {
  const { owner, household, chat } = await linkedOwner();
  // Quiet from a minute ago to an hour ahead (Moscow time).
  await setUser(owner, { quiet_hours: { from: mskTime(-1), to: mskTime(60) } });
  await createTask(owner, household.id, dueTodayTask('Тихое дело'));
  await new Promise((r) => setTimeout(r, 3000));
  expect((await tgCalls(chat)).filter(isReminder('Тихое дело'))).toHaveLength(0);
  await setUser(owner, NO_QUIET);
  await waitForCall(chat, isReminder('Тихое дело'), 'sent after quiet hours end');
});

test('morning digest is sent once when something is pending', async () => {
  const { owner, household, chat } = await linkedOwner();
  await createTask(owner, household.id, dueTodayTask('Дело для сводки'));
  await setUser(owner, { digest_time: mskTime(-1) });
  const digest = await waitForCall(
    chat,
    (c) => c.method === 'sendMessage' && String(c.params.text).includes('Доброе утро'),
    'digest sent',
  );
  expect(digest.params.text).toContain('Дело для сводки');
  await new Promise((r) => setTimeout(r, 2500));
  expect(
    (await tgCalls(chat)).filter((c) => String(c.params.text).includes('Доброе утро')),
  ).toHaveLength(1);
});

test('digest lists supplies that are running out', async () => {
  const { owner, household, chat } = await linkedOwner();
  await api(
    'POST',
    '/api/collections/supplies/records',
    {
      household: household.id,
      name: 'Наполнитель',
      emoji: '🪣',
      unit: 'кг',
      stock: 0.5,
      stock_at: new Date().toISOString().replace('T', ' '),
      daily_usage: 0.3,
      low_days: 7,
    },
    owner.token,
  );
  await setUser(owner, { digest_time: mskTime(-1) });
  const digest = await waitForCall(
    chat,
    (c) => String(c.params.text).includes('Доброе утро'),
    'digest sent',
  );
  expect(digest.params.text).toContain('Пора купить');
  expect(digest.params.text).toContain('Наполнитель — хватит на 1 день');
});

test('/today replies with the day overview', async () => {
  const { owner, household, chat } = await linkedOwner();
  await createTask(owner, household.id, dueTodayTask('Дело на сегодня'));
  await tgInject(tgMessage(chat, chat, '/today'));
  const reply = await waitForCall(
    chat,
    (c) => c.method === 'sendMessage' && String(c.params.text).includes('Сегодня у Барсик'),
    '/today reply',
  );
  expect(reply.params.text).toContain('Дело на сегодня');
});

test('family group chat gets shared reminders; assigned ones go to the assignee', async () => {
  const { owner, household, chat } = await linkedOwner();
  const group = -newChatId();
  const { url } = await api<{ url: string }>(
    'POST',
    '/api/cathub/telegram/group-link',
    undefined,
    owner.token,
  );
  expect(url).toContain('startgroup=');
  const token = new URL(url).searchParams.get('startgroup')!;
  await tgInject(tgMessage(group, chat, `/start@cathub_e2e_bot ${token}`, 'group'));
  await waitForCall(group, (c) => String(c.params.text).includes('Готово'), 'group linked');

  await createTask(owner, household.id, dueTodayTask('Общее дело'));
  await createTask(owner, household.id, { ...dueTodayTask('Моё дело'), assignee: owner.id });

  const shared = await waitForCall(group, isReminder('Общее дело'), 'shared reminder in group');
  await waitForCall(chat, isReminder('Моё дело'), 'assigned reminder in private chat');
  await new Promise((r) => setTimeout(r, 2000));
  expect((await tgCalls(chat)).filter(isReminder('Общее дело'))).toHaveLength(0);
  expect((await tgCalls(group)).filter(isReminder('Моё дело'))).toHaveLength(0);

  // Anyone with a linked Telegram can press "Сделано" in the group.
  expect(await press(chat, group, button(shared, 'Сделано'))).toContain('Отмечено');
  await waitForCall(
    group,
    (c) => c.method === 'editMessageText' && String(c.params.text).includes('✅ Маша'),
    'group reminder resolved',
  );

  // Unlinking in the app stops group reminders.
  await api('POST', '/api/cathub/telegram/group-unlink', {}, owner.token);
  const h = await api<{ telegram_group_chat_id: string }>(
    'GET',
    `/api/collections/households/records/${household.id}`,
    undefined,
    owner.token,
  );
  expect(h.telegram_group_chat_id).toBe('');
});

test('Mini App: signed initData logs in the linked user', async () => {
  const { owner, chat } = await linkedOwner();
  const auth = await api<{ token: string; record: { id: string } }>(
    'POST',
    '/api/cathub/telegram/webapp-auth',
    {
      initData: signedInitData(chat),
    },
  );
  expect(auth.record.id).toBe(owner.id);
  expect(auth.token).toBeTruthy();

  expect(
    await statusOf(
      api('POST', '/api/cathub/telegram/webapp-auth', {
        initData: signedInitData(chat, '42:wrong'),
      }),
    ),
  ).toBe(401);
  expect(
    await statusOf(
      api('POST', '/api/cathub/telegram/webapp-auth', { initData: signedInitData(newChatId()) }),
    ),
  ).toBe(404);
});

test('the bot sets the Mini App menu button', async () => {
  const calls = await tgCalls();
  const menu = calls.find((c) => c.method === 'setChatMenuButton');
  expect(JSON.stringify(menu?.params)).toContain('web_app');
});

/** Маша (owner) and Петя, both with Telegram linked, quiet hours and digest off. */
async function linkedFamily() {
  const { owner, household, chat } = await linkedOwner();
  const petya = await createUser('Петя');
  const h = await api<{ invite_code: string }>(
    'GET',
    `/api/collections/households/records/${household.id}`,
    undefined,
    owner.token,
  );
  await api('POST', '/api/cathub/join', { code: h.invite_code }, petya.token);
  await setUser(petya, { ...NO_QUIET, digest_time: '' });
  const petyaChat = newChatId();
  await linkTelegram(petya, petyaChat);
  await waitForCall(petyaChat, (c) => String(c.params.text).includes('Готово'), 'Петя linked');
  return { owner, household, chat, petya, petyaChat };
}

const todayWeekday = () => {
  const d = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date());
  return String(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(d) + 1);
};

test('duties: a by-weekday task reminds whoever has today; "Передать" hands it over', async () => {
  const { owner, household, chat, petya, petyaChat } = await linkedFamily();
  const task = await createTask(owner, household.id, {
    ...dueTodayTask('Лоток по дням'),
    assign_mode: 'weekday',
    duty_map: { [todayWeekday()]: petya.id },
  });

  const reminder = await waitForCall(petyaChat, isReminder('Лоток по дням'), 'Петя reminded');
  await new Promise((r) => setTimeout(r, 2000));
  expect((await tgCalls(chat)).filter(isReminder('Лоток по дням'))).toHaveLength(0);

  // 👉 → "to whom?" → Маша.
  await press(petyaChat, petyaChat, button(reminder, 'Передать'));
  const picker = await waitForCall(
    petyaChat,
    (c) => c.method === 'sendMessage' && String(c.params.text).includes('Кому передать'),
    'picker shown',
  );
  expect(await press(petyaChat, petyaChat, button(picker, 'Маша'))).toContain('Передано');
  await waitForCall(
    chat,
    (c) =>
      c.method === 'sendMessage' &&
      String(c.params.text).includes('передал(а) тебе') &&
      String(c.params.text).includes('Лоток по дням'),
    'Маша told about the hand-over',
  );
  const overrides = await api<{ items: Array<{ user: string; by: string }> }>(
    'GET',
    `/api/collections/duty_overrides/records?filter=${encodeURIComponent(`task='${task.id}'`)}`,
    undefined,
    owner.token,
  );
  expect(overrides.items).toEqual([expect.objectContaining({ user: owner.id, by: petya.id })]);
});

test('duties: "Возьму" in the family chat takes a shared chore', async () => {
  const { owner, household, chat, petya, petyaChat } = await linkedFamily();
  const group = -newChatId();
  const { url } = await api<{ url: string }>(
    'POST',
    '/api/cathub/telegram/group-link',
    undefined,
    owner.token,
  );
  const token = new URL(url).searchParams.get('startgroup')!;
  await tgInject(tgMessage(group, chat, `/start@cathub_e2e_bot ${token}`, 'group'));
  await waitForCall(group, (c) => String(c.params.text).includes('Готово'), 'group linked');

  const task = await createTask(owner, household.id, {
    ...dueTodayTask('Общий лоток'),
    assign_mode: 'anyone',
  });
  const shared = await waitForCall(group, isReminder('Общий лоток'), 'group reminder');
  expect(await press(petyaChat, group, button(shared, 'Возьму'))).toContain('ваше');
  await waitForCall(
    group,
    (c) => c.method === 'sendMessage' && String(c.params.text).includes('Петя берёт на себя'),
    'group told',
  );
  const overrides = await api<{ items: Array<{ user: string }> }>(
    'GET',
    `/api/collections/duty_overrides/records?filter=${encodeURIComponent(`task='${task.id}'`)}`,
    undefined,
    owner.token,
  );
  expect(overrides.items).toEqual([expect.objectContaining({ user: petya.id })]);
});

test('duties: while the assignee is away, the others get the reminder', async () => {
  const { owner, household, chat, petya, petyaChat } = await linkedFamily();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date());
  await api(
    'POST',
    '/api/collections/absences/records',
    { household: household.id, user: petya.id, from: today, to: today },
    petya.token,
  );
  await createTask(owner, household.id, {
    ...dueTodayTask('Петин лоток'),
    assign_mode: 'one',
    assignee: petya.id,
  });
  await waitForCall(chat, isReminder('Петин лоток'), 'Маша reminded while Петя is away');
  await new Promise((r) => setTimeout(r, 2000));
  expect((await tgCalls(petyaChat)).filter(isReminder('Петин лоток'))).toHaveLength(0);
});
