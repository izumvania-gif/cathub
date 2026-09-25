import PocketBase, { ClientResponseError } from 'pocketbase';
import { config } from './config';
import { log } from './log';
import type {
  AbsenceRec,
  CatRec,
  CompletionRec,
  HouseholdRec,
  HouseholdState,
  OverrideRec,
  ReminderLogRec,
  SnoozeRec,
  SupplyRec,
  TaskRec,
  UserRec,
} from './types';

export type Heartbeat = {
  bot_username: string;
  telegram_ok: boolean;
  telegram_ms: number;
  telegram_error: string;
  uptime_s: number;
};

/** PocketBase dates use a space: "2026-09-25 08:12:00.000Z". */
export const toIso = (d: string) => d.replace(' ', 'T');
export const toPbDate = (d: Date) => d.toISOString().replace('T', ' ');

const RECENT_DAYS = 60;
const OLDER_CACHE_MS = 60 * 60 * 1000;

export class PocketBaseClient {
  readonly pb = new PocketBase(config.pbUrl);
  /** Latest completion of tasks with nothing in the recent window; only changes via new completions. */
  private olderCache = new Map<string, { at: number; rec: CompletionRec | null }>();

  constructor() {
    this.pb.autoCancellation(false);
  }

  get enabled(): boolean {
    return Boolean(config.pbEmail && config.pbPassword);
  }

  async ensureAuth(): Promise<void> {
    if (this.pb.authStore.isValid) return;
    await this.pb
      .collection('_superusers')
      .authWithPassword(config.pbEmail!, config.pbPassword!, { autoRefreshThreshold: 30 * 60 });
  }

  // ── diagnostics ─────────────────────────────────────────────────────────

  async writeHeartbeat(hb: Heartbeat): Promise<void> {
    await this.ensureAuth();
    await this.pb
      .collection('diagnostics')
      .create({ kind: 'heartbeat', bot_version: config.version, ...hb });
  }

  async pruneDiagnostics(): Promise<number> {
    await this.ensureAuth();
    const cutoff = toPbDate(new Date(Date.now() - config.diagnosticsRetentionMs));
    const old = await this.pb
      .collection('diagnostics')
      .getFullList({ filter: this.pb.filter('created < {:cutoff}', { cutoff }), fields: 'id' });
    for (const r of old) await this.pb.collection('diagnostics').delete(r.id);
    if (old.length) log.info(`pruned ${old.length} old diagnostics records`);
    return old.length;
  }

  // ── household state ─────────────────────────────────────────────────────

  /** Loads all households with their tasks, completions, snoozes and members. */
  async loadAll(): Promise<HouseholdState[]> {
    await this.ensureAuth();
    const since = toPbDate(new Date(Date.now() - RECENT_DAYS * 86_400_000));
    // Hand-overs by creation: one for an overdue chore can point months back.
    const handedSince = toPbDate(new Date(Date.now() - 60 * 86_400_000));
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const [
      households,
      users,
      cats,
      tasks,
      recent,
      snoozes,
      supplies,
      balances,
      overrides,
      absences,
    ] = await Promise.all([
      this.pb.collection('households').getFullList<HouseholdRec>(),
      this.pb.collection('users').getFullList<UserRec>({ filter: 'household != ""' }),
      this.pb.collection('cats').getFullList<CatRec>({ sort: 'created' }),
      this.pb.collection('tasks').getFullList<TaskRec>({ filter: 'archived = false' }),
      this.pb
        .collection('completions')
        .getFullList<CompletionRec>({ filter: this.pb.filter('done_at >= {:since}', { since }) }),
      this.pb.collection('snoozes').getFullList<SnoozeRec>(),
      this.pb.collection('supplies').getFullList<SupplyRec>(),
      this.pb
        .collection('fish_balance')
        .getFullList<{ id: string; from_tasks: number; from_bonuses: number; spent: number }>(),
      this.pb.collection('duty_overrides').getFullList<OverrideRec>({
        filter: this.pb.filter('created >= {:s}', { s: handedSince }),
      }),
      this.pb
        .collection('absences')
        .getFullList<AbsenceRec>({ filter: this.pb.filter('to >= {:d}', { d: yesterday }) }),
    ]);
    const withRecent = new Set(recent.map((c) => c.task));
    const older = await Promise.all(
      tasks.filter((t) => !withRecent.has(t.id)).map((t) => this.latestOlder(t.id)),
    );
    const completions = [...recent, ...older.filter((c): c is CompletionRec => c !== null)].map(
      (c) => ({ ...c, done_at: toIso(c.done_at) }),
    );
    return households.map((household) => ({
      household,
      cat: cats.find((c) => c.household === household.id) ?? null,
      users: users.filter((u) => u.household === household.id),
      tasks: tasks.filter((t) => t.household === household.id),
      completions: completions.filter((c) => c.household === household.id),
      snoozes: snoozes
        .filter((s) => s.household === household.id)
        .map((s) => ({ ...s, until: toIso(s.until) })),
      supplies: supplies
        .filter((s) => s.household === household.id)
        .map((s) => ({ ...s, stock_at: toIso(s.stock_at) })),
      overrides: overrides
        .filter((o) => o.household === household.id)
        .map((o) => ({ ...o, occurrence_at: toIso(o.occurrence_at) })),
      absences: absences.filter((a) => a.household === household.id),
      fish: (() => {
        const b = balances.find((x) => x.id === household.id);
        return b ? b.from_tasks + b.from_bonuses - b.spent : undefined;
      })(),
    }));
  }

