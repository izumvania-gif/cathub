import {
  DEFAULT_QUIET_HOURS,
  evaluate,
  isQuietTime,
  reminderPlan,
  type CompletionLike,
} from '@cathub/core';
import { GrammyError, type Api } from 'grammy';
import { log } from './log';
import { reminderKeyboard, reminderText, resolutionLine, timeIn } from './messages';
import { reminderKey, type PocketBaseClient } from './pocketbase';
import type { HouseholdState, ReminderLogRec, TaskRec } from './types';

const DEFAULT_TZ = 'Europe/Moscow';

function completionsOf(state: HouseholdState, taskId: string): CompletionLike[] {
  return state.completions
    .filter((c) => c.task === taskId)
    .map((c) => ({ doneAt: c.done_at, kind: c.kind }));
}

function snoozeOf(state: HouseholdState, taskId: string) {
  return state.snoozes.find((s) => s.task === taskId)?.until ?? null;
}

export class ReminderService {
  /** Keys sent during this process lifetime, in case writing the log failed. */
  private sentInProcess = new Set<string>();

  constructor(
    private readonly api: Api,
    private readonly db: PocketBaseClient,
  ) {}

  /** One pass: send due reminders, then update messages whose task is now handled. */
  async tick(now = new Date()): Promise<void> {
    const states = await this.db.loadAll();
    const sent = await this.db.sentKeys();
    for (const state of states) await this.sendDue(state, sent, now);
    await this.resolveHandled(states, now);
  }

  private async sendDue(state: HouseholdState, sent: Set<string>, now: Date) {
    const tz = state.household.timezone || DEFAULT_TZ;
    const recipients = state.users.filter((u) => u.telegram_chat_id && u.notify);
    if (!recipients.length) return;
    for (const task of state.tasks) {
      const completions = completionsOf(state, task.id);
      const opts = { now, tz, snoozedUntil: snoozeOf(state, task.id) };
      const decision = reminderPlan(task.schedule, completions, opts);
      if (!decision) continue;
      const ev = evaluate(task.schedule, completions, opts);
      const to = task.assignee ? recipients.filter((u) => u.id === task.assignee) : recipients;
      for (const user of to) {
        if (isQuietTime(now, tz, user.quiet_hours ?? DEFAULT_QUIET_HOURS)) continue;
        const key = reminderKey(
          task.id,
          decision.occurrence,
          decision.stage,
          user.telegram_chat_id,
        );
        if (sent.has(key) || this.sentInProcess.has(key)) continue;
        this.sentInProcess.add(key);
        try {
          const text = reminderText(task, decision.stage, ev, now, tz, state.cat?.name);
          const msg = await this.api.sendMessage(user.telegram_chat_id, text, {
            parse_mode: 'HTML',
            reply_markup: reminderKeyboard(task.id, decision.occurrence),
          });
          await this.db.logReminder({
            task: task.id,
            occurrence_at: decision.occurrence.toISOString().replace('T', ' '),
            stage: decision.stage,
            chat_id: user.telegram_chat_id,
            message_id: msg.message_id,
            text,
          });
          log.info(`reminder ${decision.stage} "${task.title}" → ${user.name || user.id}`);
        } catch (err) {
          if (err instanceof GrammyError && (err.error_code === 403 || err.error_code === 400)) {
            // Blocked the bot or chat gone: keep the key so we don't retry every minute.
            log.warn(`cannot message ${user.name || user.id}: ${err.description}`);
          } else {
            this.sentInProcess.delete(key); // network error: retry next tick
            log.warn(`sending reminder failed: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    }
  }

  /**
   * Edits open reminders whose occurrence was handled (in the app or from another chat), so
   * everyone sees "✅ Петя, 20:03" and nobody feeds the cat twice.
   */
  async resolveHandled(states: HouseholdState[], now = new Date()): Promise<void> {
    const open = await this.db.openReminders();
    if (!open.length) return;
    const byTask = new Map<string, { state: HouseholdState; task: TaskRec }>();
    for (const state of states)
      for (const task of state.tasks) byTask.set(task.id, { state, task });

    for (const r of open) {
      const found = byTask.get(r.task);
      if (!found) {
        await this.finish(r, resolutionLine('gone', null, ''));
        continue;
      }
      const { state, task } = found;
      const tz = state.household.timezone || DEFAULT_TZ;
      const occurrence = new Date(r.occurrence_at);
      const ev = evaluate(task.schedule, completionsOf(state, task.id), { now, tz });
      const stillPending =
        ev.due?.getTime() === occurrence.getTime() &&
        (ev.status === 'due' || ev.status === 'overdue' || ev.status === 'soon');
      if (stillPending) continue;
      // The completion that handled it: the latest one made after the reminder was sent.
      // None means the occurrence simply passed (e.g. a missed slot replaced by the next one).
      const sentAt = Date.parse(r.sent_at) - 60_000;
      const handled = state.completions
        .filter((c) => c.task === task.id && Date.parse(c.done_at) >= sentAt)
        .sort((a, b) => b.done_at.localeCompare(a.done_at))[0];
      const who = handled ? (state.users.find((u) => u.id === handled.user)?.name ?? null) : null;
      const line = handled
        ? resolutionLine(handled.kind, who, timeIn(tz, new Date(handled.done_at)))
        : resolutionLine('gone', null, '');
      await this.finish(r, line);
    }
  }

  /** Removes the buttons and appends a status line to one reminder message. */
  async finish(r: Pick<ReminderLogRec, 'id' | 'chat_id' | 'message_id' | 'text'>, line: string) {
    try {
      if (r.text) {
        await this.api.editMessageText(r.chat_id, r.message_id, `${r.text}\n\n${line}`, {
          parse_mode: 'HTML',
        });
      } else {
        await this.api.editMessageReplyMarkup(r.chat_id, r.message_id, { reply_markup: undefined });
      }
    } catch (err) {
      if (!(err instanceof GrammyError)) throw err; // network: retry next tick
      log.warn(`cannot update reminder message: ${err.description}`);
    }
    if (r.id) await this.db.resolveReminder(r.id);
  }
}
