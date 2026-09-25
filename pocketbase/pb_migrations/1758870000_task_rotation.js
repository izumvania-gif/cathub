/// <reference path="../pb_data/types.d.ts" />

// "По очереди": after each completion the assignee moves to the next person in `rotation`.
migrate(
  (app) => {
    const tasks = app.findCollectionByNameOrId('tasks');
    const users = app.findCollectionByNameOrId('users');
    tasks.fields.add(
      new RelationField({ name: 'rotation', collectionId: users.id, maxSelect: 20 }),
    );
    app.save(tasks);
  },
  (app) => {
    const tasks = app.findCollectionByNameOrId('tasks');
    tasks.fields.removeByName('rotation');
    app.save(tasks);
  },
);
