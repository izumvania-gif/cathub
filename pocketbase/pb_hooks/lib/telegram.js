// Shared helpers for Telegram routes (CommonJS, loaded with require()).

const TOKEN_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Bot @username: TELEGRAM_BOT_USERNAME, else the one the bot reported in its latest heartbeat. */
function botUsername() {
  let bot = String($os.getenv('TELEGRAM_BOT_USERNAME') || '')
    .replace(/^@/, '')
    .trim();
  if (!bot) {
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
  return bot;
}

/** Creates a one-time link token (30 min), replacing older tokens of the same user and kind. */
function createLinkToken(userId, kind, householdId) {
  for (const old of $app.findRecordsByFilter(
    'telegram_links',
    'user = {:u} && kind = {:k}',
    '',
    0,
    0,
    { u: userId, k: kind },
  )) {
    $app.delete(old);
  }
  const rec = new Record($app.findCollectionByNameOrId('telegram_links'));
  const token = $security.randomStringWithAlphabet(24, TOKEN_ALPHABET);
  rec.set('user', userId);
  rec.set('kind', kind);
  if (householdId) rec.set('household', householdId);
  rec.set('token', token);
  rec.set('expires', new Date(Date.now() + 30 * 60 * 1000).toISOString());
  $app.save(rec);
  return token;
}

module.exports = { botUsername, createLinkToken };
