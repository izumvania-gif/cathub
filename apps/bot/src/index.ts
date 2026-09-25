import { GrammyError, type Bot } from 'grammy';
import { config } from './config';
import { log } from './log';
import { PocketBaseClient } from './pocketbase';
import { backoffMs, sleep } from './retry';
import { createBot, probeTelegram, type TelegramProbe } from './telegram';

const startedAt = Date.now();
const uptimeS = () => Math.round((Date.now() - startedAt) / 1000);
let stopping = false;
let lastProbe: TelegramProbe | undefined;

function registerHandlers(bot: Bot) {
  bot.command('start', (ctx) =>
    ctx.reply(
      'Привет! Это бот CatHub. Скоро здесь будут напоминания про кота 🐈\n\n/ping — проверить связь',
    ),
  );
  bot.command('ping', (ctx) => {
    const probe = lastProbe
      ? `${lastProbe.ok ? 'ok' : 'ошибка'}, ${lastProbe.ms} мс`
      : 'ещё не было';
    return ctx.reply(
      `pong 🏓\nверсия: ${config.version}\nаптайм: ${uptimeS()} с\nпоследняя проверка Telegram: ${probe}`,
    );
  });
  bot.catch((err) => log.error(`handler error for update ${err.ctx.update.update_id}`, err.error));
}

/** Long polling that survives network failures and 409s during container restarts. */
async function runPolling(bot: Bot) {
  for (let attempt = 0; !stopping; attempt++) {
    try {
      const me = await bot.api.getMe();
      log.info(`polling as @${me.username}`);
      attempt = 0;
      await bot.start({ drop_pending_updates: false });
    } catch (err) {
      if (stopping) return;
      if (err instanceof GrammyError && err.error_code === 401) {
        log.error('BOT_TOKEN rejected by Telegram (401); polling disabled');
        return;
      }
      const wait = backoffMs(attempt);
      log.warn(`polling failed, retrying in ${Math.round(wait / 1000)}s`, err);
      await sleep(wait);
    }
  }
}

async function heartbeatLoop(pb: PocketBaseClient) {
  let lastPrune = 0;
  while (!stopping) {
    if (config.botToken) {
      lastProbe = await probeTelegram(config.botToken);
      if (!lastProbe.ok)
        log.warn(`telegram probe failed after ${lastProbe.ms}ms: ${lastProbe.error}`);
    }
    if (pb.enabled) {
      try {
        await pb.writeHeartbeat({
          telegram_ok: lastProbe?.ok ?? false,
          telegram_ms: lastProbe?.ms ?? 0,
          telegram_error: config.botToken ? (lastProbe?.error ?? '') : 'BOT_TOKEN not set',
          uptime_s: uptimeS(),
        });
        if (Date.now() - lastPrune > 60 * 60 * 1000) {
          await pb.pruneDiagnostics();
          lastPrune = Date.now();
        }
      } catch (err) {
        log.warn('pocketbase heartbeat failed', err);
      }
    }
    await sleep(config.heartbeatIntervalMs);
  }
}

async function main() {
  log.info(
    `cathub bot ${config.version} starting; pocketbase=${config.pbUrl}, apiRoot=${config.telegramApiRoot ?? 'default'}`,
  );
  const pb = new PocketBaseClient();
  if (!pb.enabled) log.warn('PB_SUPERUSER_EMAIL/PASSWORD not set; heartbeats disabled');

  let bot: Bot | undefined;
  if (config.botToken) {
    bot = createBot(config.botToken);
    registerHandlers(bot);
  } else {
    log.warn('BOT_TOKEN not set; running without Telegram');
  }

  const shutdown = async (signal: string) => {
    log.info(`${signal} received, stopping`);
    stopping = true;
    await bot?.stop();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await Promise.all([bot ? runPolling(bot) : Promise.resolve(), heartbeatLoop(pb)]);
}

process.on('unhandledRejection', (err) => log.error('unhandled rejection', err));
void main();
