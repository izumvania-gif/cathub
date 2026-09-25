import { createHmac } from 'node:crypto';
import { APP_URL, SUPERUSER, TG_URL, TZ } from './env';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`HTTP ${status}: ${JSON.stringify(body)}`);
  }
}

export async function api<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(APP_URL + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/** Status code of a request that is expected to fail (or 200 if it didn't). */
export async function statusOf(p: Promise<unknown>): Promise<number> {
  try {
    await p;
    return 200;
  } catch (e) {
    if (e instanceof ApiError) return e.status;
    throw e;
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export interface TestUser {
  id: string;
  token: string;
  email: string;
  name: string;
}

export async function createUser(name: string): Promise<TestUser> {
  const email = `${name.toLowerCase().replace(/[^a-z]/g, '') || 'u'}-${uid()}@example.com`;
  await api('POST', '/api/collections/users/records', {
    email,
    password: 'password123',
    passwordConfirm: 'password123',
    name,
  });
  const auth = await api<{ token: string; record: { id: string } }>(
    'POST',
    '/api/collections/users/auth-with-password',
    { identity: email, password: 'password123' },
  );
  return { id: auth.record.id, token: auth.token, email, name };
}

export async function superuserToken(): Promise<string> {
  const a = await api<{ token: string }>(
    'POST',
    '/api/collections/_superusers/auth-with-password',
    {
      identity: SUPERUSER.email,
      password: SUPERUSER.password,
    },
  );
  return a.token;
}

/** Household with an owner, optional members, and a cat. */
export async function createHousehold(owner: TestUser, members: TestUser[] = []) {
  const household = await api<{ id: string; invite_code: string }>(
    'POST',
    '/api/cathub/household',
    { name: 'Тестовый дом', timezone: TZ },
    owner.token,
  );
  for (const m of members)
    await api('POST', '/api/cathub/join', { code: household.invite_code }, m.token);
  const cat = await api<{ id: string }>(
    'POST',
    '/api/collections/cats/records',
    { household: household.id, name: 'Барсик' },
    owner.token,
  );
  return { household, cat };
}

/** Local midnight today in Moscow, as ISO — an interval task starting today is due today. */
export function todayMidnightIso(): string {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  return new Date(`${d}T00:00:00+03:00`).toISOString();
}

/** Current Moscow local time as "HH:MM", shifted by `deltaMin`. */
export function mskTime(deltaMin = 0): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(new Date(Date.now() + deltaMin * 60_000));
}

export async function createTask(
  owner: TestUser,
  householdId: string,
  fields: Record<string, unknown>,
): Promise<{ id: string }> {
  return api(
    'POST',
    '/api/collections/tasks/records',
    { household: householdId, ...fields },
    owner.token,
  );
}

/** An every-14-days task that is due today. */
export const dueTodayTask = (title: string) => ({
  title,
  emoji: '🪣',
  category: 'litter',
  schedule: {
    kind: 'interval',
    every: 14,
    unit: 'day',
    anchor: 'completion',
    startDate: todayMidnightIso(),
  },
});

// ── Telegram mock ───────────────────────────────────────────────────────────

export interface TgCall {
  method: string;
  params: Record<string, unknown> & {
    chat_id?: string | number;
    text?: string;
    reply_markup?: { inline_keyboard?: Array<Array<{ text: string; callback_data?: string }>> };
  };
  at: number;
}

export async function tgCalls(chatId?: number): Promise<TgCall[]> {
  const res = await fetch(`${TG_URL}/__calls`);
  const all = ((await res.json()) as { result: TgCall[] }).result;
  return chatId === undefined
    ? all
    : all.filter((c) => String(c.params.chat_id) === String(chatId));
}

export async function tgInject(update: Record<string, unknown>) {
  await fetch(`${TG_URL}/__inject`, { method: 'POST', body: JSON.stringify(update) });
}

let nextChat = 500_000 + Math.floor(Math.random() * 100_000);
export const newChatId = () => nextChat++;

export function tgMessage(chatId: number, fromId: number, text: string, chatType = 'private') {
  const cmd = /^\/\w+(@\w+)?/.exec(text)?.[0];
  return {
    message: {
      message_id: Math.floor(Math.random() * 1e6),
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: chatType, ...(chatType !== 'private' ? { title: 'Семья' } : {}) },
      from: { id: fromId, is_bot: false, first_name: 'Тест' },
      text,
      ...(cmd ? { entities: [{ type: 'bot_command', offset: 0, length: cmd.length }] } : {}),
    },
  };
}

export function tgCallback(
  fromId: number,
  chatId: number,
  messageId: number,
  data: string,
  id = uid(),
) {
  return {
    callback_query: {
      id,
      from: { id: fromId, is_bot: false, first_name: 'Тест' },
      chat_instance: 'e2e',
      data,
      message: {
        message_id: messageId,
        date: 0,
        chat: { id: chatId, type: chatId < 0 ? 'group' : 'private' },
      },
    },
  };
}

/** Links a user's Telegram through the real flow: web link route → /start <token> in the bot. */
export async function linkTelegram(user: TestUser, chatId: number) {
  const { url } = await api<{ url: string }>(
    'POST',
    '/api/cathub/telegram/link',
    undefined,
    user.token,
  );
  const token = new URL(url).searchParams.get('start')!;
  await tgInject(tgMessage(chatId, chatId, `/start ${token}`));
}

/** Telegram Mini App initData signed with the e2e bot token (see support/global-setup.ts). */
export function signedInitData(telegramUserId: number, botToken = '42:e2e-token'): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'e2e',
    user: JSON.stringify({ id: telegramUserId, first_name: 'Тест' }),
  };
  const check = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
