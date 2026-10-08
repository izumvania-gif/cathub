/// <reference path="../pb_data/types.d.ts" />

// The newest completion of every task, for the bot: tasks with nothing in its recent window
// (rare chores like a yearly vaccine) are evaluated from this. Being a view, it always reflects
// backdated marks, moved dates and deletions made in the app. Superuser only.
migrate(
  (app) => {
    app.save(
      new Collection({
        type: 'view',
        name: 'latest_completions',
        listRule: null,
        viewRule: null,
        viewQuery: `
          SELECT c.id AS id, c.household AS household, c.task AS task, c.user AS user,
            c.done_at AS done_at, c.kind AS kind, c.fish AS fish, c.rewarded AS rewarded
          FROM completions c
          WHERE c.done_at = (SELECT MAX(x.done_at) FROM completions x WHERE x.task = c.task)`,
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('latest_completions'));
  },
);
