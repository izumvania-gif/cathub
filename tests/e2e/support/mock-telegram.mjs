// Minimal Telegram Bot API mock for e2e tests.
// Bot calls are recorded; tests read them via GET /__calls and push updates via POST /__inject.
import http from 'node:http';

const port = Number(process.argv[2] || 18091);
const updates = [];
const calls = [];
const waiters = [];
let updateId = 1;
let messageId = 1000;

const ok = (res, result) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: true, result }));
};

http
  .createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, 'http://mock');
    if (url.pathname === '/__inject') {
      const u = JSON.parse(body);
      u.update_id = updateId++;
      updates.push(u);
      waiters.splice(0).forEach((w) => w());
      return ok(res, u.update_id);
    }
    if (url.pathname === '/__calls') return ok(res, calls);
    if (url.pathname === '/__health') return ok(res, true);

    const m = /^\/bot[^/]+\/(\w+)$/.exec(url.pathname);
    if (!m) {
      res.writeHead(404);
      return res.end();
    }
    const method = m[1];
    let params = {};
    try {
      params = body ? JSON.parse(body) : {};
    } catch {
      params = Object.fromEntries(new URLSearchParams(body));
    }
    if (typeof params.reply_markup === 'string')
      params.reply_markup = JSON.parse(params.reply_markup);
    if (method !== 'getUpdates') calls.push({ method, params, at: Date.now() });

    switch (method) {
      case 'getMe':
        return ok(res, { id: 42, is_bot: true, first_name: 'CatHub', username: 'cathub_e2e_bot' });
      case 'getUpdates': {
        const offset = Number(params.offset || 0);
        const pending = () => updates.filter((u) => u.update_id >= offset);
        if (!pending().length) {
          await new Promise((r) => {
            waiters.push(r);
            setTimeout(r, Math.min(Number(params.timeout || 0), 2) * 1000);
          });
        }
        return ok(res, pending());
      }
      case 'sendMessage':
        return ok(res, {
          message_id: messageId++,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: Number(params.chat_id),
            type: Number(params.chat_id) < 0 ? 'group' : 'private',
          },
          text: params.text,
        });
      default:
        return ok(res, true);
    }
  })
  .listen(port, '127.0.0.1');
