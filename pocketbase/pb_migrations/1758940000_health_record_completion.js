/// <reference path="../pb_data/types.d.ts" />

// A health record remembers the chore mark it made («Отметить дело выполненным»), so deleting
// or re-dating the record also moves that mark: due dates, tips and reminders follow the record.
migrate(
  (app) => {
    const records = app.findCollectionByNameOrId('health_records');
    const completions = app.findCollectionByNameOrId('completions');
    records.fields.add(
      new RelationField({ name: 'completion', collectionId: completions.id, maxSelect: 1 }),
    );
    const OWN_MARK =
      ' && (@request.body.completion:isset = false || @request.body.completion = "" || @request.body.completion.household = @request.auth.household)';
    records.createRule += OWN_MARK;
    records.updateRule += OWN_MARK;
    app.save(records);
  },
  (app) => {
    const records = app.findCollectionByNameOrId('health_records');
    records.fields.removeByName('completion');
    const OWN_MARK =
      ' && (@request.body.completion:isset = false || @request.body.completion = "" || @request.body.completion.household = @request.auth.household)';
    records.createRule = records.createRule.replace(OWN_MARK, '');
    records.updateRule = records.updateRule.replace(OWN_MARK, '');
    app.save(records);
  },
);
