/// <reference path="../pb_data/types.d.ts" />

// Phase 3 (docs/PLAN.md §3.2): health records (vaccinations, vet visits, meds, labs) with
// protected attachments, and a secret per-household calendar feed token.
migrate(
  (app) => {
    const MEMBER = '@request.auth.id != "" && household = @request.auth.household';
    const households = app.findCollectionByNameOrId('households');
    const cats = app.findCollectionByNameOrId('cats');
    const users = app.findCollectionByNameOrId('users');

    const records = new Collection({
      type: 'base',
      name: 'health_records',
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: '@request.auth.id != "" && @request.body.household = @request.auth.household',
      updateRule:
        MEMBER +
        ' && (@request.body.household:isset = false || @request.body.household = @request.auth.household)',
      deleteRule: MEMBER,
      fields: [
        {
          name: 'household',
          type: 'relation',
          collectionId: households.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        { name: 'cat', type: 'relation', collectionId: cats.id, maxSelect: 1 },
        {
          name: 'type',
          type: 'select',
          values: ['vaccination', 'visit', 'medication', 'lab', 'other'],
          maxSelect: 1,
          required: true,
        },
        { name: 'date', type: 'date', required: true },
        { name: 'title', type: 'text', required: true, max: 120 },
        { name: 'clinic', type: 'text', max: 200 },
        { name: 'batch', type: 'text', max: 80 },
        { name: 'notes', type: 'text', max: 5000 },
        {
          name: 'files',
          type: 'file',
          maxSelect: 10,
          maxSize: 15 * 1024 * 1024,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
          thumbs: ['300x300f'],
          // Vet documents are personal: file URLs need a short-lived file token.
          protected: true,
        },
        { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_health_household_date ON health_records (household, date)'],
    });
    app.save(records);

    // Secret for the calendar subscription URL; members can read it, only the server sets it.
    households.fields.add(new TextField({ name: 'calendar_token', max: 64 }));
    app.save(households);
    for (const h of app.findAllRecords('households')) {
      h.set(
        'calendar_token',
        $security.randomStringWithAlphabet(32, 'abcdefghijkmnpqrstuvwxyz23456789'),
      );
      app.save(h);
    }
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('health_records'));
    const households = app.findCollectionByNameOrId('households');
    households.fields.removeByName('calendar_token');
    app.save(households);
  },
);
