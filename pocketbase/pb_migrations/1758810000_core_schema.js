/// <reference path="../pb_data/types.d.ts" />

// Core schema (docs/PLAN.md §7.1). Every record belongs to a household and is only visible to
// its members. Households are created/joined through the custom routes in pb_hooks/household.pb.js,
// so users can't assign themselves to someone else's household.
migrate(
  (app) => {
    const MEMBER = '@request.auth.id != "" && household = @request.auth.household';
    const CREATE_OWN =
      '@request.auth.id != "" && @request.body.household = @request.auth.household';

    // ── households ────────────────────────────────────────────────────────
    const households = new Collection({
      type: 'base',
      name: 'households',
      listRule: 'id = @request.auth.household',
      viewRule: 'id = @request.auth.household',
      createRule: null, // via POST /api/cathub/household
      updateRule: 'id = @request.auth.household && @request.auth.role = "owner"',
      deleteRule: null,
      fields: [
        { name: 'name', type: 'text', required: true, max: 80 },
        { name: 'timezone', type: 'text', required: true, max: 64 },
        { name: 'invite_code', type: 'text', max: 32, hidden: false },
        { name: 'telegram_group_chat_id', type: 'text', max: 32 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_households_invite ON households (invite_code) WHERE invite_code != ""',
      ],
    });
    app.save(households);

    // ── users (built-in auth collection) ──────────────────────────────────
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(
      new RelationField({ name: 'household', collectionId: households.id, maxSelect: 1 }),
      new SelectField({ name: 'role', values: ['owner', 'member'], maxSelect: 1 }),
      new TextField({ name: 'telegram_chat_id', max: 32 }),
      new TextField({ name: 'telegram_username', max: 64 }),
      new JSONField({ name: 'quiet_hours', maxSize: 2000 }),
      new BoolField({ name: 'notify' }),
    );
    // Household members see each other (names/avatars for "who did it").
    users.listRule =
      'id = @request.auth.id || (household != "" && household = @request.auth.household)';
    users.viewRule = users.listRule;
    // Users edit only themselves and can't change household/role/telegram binding directly.
    users.updateRule =
      'id = @request.auth.id && @request.body.household:isset = false && @request.body.role:isset = false && @request.body.telegram_chat_id:isset = false';
    app.save(users);

    // ── cats ──────────────────────────────────────────────────────────────
    const cats = new Collection({
      type: 'base',
      name: 'cats',
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: CREATE_OWN,
      updateRule:
        MEMBER +
        ' && (@request.body.household:isset = false || @request.body.household = @request.auth.household)',
      deleteRule: MEMBER + ' && @request.auth.role = "owner"',
      fields: [
        {
          name: 'household',
          type: 'relation',
          collectionId: households.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        { name: 'name', type: 'text', required: true, max: 60 },
        {
          name: 'photo',
          type: 'file',
          maxSelect: 1,
          maxSize: 10 * 1024 * 1024,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
          thumbs: ['200x200', '600x600'],
        },
        { name: 'birth_date', type: 'date' },
        { name: 'sex', type: 'select', values: ['male', 'female'], maxSelect: 1 },
        { name: 'breed', type: 'text', max: 80 },
        { name: 'neutered', type: 'bool' },
        { name: 'outdoor', type: 'bool' },
        { name: 'long_hair', type: 'bool' },
        { name: 'chip_number', type: 'text', max: 40 },
        { name: 'vet_clinic', type: 'text', max: 200 },
        { name: 'notes', type: 'text', max: 5000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    });
    app.save(cats);

    // ── tasks ─────────────────────────────────────────────────────────────
    const tasks = new Collection({
      type: 'base',
      name: 'tasks',
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: CREATE_OWN,
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
        { name: 'title', type: 'text', required: true, max: 100 },
        { name: 'emoji', type: 'text', max: 16 },
        {
          name: 'category',
          type: 'select',
          maxSelect: 1,
          values: [
            'feeding',
            'litter',
            'grooming',
            'health',
            'parasites',
            'vaccines',
            'vet',
            'supplies',
            'other',
          ],
        },
        // Schedule from packages/core (daily_slots | interval | once); validated in pb_hooks.
        { name: 'schedule', type: 'json', required: true, maxSize: 5000 },
        { name: 'reminders', type: 'json', maxSize: 5000 },
        { name: 'assignee', type: 'relation', collectionId: users.id, maxSelect: 1 },
        { name: 'track_value', type: 'json', maxSize: 1000 },
        { name: 'template_key', type: 'text', max: 40 },
        { name: 'medical', type: 'bool' },
        { name: 'notes', type: 'text', max: 2000 },
        { name: 'archived', type: 'bool' },
        { name: 'sort', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_tasks_household ON tasks (household)'],
    });
    app.save(tasks);

    // ── completions ───────────────────────────────────────────────────────
    const completions = new Collection({
      type: 'base',
      name: 'completions',
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule:
        CREATE_OWN +
        ' && @request.body.task.household = @request.auth.household && @request.body.user = @request.auth.id',
      updateRule:
        MEMBER +
        ' && @request.body.household:isset = false && @request.body.task:isset = false && @request.body.user:isset = false',
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
        { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1 },
        { name: 'done_at', type: 'date', required: true },
        { name: 'kind', type: 'select', values: ['done', 'skipped'], maxSelect: 1, required: true },
        { name: 'value', type: 'number' },
        { name: 'note', type: 'text', max: 1000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_completions_task_done ON completions (task, done_at)',
        'CREATE INDEX idx_completions_household_done ON completions (household, done_at)',
      ],
    });
    app.save(completions);

    // ── snoozes ───────────────────────────────────────────────────────────
    const snoozes = new Collection({
      type: 'base',
      name: 'snoozes',
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: CREATE_OWN + ' && @request.body.task.household = @request.auth.household',
      updateRule:
        MEMBER + ' && @request.body.household:isset = false && @request.body.task:isset = false',
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
        { name: 'until', type: 'date', required: true },
        { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_snoozes_task ON snoozes (task)'],
    });
    app.save(snoozes);

    // ── reminder_log (bot only) ───────────────────────────────────────────
    const reminderLog = new Collection({
      type: 'base',
      name: 'reminder_log',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
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
          name: 'stage',
          type: 'select',
          values: ['before', 'due', 'overdue'],
          maxSelect: 1,
          required: true,
        },
        { name: 'chat_id', type: 'text', required: true, max: 32 },
        { name: 'message_id', type: 'number' },
        { name: 'sent_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_reminder_once ON reminder_log (task, occurrence_at, stage, chat_id)',
      ],
    });
    app.save(reminderLog);
  },
  (app) => {
    for (const name of ['reminder_log', 'snoozes', 'completions', 'tasks', 'cats']) {
      app.delete(app.findCollectionByNameOrId(name));
    }
    const users = app.findCollectionByNameOrId('users');
    for (const f of [
      'household',
      'role',
      'telegram_chat_id',
      'telegram_username',
      'quiet_hours',
      'notify',
    ]) {
      users.fields.removeByName(f);
    }
    users.listRule = 'id = @request.auth.id';
    users.viewRule = 'id = @request.auth.id';
    users.updateRule = 'id = @request.auth.id';
    app.save(users);
    app.delete(app.findCollectionByNameOrId('households'));
  },
);
