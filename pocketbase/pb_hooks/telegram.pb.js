/// <reference path="../pb_data/types.d.ts" />

// Telegram linking. The bot username comes from TELEGRAM_BOT_USERNAME (same container env).

// POST /api/cathub/telegram/link → { url } to open t.me/<bot>?start=<one-time token>
routerAdd(
  'POST',
  '/api/cathub/telegram/link',
  (e) => {
    let bot = String($os.getenv('TELEGRAM_BOT_USERNAME') || '')
      .replace(/^@/, '')
      .trim();
    if (!bot) {
      // Fall back to the username the bot reported in its latest heartbeat.
      try {
        const hb = $app.findRecordsByFilter('diagnostics', "bot_username != ''", '-created', 1, 0);
        if (hb.length) bot = hb[0].getString('bot_username');
      } catch (_) {
        /* no heartbeats yet */
      }
    }
    if (!bot) {
      throw new BadRequestError(
        'Бот ещё не подключился к Telegram. Проверьте переменную BOT_TOKEN и перезапустите проект; подробности — на странице /diag.',
      );
    }
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
