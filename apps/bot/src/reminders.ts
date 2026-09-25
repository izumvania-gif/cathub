import {
  DEFAULT_QUIET_HOURS,
  digestDue,
  evaluate,
  isQuietTime,
  localDate,
  localDayBounds,
  PERFECT_DAY_FISH,
  perfectDay,
  reminderPlan,
  rewardFor,
  taskWeight,
  type CompletionLike,
  type QuietHours,
} from '@cathub/core';
import { config } from './config';
import { GrammyError, type Api } from 'grammy';
import { log } from './log';
import { reminderKeyboard, reminderText, resolutionLine, summaryText, timeIn } from './messages';
import { reminderKey, type PocketBaseClient } from './pocketbase';
import type { HouseholdState, ReminderLogRec, TaskRec, UserRec } from './types';

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
  /** Household days already checked for the perfect-day bonus. */
  private checkedDays = new Set<string>();

  constructor(
    private readonly api: Api,
    private readonly db: PocketBaseClient,
  ) {}

  /** One pass: send due reminders and digests, then update messages whose task is now handled. */
  async tick(now = new Date()): Promise<void> {
    const states = await this.db.loadAll();
    await this.rewardPending(states);
    await this.perfectDays(states, now);
    const sent = await this.db.sentKeys();
    for (const state of states) {
      await this.sendDue(state, sent, now);
      await this.sendDigests(state, now);
    }
    await this.resolveHandled(states, now);
  }

  /**
   * Prices new completions in fish 🐟 (core's rewardFor, from the task's status when it was
   * done) and stores the amount on the completion; the balance is a view over these.
   */
  async rewardPending(states: HouseholdState[]): Promise<void> {
    for (const state of states) {
      const tz = state.household.timezone || DEFAULT_TZ;
      for (const c of state.completions) {
        if (c.rewarded) continue;
        const task = state.tasks.find((t) => t.id === c.task);
        if (!task) continue;
        const fish = rewardFor({
          schedule: task.schedule,
          weight: taskWeight(task),
          others: completionsOf(state, task.id),
          completion: { doneAt: c.done_at, kind: c.kind },
          tz,
        });
        try {
          await this.db.setReward(c.id, fish);
          c.fish = fish;
          c.rewarded = true;
        } catch (err) {
          log.warn(`cannot store reward: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  }

  /** +10 🐟 for yesterday if every daily chore slot was covered. */
  private async perfectDays(states: HouseholdState[], now: Date) {
    for (const state of states) {
      const tz = state.household.timezone || DEFAULT_TZ;
      const date = localDate(new Date(now.getTime() - 86_400_000), tz);
      const key = `${state.household.id}:${date}`;
      if (this.checkedDays.has(key)) continue;
      const [start, end] = localDayBounds(date, tz);
      const tasks = state.tasks
        .filter((t) => Date.parse(t.created.replace(' ', 'T')) < start.getTime())
        .map((t) => ({ schedule: t.schedule, completions: completionsOf(state, t.id) }));
      try {
        if (perfectDay(tasks, start, end, tz)) {
          const added = await this.db.addBonus(
            state.household.id,
            date,
            'perfect_day',
            PERFECT_DAY_FISH,
          );
          if (added) log.info(`perfect day ${date} for household ${state.household.id}`);
        }
        this.checkedDays.add(key);
      } catch (err) {
        log.warn(`perfect day check failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  /**
   * Where a task's reminders go: the assignee's private chat if the task has one; otherwise the
   * household group chat if linked (one message for everyone), else every member's private chat.
   */
  private destinations(
    state: HouseholdState,
    task: TaskRec,
  ): Array<{ chatId: string; quiet: QuietHours; label: string }> {
    const personal = state.users.filter((u) => u.telegram_chat_id && u.notify);
    const toUser = (u: UserRec) => ({
      chatId: u.telegram_chat_id,
      quiet: u.quiet_hours ?? DEFAULT_QUIET_HOURS,
      label: u.name || u.id,
    });
    if (task.assignee) return personal.filter((u) => u.id === task.assignee).map(toUser);
    const group = state.household.telegram_group_chat_id;
    if (group) return [{ chatId: group, quiet: config.groupQuietHours, label: 'семейный чат' }];
    return personal.map(toUser);
  }

  private async sendDue(state: HouseholdState, sent: Set<string>, now: Date) {
    const tz = state.household.timezone || DEFAULT_TZ;
    for (const task of state.tasks) {
      const completions = completionsOf(state, task.id);
      const opts = { now, tz, snoozedUntil: snoozeOf(state, task.id) };
      const decision = reminderPlan(task.schedule, completions, opts);
      if (!decision) continue;
      const ev = evaluate(task.schedule, completions, opts);
      for (const dest of this.destinations(state, task)) {
        if (isQuietTime(now, tz, dest.quiet)) continue;
        const key = reminderKey(task.id, decision.occurrence, decision.stage, dest.chatId);
        if (sent.has(key) || this.sentInProcess.has(key)) continue;
        this.sentInProcess.add(key);
        try {
          const text = reminderText(task, decision.stage, ev, now, tz, state.cat?.name);
          const msg = await this.api.sendMessage(dest.chatId, text, {
            parse_mode: 'HTML',
            reply_markup: reminderKeyboard(task.id, decision.occurrence),
          });
          await this.db.logReminder({
            task: task.id,
            occurrence_at: decision.occurrence.toISOString().replace('T', ' '),
            stage: decision.stage,
            chat_id: dest.chatId,
            message_id: msg.message_id,
            text,
          });
          log.info(`reminder ${decision.stage} "${task.title}" → ${dest.label}`);
        } catch (err) {
          if (err instanceof GrammyError && (err.error_code === 403 || err.error_code === 400)) {
            // Blocked the bot or chat gone: keep the key so we don't retry every tick.
            log.warn(`cannot message ${dest.label}: ${err.description}`);
          } else {
            this.sentInProcess.delete(key); // network error: retry next tick
            log.warn(`sending reminder failed: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    }
  }

  /** Morning digest to each linked member's private chat, once per local day, only if there's something to do. */
  private async sendDigests(state: HouseholdState, now: Date) {
    const tz = state.household.timezone || DEFAULT_TZ;
    for (const user of state.users) {
      if (!user.telegram_chat_id || !user.notify) continue;
      const date = digestDue(now, tz, user.digest_time, user.digest_sent_on);
      if (!date) continue;
      const { text, pending } = summaryText(
        state,
        now,
        `Доброе утро! Сегодня у ${state.cat?.name ?? 'кота'}`,
        config.appUrl,
      );
      try {
        if (pending > 0) {
          await this.api.sendMessage(user.telegram_chat_id, text, {
            parse_mode: 'HTML',
            disable_notification: isQuietTime(now, tz, user.quiet_hours ?? DEFAULT_QUIET_HOURS),
          });
          log.info(`digest → ${user.name || user.id}`);
        }
        await this.db.markDigestSent(user.id, date);
        user.digest_sent_on = date;
      } catch (err) {
        if (err instanceof GrammyError) {
          log.warn(`cannot send digest to ${user.name || user.id}: ${err.description}`);
          await this.db.markDigestSent(user.id, date).catch(() => {});
        } else {
          log.warn(`digest failed: ${err instanceof Error ? err.message : err}`);
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
        ? resolutionLine(handled.kind, who, timeIn(tz, new Date(handled.done_at)), handled.fish)
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
