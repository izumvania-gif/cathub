/// <reference path="../pb_data/types.d.ts" />

// Fish 🐟 and the cat's room (docs/PLAN.md §6.7). The bot prices each completion with core's
// rewardFor() and stores it in `completions.fish`; the balance is a view summing completions and
// bonuses minus purchases, so nothing is recomputed from full history on the client.
migrate(
  (app) => {
    const MEMBER = '@request.auth.id != "" && household = @request.auth.household';
    const households = app.findCollectionByNameOrId('households');
    const users = app.findCollectionByNameOrId('users');

    const tasks = app.findCollectionByNameOrId('tasks');
    tasks.fields.add(new NumberField({ name: 'weight', min: 0, max: 3, onlyInt: true }));
    app.save(tasks);

    // Only the bot sets the reward.
    const completions = app.findCollectionByNameOrId('completions');
    completions.fields.add(
      new NumberField({ name: 'fish', min: 0, onlyInt: true }),
      new BoolField({ name: 'rewarded' }),
    );
    const noFish = ' && @request.body.fish:isset = false && @request.body.rewarded:isset = false';
    completions.createRule += noFish;
    completions.updateRule += noFish;
    app.save(completions);

    const roomItems = new Collection({
      type: 'base',
      name: 'room_items',
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: null, // via POST /api/cathub/room/buy
      // Members can only put an item away or back.
      updateRule:
        MEMBER +
        ' && @request.body.household:isset = false && @request.body.item:isset = false && @request.body.price:isset = false && @request.body.bought_by:isset = false',
      deleteRule: null,
      fields: [
        {
          name: 'household',
          type: 'relation',
          collectionId: households.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        { name: 'item', type: 'text', required: true, max: 32 },
        { name: 'price', type: 'number', min: 0, onlyInt: true },
        { name: 'placed', type: 'bool' },
        { name: 'bought_by', type: 'relation', collectionId: users.id, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_room_items_once ON room_items (household, item)'],
    });
    app.save(roomItems);

    const bonuses = new Collection({
      type: 'base',
      name: 'fish_bonuses',
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'household',
          type: 'relation',
          collectionId: households.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        { name: 'date', type: 'text', required: true, max: 10 },
        { name: 'kind', type: 'text', required: true, max: 20 },
        { name: 'fish', type: 'number', min: 0, onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_fish_bonus_once ON fish_bonuses (household, date, kind)'],
    });
    app.save(bonuses);

    app.save(
      new Collection({
        type: 'view',
        name: 'fish_balance',
        listRule: 'id = @request.auth.household',
        viewRule: 'id = @request.auth.household',
        viewQuery: `
          SELECT h.id AS id,
            COALESCE(c.fish, 0) AS from_tasks,
            COALESCE(b.fish, 0) AS from_bonuses,
            COALESCE(r.price, 0) AS spent
          FROM households h
          LEFT JOIN (SELECT household, SUM(fish) AS fish FROM completions GROUP BY household) c
            ON c.household = h.id
          LEFT JOIN (SELECT household, SUM(fish) AS fish FROM fish_bonuses GROUP BY household) b
            ON b.household = h.id
          LEFT JOIN (SELECT household, SUM(price) AS price FROM room_items GROUP BY household) r
            ON r.household = h.id`,
      }),
    );

    app.save(
      new Collection({
        type: 'view',
        name: 'fish_by_user',
        listRule: 'household = @request.auth.household',
        viewRule: 'household = @request.auth.household',
        viewQuery: `
          SELECT c.user AS id, c.household AS household, SUM(c.fish) AS fish
          FROM completions c
          WHERE c.user != '' AND c.fish > 0
          GROUP BY c.user, c.household`,
      }),
    );
  },
  (app) => {
    for (const name of ['fish_by_user', 'fish_balance', 'fish_bonuses', 'room_items'])
      app.delete(app.findCollectionByNameOrId(name));
    const completions = app.findCollectionByNameOrId('completions');
    const noFish = ' && @request.body.fish:isset = false && @request.body.rewarded:isset = false';
    completions.createRule = completions.createRule.replace(noFish, '');
    completions.updateRule = completions.updateRule.replace(noFish, '');
    completions.fields.removeByName('fish');
    completions.fields.removeByName('rewarded');
    app.save(completions);
    const tasks = app.findCollectionByNameOrId('tasks');
    tasks.fields.removeByName('weight');
    app.save(tasks);
  },
);
