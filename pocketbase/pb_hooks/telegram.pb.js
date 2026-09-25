/// <reference path="../pb_data/types.d.ts" />

// Telegram linking. The bot username comes from TELEGRAM_BOT_USERNAME (same container env).

// POST /api/cathub/telegram/link → { url } to open t.me/<bot>?start=<one-time token>
routerAdd(
  'POST',
  '/api/cathub/telegram/link',
  (e) => {
    const bot = String($os.getenv('TELEGRAM_BOT_USERNAME') || '').replace(/^@/, '');
    if (!bot) throw new BadRequestError('Telegram-бот ещё не настроен на сервере.');
    const col = $app.findCollectionByNameOrId('telegram_links');
    // One active token per user.
    for (const old of $app.findRecordsByFilter('telegram_links', 'user = {:u}', '', 0, 0, {
      u: e.auth.id,
    })) {
      $app.delete(old);
    }
    const rec = new Record(col);
    const token = $security.randomStringWithAlphabet(
      24,
      'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    );
    rec.set('user', e.auth.id);
    rec.set('token', token);
    rec.set('expires', new Date(Date.now() + 30 * 60 * 1000).toISOString());
    $app.save(rec);
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
