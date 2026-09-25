import { describeDue, describeSchedule, type Evaluation, type ReminderStage } from '@cathub/core';
import { InlineKeyboard } from 'grammy';
import type { TaskRec } from './types';

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