  private async latestOlder(taskId: string): Promise<CompletionRec | null> {
    const cached = this.olderCache.get(taskId);
    if (cached && Date.now() - cached.at < OLDER_CACHE_MS) return cached.rec;
    const res = await this.pb.collection('completions').getList<CompletionRec>(1, 1, {
      filter: this.pb.filter('task = {:task}', { task: taskId }),
      sort: '-done_at',
    });
    const rec = res.items[0] ?? null;
    this.olderCache.set(taskId, { at: Date.now(), rec });
    return rec;
  }

  // ── users & linking ─────────────────────────────────────────────────────

  async findUserByChat(chatId: number | string): Promise<UserRec | null> {
    await this.ensureAuth();
    try {
      return await this.pb
        .collection('users')
        .getFirstListItem<UserRec>(
          this.pb.filter('telegram_chat_id = {:c}', { c: String(chatId) }),
        );
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 404) return null;
      throw err;
    }
  }

  /**
   * Consumes a one-time link token. A "user" token binds this private chat to the user; a "group"
   * token binds this group chat to the household. Returns what was linked, or null if the token
   * is unknown or expired.
   */
  async linkChat(
    token: string,
    chatId: number,
    username: string | undefined,
  ): Promise<{ kind: 'user'; user: UserRec } | { kind: 'group'; household: HouseholdRec } | null> {
    await this.ensureAuth();
    let link: { id: string; user: string; kind: string; household: string; expires: string };
    try {
      link = await this.pb
        .collection('telegram_links')
        .getFirstListItem(this.pb.filter('token = {:t}', { t: token }));
    } catch {
      return null;
    }
    await this.pb.collection('telegram_links').delete(link.id);
    if (Date.parse(toIso(link.expires)) < Date.now()) return null;

    if (link.kind === 'group') {
      if (!link.household) return null;
      const household = await this.pb
        .collection('households')
        .update<HouseholdRec>(link.household, { telegram_group_chat_id: String(chatId) });
      return { kind: 'group', household };
    }
    // One chat ↔ one user: unbind the chat from anyone else first.
    const others = await this.pb.collection('users').getFullList<UserRec>({
      filter: this.pb.filter('telegram_chat_id = {:c}', { c: String(chatId) }),
    });
    for (const o of others)
      await this.pb.collection('users').update(o.id, { telegram_chat_id: '', notify: false });
    const user = await this.pb.collection('users').update<UserRec>(link.user, {
      telegram_chat_id: String(chatId),
      telegram_username: username ?? '',
      notify: true,
    });
    return { kind: 'user', user };
  }

  /** The bot was removed from a group: stop sending household reminders there. */
  async unlinkGroup(chatId: number): Promise<void> {
    await this.ensureAuth();
    const list = await this.pb.collection('households').getFullList<HouseholdRec>({
      filter: this.pb.filter('telegram_group_chat_id = {:c}', { c: String(chatId) }),
    });
    for (const h of list)
      await this.pb.collection('households').update(h.id, { telegram_group_chat_id: '' });
  }

  async markDigestSent(userId: string, localDate: string): Promise<void> {
    await this.pb.collection('users').update(userId, { digest_sent_on: localDate });
  }

  // ── actions from Telegram ───────────────────────────────────────────────

  async createCompletion(
    task: TaskRec,
    user: UserRec,
    kind: 'done' | 'skipped',
  ): Promise<CompletionRec> {
    await this.ensureAuth();
    const rec = await this.pb.collection('completions').create<CompletionRec>({
      household: task.household,
      task: task.id,
      user: user.id,
      done_at: toPbDate(new Date()),
      kind,
    });
    this.olderCache.delete(task.id);
    await this.clearSnoozes(task.id);
    return { ...rec, done_at: toIso(rec.done_at) };
  }

  // ── duties ────────────────────────────────────────────────────────────────

  /** Gives one occurrence of a task to `userId` (replacing an earlier hand-over). */
  async handOver(
    task: TaskRec,
    occurrence: Date,
    userId: string,
    byId: string,
    notified: boolean,
  ): Promise<void> {
    await this.ensureAuth();
    const at = toPbDate(occurrence);
    const old = await this.pb.collection('duty_overrides').getFullList({
      filter: this.pb.filter('task = {:t} && occurrence_at = {:at}', { t: task.id, at }),
    });
    for (const o of old) await this.pb.collection('duty_overrides').delete(o.id);
    await this.pb.collection('duty_overrides').create({
      household: task.household,
      task: task.id,
      occurrence_at: at,
      user: userId,
      by: byId,
      notified,
    });
  }

  async markOverrideNotified(id: string): Promise<void> {
    await this.ensureAuth();
    await this.pb.collection('duty_overrides').update(id, { notified: true });
  }

  // ── fish 🐟 ───────────────────────────────────────────────────────────────

  async setReward(completionId: string, fish: number): Promise<void> {
    await this.ensureAuth();
    await this.pb.collection('completions').update(completionId, { fish, rewarded: true });
  }

  /** Adds a bonus once per household, day and kind; false if it already existed. */
  async addBonus(household: string, date: string, kind: string, fish: number): Promise<boolean> {
    await this.ensureAuth();
    try {
      await this.pb.collection('fish_bonuses').create({ household, date, kind, fish });
      return true;
    } catch (err) {
      if (err instanceof ClientResponseError && err.status === 400) return false; // unique index
      throw err;
    }
  }

  async snooze(task: TaskRec, user: UserRec, until: Date): Promise<void> {
    await this.ensureAuth();
    await this.clearSnoozes(task.id);
    await this.pb.collection('snoozes').create({
      household: task.household,
      task: task.id,
      until: toPbDate(until),
      user: user.id,
    });
  }

  private async clearSnoozes(taskId: string) {
    const list = await this.pb
      .collection('snoozes')
      .getFullList({ filter: this.pb.filter('task = {:t}', { t: taskId }) });
    for (const s of list) await this.pb.collection('snoozes').delete(s.id);
  }

  // ── reminder log ────────────────────────────────────────────────────────

  /** Keys of reminders already sent for recent occurrences: task|occurrenceMs|stage|chat. */
  async sentKeys(sinceDays = 400): Promise<Set<string>> {
    await this.ensureAuth();
    const since = toPbDate(new Date(Date.now() - sinceDays * 86_400_000));
    const logs = await this.pb.collection('reminder_log').getFullList<ReminderLogRec>({
      filter: this.pb.filter('occurrence_at >= {:since}', { since }),
      fields: 'task,occurrence_at,stage,chat_id',
    });
    return new Set(
      logs.map((l) => reminderKey(l.task, new Date(toIso(l.occurrence_at)), l.stage, l.chat_id)),
    );
  }

  async logReminder(r: Omit<ReminderLogRec, 'id' | 'resolved' | 'sent_at'>): Promise<void> {
    await this.pb
      .collection('reminder_log')
      .create({ ...r, sent_at: toPbDate(new Date()), resolved: false });
  }

  async openReminders(): Promise<ReminderLogRec[]> {
    await this.ensureAuth();
    const since = toPbDate(new Date(Date.now() - 7 * 86_400_000));
    const list = await this.pb.collection('reminder_log').getFullList<ReminderLogRec>({
      filter: this.pb.filter('resolved = false && sent_at >= {:since}', { since }),
    });
    return list.map((l) => ({
      ...l,
      occurrence_at: toIso(l.occurrence_at),
      sent_at: toIso(l.sent_at),
    }));
  }

  async resolveReminder(id: string): Promise<void> {
    await this.pb.collection('reminder_log').update(id, { resolved: true });
  }

  /** After a snooze, drop the logs so the reminder can be sent again when the snooze ends. */
  async forgetReminders(taskId: string, occurrence: Date): Promise<ReminderLogRec[]> {
    await this.ensureAuth();
    const logs = await this.pb.collection('reminder_log').getFullList<ReminderLogRec>({
      filter: this.pb.filter('task = {:t} && occurrence_at = {:o}', {
        t: taskId,
        o: toPbDate(occurrence),
      }),
    });
    for (const l of logs) await this.pb.collection('reminder_log').delete(l.id);
    return logs;
  }
}

export function reminderKey(taskId: string, occurrence: Date, stage: string, chatId: string) {
  return `${taskId}|${occurrence.getTime()}|${stage}|${chatId}`;
}
