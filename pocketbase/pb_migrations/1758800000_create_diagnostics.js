/// <reference path="../pb_data/types.d.ts" />

// Stage-0 diagnostics (docs/DEPLOY_AMVERA.md §2): the bot writes a heartbeat every minute
// with the result of a Telegram probe; the web /#/diag page watches it via realtime (SSE).
// Readable by anyone, writable only by superusers.
migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: 'diagnostics',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'kind', type: 'text', required: true, max: 32 },
        { name: 'telegram_ok', type: 'bool' },
        { name: 'telegram_ms', type: 'number' },
        { name: 'telegram_error', type: 'text', max: 500 },
        { name: 'bot_version', type: 'text', max: 64 },
        { name: 'uptime_s', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_diagnostics_created ON diagnostics (created)'],
    });
    app.save(collection);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('diagnostics'));
  },
);
