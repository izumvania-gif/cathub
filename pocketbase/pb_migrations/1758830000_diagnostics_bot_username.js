/// <reference path="../pb_data/types.d.ts" />

// The bot reports its own @username (from getMe) with each heartbeat, so the
// "Подключить Telegram" link works without the TELEGRAM_BOT_USERNAME env var.
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('diagnostics');
    c.fields.add(new TextField({ name: 'bot_username', max: 64 }));
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId('diagnostics');
    c.fields.removeByName('bot_username');
    app.save(c);
  },
);
