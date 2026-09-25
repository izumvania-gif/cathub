import http from 'node:http';
import https from 'node:https';
import { Api, Bot } from 'grammy';
import { config } from './config';

// Force IPv4: IPv6 connections to Telegram hang until timeout on Amvera (CLAUDE.md, Constraints).
// Don't override DNS — the provider's transparent proxy may rely on the container resolver.
function agentFor(apiRoot: string | undefined, keepAlive: boolean) {
  const isHttp = apiRoot?.startsWith('http://');
  return isHttp
    ? new http.Agent({ family: 4, keepAlive })
    : new https.Agent({ family: 4, keepAlive });
}

function clientOptions(keepAlive: boolean, timeoutSeconds: number) {
  return {
    ...(config.telegramApiRoot && { apiRoot: config.telegramApiRoot }),
    timeoutSeconds,
    baseFetchConfig: { agent: agentFor(config.telegramApiRoot, keepAlive), compress: true },
  };
}

export function createBot(token: string): Bot {
  return new Bot(token, { client: clientOptions(true, 60) });
}

export type TelegramProbe = { ok: boolean; ms: number; error?: string; username?: string };

/**
 * Calls getMe on a fresh connection. A warm long-polling connection can hide that new
 * connections no longer get through, so health checks must not reuse it.
 */
export async function probeTelegram(token: string): Promise<TelegramProbe> {
  const api = new Api(token, clientOptions(false, 15));
  const started = performance.now();
  try {
    const me = await api.getMe();
    return { ok: true, ms: Math.round(performance.now() - started), username: me.username };
  } catch (err) {
    return {
      ok: false,
      ms: Math.round(performance.now() - started),
      error: describeError(err).slice(0, 500),
    };
  }
}

/** grammY's HttpError hides the network cause (ETIMEDOUT, ECONNRESET…) in `.error`. */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const inner = (err as { error?: unknown }).error;
  const cause =
    inner instanceof Error ? ((inner as NodeJS.ErrnoException).code ?? inner.message) : undefined;
  return cause ? `${err.message} (${cause})` : err.message;
}
