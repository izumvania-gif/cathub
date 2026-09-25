/// <reference path="../pb_data/types.d.ts" />

// Food and litter stock with daily usage; the forecast is computed in packages/core.
migrate(
  (app) => {
    const MEMBER = '@request.auth.id != "" && household = @request.auth.household';
    const households = app.findCollectionByNameOrId('households');
    const supplies = new Collection({
      type: 'base',
      name: 'supplies',
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
        { name: 'name', type: 'text', required: true, max: 80 },
        { name: 'emoji', type: 'text', max: 16 },
        { name: 'unit', type: 'text', required: true, max: 16 },
        { name: 'stock', type: 'number', min: 0 },
        { name: 'stock_at', type: 'date', required: true },
        { name: 'daily_usage', type: 'number', min: 0 },
        { name: 'low_days', type: 'number', min: 0, max: 365, onlyInt: true },
        { name: 'template_key', type: 'text', max: 40 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    });
    app.save(supplies);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('supplies'));
  },
);
