import { DEFAULT_QUIET_HOURS, type QuietHours } from '@cathub/core';

function parseQuiet(v: string | undefined): QuietHours {
  const m = /^(\d\d:\d\d)-(\d\d:\d\d)$/.exec(v?.trim() ?? '');
  return m ? { from: m[1]!, to: m[2]! } : DEFAULT_QUIET_HOURS;
}

export const config = {
  version: process.env.BOT_VERSION ?? 'dev',
  botToken: process.env.BOT_TOKEN?.trim() || undefined,
  /** Custom Bot API root for a fallback relay; empty means api.telegram.org (docs/DEPLOY_AMVERA.md §4). */
  telegramApiRoot: process.env.TELEGRAM_API_ROOT?.trim().replace(/\/+$/, '') || undefined,
  /** Public app URL for links in messages, e.g. https://cathub-user.amvera.io */
  appUrl: process.env.APP_URL?.trim().replace(/\/+$/, '') || undefined,
  pbUrl: process.env.PB_URL?.trim() || 'http://127.0.0.1:8090',
  pbEmail: process.env.PB_SUPERUSER_EMAIL?.trim() || undefined,
  pbPassword: process.env.PB_SUPERUSER_PASSWORD || undefined,
  /** Quiet hours for the household group chat, "HH:MM-HH:MM" (default 23:00-08:00). */
  groupQuietHours: parseQuiet(process.env.GROUP_QUIET_HOURS),
  heartbeatIntervalMs: Number(process.env.HEARTBEAT_INTERVAL_MS) || 60_000,
  reminderIntervalMs: Number(process.env.REMINDER_INTERVAL_MS) || 30_000,
  /** Diagnostics records older than this are pruned. */
  diagnosticsRetentionMs: 24 * 60 * 60 * 1000,
};
