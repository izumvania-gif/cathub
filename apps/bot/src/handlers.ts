import { evaluate } from '@cathub/core';
import type { Bot, Context } from 'grammy';
import { config } from './config';
import { log } from './log';
import { whoDoes } from './duty';
import {
  escapeHtml,
  parseCallback,
  passKeyboard,
  resolutionLine,
  summaryText,
  timeIn,
} from './messages';
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
const isGroup = (ctx: Context) => ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

async function householdOf(
  db: PocketBaseClient,
  householdId: string,
): Promise<HouseholdState | null> {
  const all = await db.loadAll();
  return all.find((s) => s.household.id === householdId) ?? null;
}

async function householdOfGroup(
  db: PocketBaseClient,
  chatId: number,
): Promise<HouseholdState | null> {
  const all = await db.loadAll();
  return all.find((s) => s.household.telegram_group_chat_id === String(chatId)) ?? null;
}

export function registerHandlers(bot: Bot, { db, reminders, status }: HandlerDeps) {
  bot.command('start', async (ctx) => {
    const token = ctx.match?.trim();
    if (!token) {
      if (isGroup(ctx)) {
        return ctx.reply(
          'Чтобы присылать сюда напоминания, подключите этот чат в приложении: «Дом» → «Семейный чат».',
        );
      }
      const user = await db.findUserByChat(ctx.chat.id).catch(() => null);
      return ctx.reply(
        user
          ? `Привет, ${user.name || 'друг'}! Я уже на связи и буду напоминать о делах по коту 🐈\n\n/today — что сегодня`
          : 'Привет! Я бот CatHub и напоминаю о делах по коту.\n\nЧтобы подключиться, откройте приложение → «Дом» → «Подключить Telegram».' +
              appLink(),
      );
    }
    const linked = await db.linkChat(token, ctx.chat.id, ctx.from?.username);
    if (!linked) {
      return ctx.reply(
        'Ссылка устарела или уже использована. Нажмите кнопку в приложении ещё раз.',
      );
    }
    if (linked.kind === 'group') {
      log.info(`linked group ${ctx.chat.id} to household ${linked.household.id}`);
      return ctx.reply(
        'Готово! Сюда будут приходить напоминания об общих делах по коту. ' +
          'Отмечать «✅ Сделано» может любой, кто подключил свой Telegram в приложении.\n\n/today — что сегодня',
      );
    }
    log.info(`linked chat ${ctx.chat.id} to user ${linked.user.id}`);
    return ctx.reply(
      `Готово, ${linked.user.name || 'друг'}! Буду присылать напоминания о делах по коту. ` +
        'Отмечать можно прямо здесь, кнопкой «✅ Сделано».\n\n/today — что сегодня',
    );
  });

  bot.command('today', async (ctx) => {
    let state: HouseholdState | null;
    let forUser: string | undefined;
    if (isGroup(ctx)) {
      state = await householdOfGroup(db, ctx.chat.id);
      if (!state) return ctx.reply('Этот чат не подключён. В приложении: «Дом» → «Семейный чат».');
    } else {
      const user = await db.findUserByChat(ctx.chat.id);
      if (!user)
        return ctx.reply(
          'Сначала подключите Telegram в приложении: «Дом» → «Подключить Telegram».',
        );
      state = await householdOf(db, user.household);
      if (!state) return ctx.reply('Не нашёл ваш дом.');
      forUser = user.id;
    }
    const { text } = summaryText(
      state,
      new Date(),
      `Сегодня у ${state.cat?.name ?? 'кота'}`,
      config.appUrl,
      forUser,
    );
    return ctx.reply(text, { parse_mode: 'HTML' });
  });

  bot.command('ping', (ctx) => ctx.reply(status()));

  // Removed from a group → stop sending household reminders there.
  bot.on('my_chat_member', async (ctx) => {
    const st = ctx.myChatMember.new_chat_member.status;
    if ((st === 'left' || st === 'kicked') && isGroup(ctx)) {
      await db.unlinkGroup(ctx.chat.id);
      log.info(`bot removed from group ${ctx.chat.id}; unlinked`);
    }
  });

  bot.on('callback_query:data', async (ctx: Context) => {
    const cb = parseCallback(ctx.callbackQuery?.data ?? '');
    if (!cb || !ctx.from) return ctx.answerCallbackQuery();
    // The presser is identified by their own Telegram id (private chat id = user id), also in groups.
    const user = await db.findUserByChat(ctx.from.id);
    if (!user) {
      return ctx.answerCallbackQuery({
        text: 'Подключите свой Telegram в приложении («Дом» → «Подключить Telegram»), чтобы отмечать дела отсюда.',
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

    if (cb.action === 't' || cb.action === 'g') {
      // "I'll take it" (from the family chat) or "give it to …" (after 👉).
      const to = cb.action === 't' ? user : state.users.find((u) => u.id === cb.userId);
      if (!to) return ctx.answerCallbackQuery({ text: 'Этого человека больше нет в доме.' });
      await db.handOver(task, cb.occurrence, to.id, user.id, to.id === user.id);
      if (cb.action === 't') {
        await ctx.answerCallbackQuery({ text: 'Теперь это ваше 🙋' });
        await ctx.reply(
          `🙋 ${escapeHtml(user.name || 'Кто-то')} берёт на себя: ${task.emoji || '🐾'} ${escapeHtml(task.title)}`,
          { parse_mode: 'HTML' },
        );
      } else {
        await ctx.answerCallbackQuery({ text: `Передано: ${to.name}` });
        await ctx
          .editMessageText(
            `👉 Передано: ${escapeHtml(to.name || '')} — ${escapeHtml(task.title)}`,
            {
              parse_mode: 'HTML',
            },
          )
          .catch(() => {});
        // Tell them right away rather than on the next tick.
        await reminders.notifyHandOvers(await db.loadAll(), now);
      }
      return;
    }

    if (cb.action === 'p') {
      const current = whoDoes(state, task, cb.occurrence).user;
      const people = state.users
        .filter((u) => u.id !== current && u.id !== user.id)
        .map((u) => ({ id: u.id, name: u.name || 'Без имени' }));
      if (!people.length) return ctx.answerCallbackQuery({ text: 'Передать некому.' });
      await ctx.answerCallbackQuery();
      return ctx.reply(`Кому передать «${escapeHtml(task.title)}»?`, {
        parse_mode: 'HTML',
        reply_markup: passKeyboard(task.id, cb.occurrence, people),
      });
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
    const states = await db.loadAll();
    await reminders.rewardPending(states);
    await reminders.resolveHandled(states, new Date());
  });
}
