import {
  describeDue,
  describeSchedule,
  describeSupply,
  supplyForecast,
  evaluate,
  urgencyCompare,
  type Evaluation,
  type ReminderStage,
} from '@cathub/core';
import { InlineKeyboard } from 'grammy';
import { whoDoes } from './duty';
import type { HouseholdState, TaskRec } from './types';

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const STAGE_PREFIX: Record<ReminderStage, string> = {
  before: 'Скоро',
  due: 'Пора',
  overdue: 'Просрочено',
};

export function timeIn(tz: string, d: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(d);
}

export function reminderText(
  task: TaskRec,
  stage: ReminderStage,
  ev: Evaluation,
  now: Date,
  tz: string,
  catName?: string,
): string {
  const title = `${task.emoji || '🐾'} <b>${escapeHtml(task.title)}</b>`;
  const when = stage === 'due' ? '' : ` — ${describeDue(ev, now, tz)}`;
  const lines = [`${STAGE_PREFIX[stage]}: ${title}${when}`];
  const meta = [catName ? escapeHtml(catName) : null, describeSchedule(task.schedule)].filter(
    Boolean,
  );
  lines.push(`<i>${meta.join(' · ')}</i>`);
  if (task.medical) lines.push('Интервал — ориентир, уточните у ветеринара.');
  return lines.join('\n');
}

/**
 * callback_data: "<action>:<taskId>:<occurrence seconds>[:<userId>]" (under Telegram's 64 bytes).
 * d done, s skip, z snooze, t "I'll take it", p "pass it…" (asks to whom), g give to userId.
 */
export type CallbackAction = 'd' | 's' | 'z' | 't' | 'p' | 'g';

export function reminderKeyboard(taskId: string, occurrence: Date, opts: { group?: boolean } = {}) {
  const occ = Math.round(occurrence.getTime() / 1000);
  const kb = new InlineKeyboard()
    .text('✅ Сделано', `d:${taskId}:${occ}`)
    .row()
    .text('⏰ +1 ч', `z:${taskId}:${occ}`)
    .text('⏭ Пропустить', `s:${taskId}:${occ}`)
    .row();
  return opts.group
    ? kb.text('🙋 Возьму', `t:${taskId}:${occ}`)
    : kb.text('👉 Передать', `p:${taskId}:${occ}`);
}

/** "To whom?" after 👉: one button per other member. */
export function passKeyboard(
  taskId: string,
  occurrence: Date,
  people: Array<{ id: string; name: string }>,
) {
  const occ = Math.round(occurrence.getTime() / 1000);
  const kb = new InlineKeyboard();
  for (const p of people) kb.text(p.name, `g:${taskId}:${occ}:${p.id}`).row();
  return kb;
}

export function parseCallback(
  data: string,
): { action: CallbackAction; taskId: string; occurrence: Date; userId?: string } | null {
  const m = /^([dsztpg]):([a-z0-9]{15}):(\d{9,11})(?::([a-z0-9]{15}))?$/.exec(data);
  if (!m) return null;
  const action = m[1] as CallbackAction;
  if ((action === 'g') !== Boolean(m[4])) return null;
  return {
    action,
    taskId: m[2]!,
    occurrence: new Date(Number(m[3]) * 1000),
    ...(m[4] ? { userId: m[4] } : {}),
  };
}

/** Line appended to a reminder once it's handled, e.g. "✅ Петя, 20:03". */
export function resolutionLine(
  kind: 'done' | 'skipped' | 'snoozed' | 'gone',
  who: string | null,
  time: string,
  fish = 0,
) {
  const name = who ? escapeHtml(who) : 'Кто-то';
  switch (kind) {
    case 'done':
      return `✅ ${name}, ${time}${fish > 0 ? ` · +${fish} 🐟` : ''}`;
    case 'skipped':
      return `⏭ Пропущено (${name}), ${time}`;
    case 'snoozed':
      return `⏰ Отложено до ${time} (${name})`;
    case 'gone':
      return '✔️ Уже неактуально';
  }
}

/** "сегодня в 21:00" / "завтра в 09:00" / "3 окт. в 12:00" for an occurrence. */
export function whenText(at: Date, now: Date, tz: string): string {
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  const time = timeIn(tz, at);
  if (day(at) === day(now)) return `сегодня в ${time}`;
  if (day(at) === day(new Date(now.getTime() + 86_400_000))) return `завтра в ${time}`;
  const date = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: tz,
  }).format(at);
  return `${date} в ${time}`;
}

/** "Today" overview used by /today and the morning digest. */
export function summaryText(
  state: HouseholdState,
  now: Date,
  heading: string,
  appUrl?: string,
  /** Personal digest: this user's chores first, then everyone's; others' are only counted. */
  forUser?: string,
): { text: string; pending: number } {
  const tz = state.household.timezone || 'Europe/Moscow';
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
  const pending = items.filter((i) => ['overdue', 'due', 'soon'].includes(i.ev.status));
  const done = items.filter((i) => i.ev.status === 'done');
  const line = (i: (typeof items)[number]) =>
    `${i.task.emoji || '🐾'} ${escapeHtml(i.task.title)} — ${describeDue(i.ev, now, tz)}`;
  const parts = [`<b>${escapeHtml(heading)}</b>`];
  if (forUser && state.users.length > 1 && pending.length) {
    const who = (i: (typeof items)[number]) => whoDoes(state, i.task, i.ev.due).user;
    const mine = pending.filter((i) => who(i) === forUser);
    const common = pending.filter((i) => who(i) === null);
    const others = pending.length - mine.length - common.length;
    if (mine.length) parts.push('<b>Твои</b>\n' + mine.map(line).join('\n'));
    if (common.length) parts.push('<b>Общие</b>\n' + common.map(line).join('\n'));
    if (others) parts.push(`<i>И ещё ${others} у других</i>`);
    if (!mine.length && !common.length) parts.push('У тебя на сегодня всё 🎉');
  } else {
    parts.push(pending.length ? pending.map(line).join('\n') : 'Всё сделано 🎉');
  }
  const low = (state.supplies ?? [])
    .map((s) => ({
      s,
      f: supplyForecast(
        { stock: s.stock, stockAt: s.stock_at, dailyUsage: s.daily_usage, lowDays: s.low_days },
        now,
        tz,
      ),
    }))
    .filter((x) => x.f.status !== 'ok');
  if (low.length) {
    parts.push(
      '<b>Пора купить</b>\n' +
        low
          .map((x) => `${x.s.emoji || '📦'} ${escapeHtml(x.s.name)} — ${describeSupply(x.f)}`)
          .join('\n'),
    );
  }
  if (done.length)
    parts.push(`<i>Уже сделано: ${done.map((i) => escapeHtml(i.task.title)).join(', ')}</i>`);
  if (state.fish !== undefined) parts.push(`🐟 В копилке: ${state.fish}`);
  if (appUrl) parts.push(`Приложение: ${appUrl}`);
  return { text: parts.join('\n\n'), pending: pending.length + low.length };
}
