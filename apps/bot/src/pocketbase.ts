import PocketBase, { ClientResponseError } from 'pocketbase';
import { config } from './config';
import { log } from './log';
import type {
  CatRec,
  CompletionRec,
  HouseholdRec,
  HouseholdState,
  ReminderLogRec,
  SnoozeRec,
  TaskRec,
  UserRec,
} from './types';

export type Heartbeat = {
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
    const [households, users, cats, tasks, recent, snoozes] = await Promise.all([
      this.pb.collection('households').getFullList<HouseholdRec>(),
      this.pb.collection('users').getFullList<UserRec>({ filter: 'household != ""' }),
      this.pb.collection('cats').getFullList<CatRec>({ sort: 'created' }),
      this.pb.collection('tasks').getFullList<TaskRec>({ filter: 'archived = false' }),
      this.pb
        .collection('completions')
        .getFullList<CompletionRec>({ filter: this.pb.filter('done_at >= {:since}', { since }) }),
      this.pb.collection('snoozes').getFullList<SnoozeRec>(),
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

  /** Consumes a one-time link token and binds the chat to its user. Returns the user or null. */
  async linkChat(
    token: string,
    chatId: number,
    username: string | undefined,
  ): Promise<UserRec | null> {
    await this.ensureAuth();
    let link: { id: string; user: string; expires: string };
    try {
      link = await this.pb
        .collection('telegram_links')
        .getFirstListItem(this.pb.filter('token = {:t}', { t: token }));
    } catch {
      return null;
    }
    await this.pb.collection('telegram_links').delete(link.id);
    if (Date.parse(toIso(link.expires)) < Date.now()) return null;
    // One chat ↔ one user: unbind the chat from anyone else first.
    const others = await this.pb.collection('users').getFullList<UserRec>({
      filter: this.pb.filter('telegram_chat_id = {:c}', { c: String(chatId) }),
    });
    for (const o of others)
      await this.pb.collection('users').update(o.id, { telegram_chat_id: '', notify: false });
    return this.pb.collection('users').update<UserRec>(link.user, {
      telegram_chat_id: String(chatId),
      telegram_username: username ?? '',
      notify: true,
    });
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
