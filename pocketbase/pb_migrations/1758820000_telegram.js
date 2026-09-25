/// <reference path="../pb_data/types.d.ts" />

// Telegram linking tokens and reminder bookkeeping (docs/PLAN.md §9).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const links = new Collection({
      type: 'base',
      name: 'telegram_links',
      // Superuser only: created by POST /api/cathub/telegram/link, consumed by the bot.
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        { name: 'token', type: 'text', required: true, max: 64 },
        { name: 'expires', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_telegram_links_token ON telegram_links (token)'],
    });
    app.save(links);

    const log = app.findCollectionByNameOrId('reminder_log');
    // Set once the message was edited to show who did it (or that the task is done).
    log.fields.add(new BoolField({ name: 'resolved' }));
    // Original message text, so it can be edited in place when the task is handled.
    log.fields.add(new TextField({ name: 'text', max: 4000 }));
    log.indexes.push('CREATE INDEX idx_reminder_open ON reminder_log (resolved, sent_at)');
    app.save(log);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('telegram_links'));
    const log = app.findCollectionByNameOrId('reminder_log');
    log.fields.removeByName('resolved');
    log.fields.removeByName('text');
    log.indexes = log.indexes.filter((i) => !i.includes('idx_reminder_open'));
    app.save(log);
  },
);
