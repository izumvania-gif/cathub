/// <reference path="../pb_data/types.d.ts" />

// Quieter reminders: each chore says how it reaches Telegram (core's notifyLevel; '' = default
// by template), and overdue rare chores get occasional nudges (reminder_log stages nudge1…8)
// instead of an "overdue" message an hour after every missed slot.
migrate(
  (app) => {
    const tasks = app.findCollectionByNameOrId('tasks');
    tasks.fields.add(
      new SelectField({ name: 'notify', maxSelect: 1, values: ['push', 'digest', 'off'] }),
    );
    app.save(tasks);

    const log = app.findCollectionByNameOrId('reminder_log');
    const stage = log.fields.getByName('stage');
    stage.values = [
      'before',
      'due',
      'overdue',
      'nudge1',
      'nudge2',
      'nudge3',
      'nudge4',
      'nudge5',
      'nudge6',
      'nudge7',
      'nudge8',
    ];
    app.save(log);
  },
  (app) => {
    const tasks = app.findCollectionByNameOrId('tasks');
    tasks.fields.removeByName('notify');
    app.save(tasks);
    const log = app.findCollectionByNameOrId('reminder_log');
    log.fields.getByName('stage').values = ['before', 'due', 'overdue'];
    app.save(log);
  },
);
