/// <reference path="../pb_data/types.d.ts" />

// Telegram linking (docs/PLAN.md §9). Handlers run in separate VMs, so helpers are required inside.

// POST /api/cathub/telegram/link → { url } to open t.me/<bot>?start=<one-time token>
routerAdd(
  'POST',
  '/api/cathub/telegram/link',
  (e) => {
    const tg = require(`${__hooks}/lib/telegram.js`);
    const bot = tg.botUsername();
    const token = tg.createLinkToken(e.auth.id, 'user', '');
    return e.json(200, { url: `https://t.me/${bot}?start=${token}` });
  },
  $apis.requireAuth('users'),
);

// POST /api/cathub/telegram/unlink → stop reminders to this user's chat.
routerAdd(
  'POST',
  '/api/cathub/telegram/unlink',
  (e) => {
    const u = $app.findRecordById('users', e.auth.id);
    u.set('telegram_chat_id', '');
    u.set('telegram_username', '');
    u.set('notify', false);
    $app.save(u);
    return e.json(200, { ok: true });
  },
  $apis.requireAuth('users'),
);

// POST /api/cathub/telegram/group-link → { url } that adds the bot to a group
// (t.me/<bot>?startgroup=<token>); the bot binds that group to the caller's household.
routerAdd(
  'POST',
  '/api/cathub/telegram/group-link',
  (e) => {
    const tg = require(`${__hooks}/lib/telegram.js`);
    const household = e.auth.getString('household');
    if (!household) throw new BadRequestError('Сначала создайте дом или присоединитесь к нему.');
    const bot = tg.botUsername();
    const token = tg.createLinkToken(e.auth.id, 'group', household);
    return e.json(200, { url: `https://t.me/${bot}?startgroup=${token}` });
  },
  $apis.requireAuth('users'),
);

// POST /api/cathub/telegram/group-unlink → reminders go back to personal chats.
routerAdd(
  'POST',
  '/api/cathub/telegram/group-unlink',
  (e) => {
    const household = e.auth.getString('household');
    if (!household) throw new BadRequestError('Вы не состоите в доме.');
    const h = $app.findRecordById('households', household);
    h.set('telegram_group_chat_id', '');
    $app.save(h);
    return e.json(200, { ok: true });
  },
  $apis.requireAuth('users'),
);

// POST /api/cathub/telegram/webapp-auth {initData} → auth response for the user whose Telegram
// is linked. The signature is checked by the bot (it has BOT_TOKEN), reached on its internal port.
routerAdd('POST', '/api/cathub/telegram/webapp-auth', (e) => {
  const initData = String((e.requestInfo().body || {}).initData || '');
  if (!initData || initData.length > 4096) throw new BadRequestError('Нет данных Telegram.');
  const base = String($os.getenv('BOT_INTERNAL_URL') || 'http://127.0.0.1:8091').replace(
    /\/+$/,
    '',
  );
  let res;
  try {
    res = $http.send({
      url: `${base}/webapp-verify`,
      method: 'POST',
      body: JSON.stringify({ initData }),
      headers: { 'content-type': 'application/json' },
      timeout: 10,
    });
  } catch (_) {
    throw new ApiError(503, 'Бот недоступен, войдите по почте и паролю.');
  }
  if (res.statusCode !== 200 || !res.json || !res.json.userId) {
    throw new UnauthorizedError('Не удалось проверить данные Telegram.');
  }
  let user;
  try {
    user = $app.findFirstRecordByData('users', 'telegram_chat_id', String(res.json.userId));
  } catch (_) {
    throw new NotFoundError(
      'Этот Telegram не привязан. Войдите по почте и паролю и нажмите «Подключить Telegram» на вкладке «Дом».',
    );
  }
  return $apis.recordAuthResponse(e, user, 'telegram', null);
});
