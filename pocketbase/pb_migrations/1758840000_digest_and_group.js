/// <reference path="../pb_data/types.d.ts" />

// Phase 2 (docs/PLAN.md §9): morning digest settings and linking a family group chat.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    // "HH:MM" local time of the morning digest; empty = off.
    users.fields.add(
      new TextField({ name: 'digest_time', max: 5, pattern: '^$|^([01]\\d|2[0-3]):[0-5]\\d$' }),
    );
    // Local date (YYYY-MM-DD) of the last digest sent; written by the bot.
    users.fields.add(new TextField({ name: 'digest_sent_on', max: 10 }));
    app.save(users);

    const links = app.findCollectionByNameOrId('telegram_links');
    const households = app.findCollectionByNameOrId('households');
    links.fields.add(new SelectField({ name: 'kind', values: ['user', 'group'], maxSelect: 1 }));
    links.fields.add(
      new RelationField({
        name: 'household',
        collectionId: households.id,
        maxSelect: 1,
        cascadeDelete: true,
      }),
    );
    app.save(links);

    // Existing users get the default digest time.
    app.db().newQuery("UPDATE users SET digest_time = '09:00' WHERE digest_time = ''").execute();
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('digest_time');
    users.fields.removeByName('digest_sent_on');
    app.save(users);
    const links = app.findCollectionByNameOrId('telegram_links');
    links.fields.removeByName('kind');
    links.fields.removeByName('household');
    app.save(links);
  },
);
