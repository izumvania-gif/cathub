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

/** callback_data: "<action>:<taskId>:<occurrence seconds>" (well under Telegram's 64 bytes). */
export type CallbackAction = 'd' | 's' | 'z';

export function reminderKeyboard(taskId: string, occurrence: Date) {
  const occ = Math.round(occurrence.getTime() / 1000);
  return new InlineKeyboard()
    .text('✅ Сделано', `d:${taskId}:${occ}`)
    .row()
    .text('⏰ +1 ч', `z:${taskId}:${occ}`)
    .text('⏭ Пропустить', `s:${taskId}:${occ}`);
}

export function parseCallback(
  data: string,
): { action: CallbackAction; taskId: string; occurrence: Date } | null {
  const m = /^([dsz]):([a-z0-9]{15}):(\d{9,11})$/.exec(data);
  if (!m) return null;
  return {
    action: m[1] as CallbackAction,
    taskId: m[2]!,
    occurrence: new Date(Number(m[3]) * 1000),
  };
}

/** Line appended to a reminder once it's handled, e.g. "✅ Петя, 20:03". */
export function resolutionLine(
  kind: 'done' | 'skipped' | 'snoozed' | 'gone',
  who: string | null,
  time: string,
) {
  const name = who ? escapeHtml(who) : 'Кто-то';
  switch (kind) {
    case 'done':
      return `✅ ${name}, ${time}`;
    case 'skipped':
      return `⏭ Пропущено (${name}), ${time}`;
    case 'snoozed':
      return `⏰ Отложено до ${time} (${name})`;
    case 'gone':
      return '✔️ Уже неактуально';
  }
}

/** "Today" overview used by /today and the morning digest. */
export function summaryText(
  state: HouseholdState,
  now: Date,
  heading: string,
  appUrl?: string,
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
  parts.push(pending.length ? pending.map(line).join('\n') : 'Всё сделано 🎉');
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
  if (appUrl) parts.push(`Приложение: ${appUrl}`);
  return { text: parts.join('\n\n'), pending: pending.length + low.length };
}
