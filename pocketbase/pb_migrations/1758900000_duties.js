/// <reference path="../pb_data/types.d.ts" />

// Sharing duties (docs/PLAN.md §6.5): zones of responsibility per category, per-task modes
// (by weekday, by time slot), one-off hand-overs and "I'm away". Who does what is computed by
// core's assigneeFor(); these are only its inputs.
migrate(
  (app) => {
    const MEMBER = '@request.auth.id != "" && household = @request.auth.household';
    const CREATE_OWN =
      '@request.auth.id != "" && @request.body.household = @request.auth.household';
    const households = app.findCollectionByNameOrId('households');
    const users = app.findCollectionByNameOrId('users');
    const tasks = app.findCollectionByNameOrId('tasks');

    households.fields.add(new JSONField({ name: 'duty_zones', maxSize: 5000 }));
    // Any member may edit the zones; everything else stays owner-only.
    households.updateRule =
      'id = @request.auth.household && (@request.auth.role = "owner" || (' +
      ['name', 'timezone', 'invite_code', 'telegram_group_chat_id', 'calendar_token']
        .map((f) => `@request.body.${f}:isset = false`)
        .join(' && ') +
      '))';
    app.save(households);

    tasks.fields.add(
      new SelectField({
        name: 'assign_mode',
        maxSelect: 1,
        values: ['zone', 'anyone', 'one', 'rotation', 'weekday', 'slot'],
      }),
      new JSONField({ name: 'duty_map', maxSize: 2000 }),
    );
    app.save(tasks);
    // Existing tasks keep what they had.
    for (const t of app.findAllRecords('tasks')) {
      const rotation = t.getStringSlice('rotation');
      t.set(
        'assign_mode',
        rotation.length ? 'rotation' : t.getString('assignee') ? 'one' : 'anyone',
      );
      app.saveNoValidate(t);
    }

    app.save(
      new Collection({
        type: 'base',
        name: 'duty_overrides',
        listRule: MEMBER,
        viewRule: MEMBER,
        createRule:
          CREATE_OWN +
          ' && @request.body.task.household = @request.auth.household && @request.body.by = @request.auth.id && @request.body.user.household = @request.auth.household && @request.body.notified:isset = false',
        updateRule: null,
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
          {
            name: 'task',
            type: 'relation',
            collectionId: tasks.id,
            maxSelect: 1,
            required: true,
            cascadeDelete: true,
          },
          { name: 'occurrence_at', type: 'date', required: true },
          {
            name: 'user',
            type: 'relation',
            collectionId: users.id,
            maxSelect: 1,
            required: true,
            cascadeDelete: true,
          },
          { name: 'by', type: 'relation', collectionId: users.id, maxSelect: 1 },
          // The bot has told the new person (hand-overs made in the app).
          { name: 'notified', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_duty_override_once ON duty_overrides (task, occurrence_at)',
        ],
      }),
    );

    app.save(
      new Collection({
        type: 'base',
        name: 'absences',
        listRule: MEMBER,
        viewRule: MEMBER,
        createRule: CREATE_OWN + ' && @request.body.user = @request.auth.id',
        updateRule: MEMBER + ' && user = @request.auth.id && @request.body.user:isset = false',
        deleteRule: MEMBER + ' && (user = @request.auth.id || @request.auth.role = "owner")',
        fields: [
          {
            name: 'household',
            type: 'relation',
            collectionId: households.id,
            maxSelect: 1,
            required: true,
            cascadeDelete: true,
          },
          {
            name: 'user',
            type: 'relation',
            collectionId: users.id,
            maxSelect: 1,
            required: true,
            cascadeDelete: true,
          },
          // Local dates "YYYY-MM-DD", inclusive.
          { name: 'from', type: 'text', required: true, pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          { name: 'to', type: 'text', required: true, pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          { name: 'note', type: 'text', max: 200 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
      }),
    );
  },
  (app) => {
    for (const name of ['absences', 'duty_overrides'])
      app.delete(app.findCollectionByNameOrId(name));
    const tasks = app.findCollectionByNameOrId('tasks');
    tasks.fields.removeByName('assign_mode');
    tasks.fields.removeByName('duty_map');
    app.save(tasks);
    const households = app.findCollectionByNameOrId('households');
    households.fields.removeByName('duty_zones');
    households.updateRule = 'id = @request.auth.household && @request.auth.role = "owner"';
    app.save(households);
  },
);
