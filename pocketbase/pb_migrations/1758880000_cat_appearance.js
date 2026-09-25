/// <reference path="../pb_data/types.d.ts" />

// How the pixel cat looks (apps/web/src/cat/look.ts): coat, pattern, eyes, accessories.
migrate(
  (app) => {
    const cats = app.findCollectionByNameOrId('cats');
    cats.fields.add(new JSONField({ name: 'appearance', maxSize: 2000 }));
    app.save(cats);
  },
  (app) => {
    const cats = app.findCollectionByNameOrId('cats');
    cats.fields.removeByName('appearance');
    app.save(cats);
  },
);
