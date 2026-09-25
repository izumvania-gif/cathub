import { describeDue, evaluate, urgencyCompare } from '@cathub/core';
import type { Bot, Context } from 'grammy';
import { config } from './config';
import { log } from './log';
import { escapeHtml, parseCallback, resolutionLine, timeIn } from './messages';
import type { PocketBaseClient } from './pocketbase';
import type { ReminderService } from './reminders';
import type { HouseholdState } from './types';

const DEFAULT_TZ = 'Europe/Moscow';

export interface HandlerDeps {
  db: PocketBaseClient;
  reminders: ReminderService;
  status: () => string;
}

const appLink = () => (config.appUrl ? `\n\nПриложение: ${config.appUrl}` : '');

async function householdOf(
  db: PocketBaseClient,
  householdId: string,
): Promise<HouseholdState | null> {
  const all = await db.loadAll();
  return all.find((s) => s.household.id === householdId) ?? null;
}

export function registerHandlers(bot: Bot, { db, reminders, status }: HandlerDeps) {
  bot.command('start', async (ctx) => {
    const token = ctx.match?.trim();
    if (!token) {
      const user = await db.findUserByChat(ctx.chat.id).catch(() => null);
      return ctx.reply(
        user
          ? `Привет, ${user.name || 'друг'}! Я уже на связи и буду напоминать о делах по коту 🐈\n\n/today — что сегодня`
          : 'Привет! Я бот CatHub и напоминаю о делах по коту.\n\nЧтобы подключиться, откройте приложение → «Дом» → «Подключить Telegram».' +
              appLink(),
      );
    }
    const user = await db.linkChat(token, ctx.chat.id, ctx.from?.username);
    if (!user) {
      return ctx.reply(
        'Ссылка устарела или уже использована. Нажмите «Подключить Telegram» в приложении ещё раз.',
      );
    }
    log.info(`linked chat ${ctx.chat.id} to user ${user.id}`);
    return ctx.reply(
      `Готово, ${user.name || 'друг'}! Буду присылать напоминания о делах по коту. ` +
        'Отмечать можно прямо здесь, кнопкой «✅ Сделано».\n\n/today — что сегодня',
    );
  });

  bot.command('today', async (ctx) => {
    const user = await db.findUserByChat(ctx.chat.id);
    if (!user)
      return ctx.reply('Сначала подключите Telegram в приложении: «Дом» → «Подключить Telegram».');
    const state = await householdOf(db, user.household);
    if (!state) return ctx.reply('Не нашёл ваш дом.');
    const tz = state.household.timezone || DEFAULT_TZ;
    const now = new Date();
    const items = state.tasks
      .map((task) => ({
        task,
        ev: evaluate(
          task.schedule,
          state.completions
            .filter((c) => c.task === task.id)
            .map((c) => ({ doneAt: c.done_at, kind: c.kind })),
          { now, tz, snoozedUntil: state.snoozes.find((s) => s.task === task.id)?.until ?? null },
        ),
      }))
      .sort((a, b) => urgencyCompare(a.ev, b.ev));
    const line = (i: (typeof items)[number]) =>
      `${i.task.emoji || '🐾'} ${escapeHtml(i.task.title)} — ${i.ev.status === 'done' ? 'сделано' : describeDue(i.ev, now, tz)}`;
    const pending = items.filter((i) => ['overdue', 'due', 'soon'].includes(i.ev.status));
    const done = items.filter((i) => i.ev.status === 'done');
    const parts = [`<b>Сегодня у ${escapeHtml(state.cat?.name ?? 'кота')}</b>`];
    parts.push(pending.length ? pending.map(line).join('\n') : 'Всё сделано 🎉');
    if (done.length)
      parts.push(`<i>Сделано: ${done.map((i) => escapeHtml(i.task.title)).join(', ')}</i>`);
    return ctx.reply(parts.join('\n\n') + appLink(), { parse_mode: 'HTML' });
  });

  bot.command('ping', (ctx) => ctx.reply(status()));

  bot.on('callback_query:data', async (ctx: Context) => {
    const data = ctx.callbackQuery?.data ?? '';
    const cb = parseCallback(data);
    if (!cb || !ctx.from) return ctx.answerCallbackQuery();
    const user = await db.findUserByChat(ctx.from.id);
    if (!user) {
      return ctx.answerCallbackQuery({
        text: 'Подключите Telegram в приложении, чтобы отмечать дела отсюда.',
        show_alert: true,
      });
    }
    const state = await householdOf(db, user.household);
    const task = state?.tasks.find((t) => t.id === cb.taskId);
    if (!state || !task) {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
      return ctx.answerCallbackQuery({ text: 'Это дело больше не отслеживается.' });
    }
    const tz = state.household.timezone || DEFAULT_TZ;
    const now = new Date();
    const ev = evaluate(
      task.schedule,
      state.completions
        .filter((c) => c.task === task.id)
        .map((c) => ({ doneAt: c.done_at, kind: c.kind })),
      { now, tz },
    );
    const pending =
      ev.due?.getTime() === cb.occurrence.getTime() &&
      ['due', 'overdue', 'soon'].includes(ev.status);

    if (!pending) {
      // Someone already handled it (maybe in the app): show who and close the reminders.
      const last = ev.lastCompletion;
      const who = last ? state.completions.find((c) => c.done_at === last.doneAt)?.user : undefined;
      const name = state.users.find((u) => u.id === who)?.name;
      await ctx.answerCallbackQuery({
        text: last
          ? `Уже сделано${name ? `: ${name}` : ''}, ${timeIn(tz, new Date(last.doneAt))}`
          : 'Уже неактуально',
      });
      await reminders.resolveHandled(await db.loadAll(), now);
      return;
    }

    if (cb.action === 'z') {
      const until = new Date(now.getTime() + 60 * 60 * 1000);
      await db.snooze(task, user, until);
      const logs = await db.forgetReminders(task.id, cb.occurrence);
      const line = resolutionLine('snoozed', user.name, timeIn(tz, until));
      for (const l of logs) await reminders.finish({ ...l, id: '' }, line);
      return ctx.answerCallbackQuery({ text: `Напомню в ${timeIn(tz, until)}` });
    }

    await db.createCompletion(task, user, cb.action === 's' ? 'skipped' : 'done');
    await ctx.answerCallbackQuery({ text: cb.action === 's' ? 'Пропущено' : 'Отмечено ✅' });
    await reminders.resolveHandled(await db.loadAll(), new Date());
  });
}
