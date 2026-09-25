/// <reference path="../pb_data/types.d.ts" />

// What the household did with an age-based health tip (core's healthPlan): hid it, added it to
// chores or marked it done. The tips themselves are computed, never stored.
migrate(
  (app) => {
    const MEMBER = '@request.auth.id != "" && household = @request.auth.household';
    const households = app.findCollectionByNameOrId('households');
    const tasks = app.findCollectionByNameOrId('tasks');
    app.save(
      new Collection({
        type: 'base',
        name: 'health_tips',
        listRule: MEMBER,
        viewRule: MEMBER,
        createRule:
          '@request.auth.id != "" && @request.body.household = @request.auth.household && (@request.body.task:isset = false || @request.body.task = "" || @request.body.task.household = @request.auth.household)',
        updateRule: MEMBER + ' && @request.body.household:isset = false',
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
          { name: 'tip', type: 'text', required: true, max: 64 },
          {
            name: 'state',
            type: 'select',
            maxSelect: 1,
            required: true,
            values: ['dismissed', 'added', 'done'],
          },
          { name: 'task', type: 'relation', collectionId: tasks.id, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_health_tip_once ON health_tips (household, tip)'],
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('health_tips'));
  },
);
