import { buildIcs, calendarEvents } from '@cathub/core';
import http from 'node:http';
import { config } from './config';
import { log } from './log';
import type { PocketBaseClient } from './pocketbase';
import { verifyInitData } from './webapp';

/**
 * Internal HTTP server (127.0.0.1 only): builds a household's .ics feed with packages/core
 * (PocketBase proxies GET /api/cathub/calendar/{token} here after checking the secret token) and
 * verifies Telegram Mini App initData for POST /api/cathub/telegram/webapp-auth.
 */
export function startCalendarServer(db: PocketBaseClient): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/webapp-verify') {
      // Mini App login: PocketBase forwards initData here; only the bot knows BOT_TOKEN.
      let body = '';
      for await (const chunk of req) body += chunk;
      const initData = (JSON.parse(body || '{}') as { initData?: string }).initData ?? '';
      const ok = config.botToken ? verifyInitData(initData, config.botToken) : null;
      res
        .writeHead(ok ? 200 : 401, { 'content-type': 'application/json' })
        .end(JSON.stringify(ok ?? {}));
      return;
    }
    const m = /^\/ics\/([a-z0-9]{15})$/.exec(req.url ?? '');
    if (req.method !== 'GET' || !m) {
      res.writeHead(404).end();
      return;
    }
    try {
      const states = await db.loadAll();
      const state = states.find((s) => s.household.id === m[1]);
      if (!state) {
        res.writeHead(404).end();
        return;
      }
      const now = new Date();
      const tz = state.household.timezone || 'Europe/Moscow';
      const catName = state.cat?.name;
      const events = calendarEvents(
        state.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          emoji: t.emoji,
          medical: t.medical,
          schedule: t.schedule,
          completions: state.completions
            .filter((c) => c.task === t.id)
            .map((c) => ({ doneAt: c.done_at, kind: c.kind })),
        })),
        { now, tz, catName },
      );
      const ics = buildIcs(events, { name: `CatHub${catName ? `: ${catName}` : ''}`, now });
      res.writeHead(200, { 'content-type': 'text/calendar; charset=utf-8' }).end(ics);
    } catch (err) {
      log.warn('calendar build failed', err);
      res.writeHead(500).end();
    }
  });
  server.listen(config.icsPort, '127.0.0.1', () =>
    log.info(`calendar feed on 127.0.0.1:${config.icsPort}`),
  );
  server.on('error', (err) => log.error('calendar server error', err));
  return server;
}
