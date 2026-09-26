/// <reference path="../pb_data/types.d.ts" />

// The cat's room shop (docs/PLAN.md §6.7). The balance is summed on the server (fish on
// completions + bonuses + games − purchases), so the check can't be fooled by the client.

// POST /api/cathub/room/buy { item } → the new room_items record
routerAdd(
  'POST',
  '/api/cathub/room/buy',
  (e) => {
    const { ROOM_PRICES } = require(`${__hooks}/lib/room.js`);
    const household = e.auth.getString('household');
    if (!household) throw new BadRequestError('Вы не состоите в доме.');
    const body = e.requestInfo().body || {};
    const item = String(body.item || '');
    if (!Object.prototype.hasOwnProperty.call(ROOM_PRICES, item))
      throw new BadRequestError('Такого предмета нет.');
    const price = ROOM_PRICES[item];
    if (price === 0) throw new BadRequestError('Этот предмет уже есть в комнате.');

    let created;
    $app.runInTransaction((tx) => {
      try {
        tx.findFirstRecordByFilter('room_items', 'household = {:h} && item = {:i}', {
          h: household,
          i: item,
        });
        throw new BadRequestError('Этот предмет уже куплен.');
      } catch (err) {
        if (err instanceof BadRequestError) throw err;
        /* not found: fine */
      }
      // Same sum as the fish_balance view (its SUM columns come back untyped, so query directly).
      const row = new DynamicModel({ balance: 0 });
      tx.db()
        .newQuery(
          `SELECT
            (SELECT COALESCE(SUM(fish), 0) FROM completions WHERE household = {:h})
            + (SELECT COALESCE(SUM(fish), 0) FROM fish_bonuses WHERE household = {:h})
            + (SELECT COALESCE(SUM(fish), 0) FROM game_runs WHERE household = {:h})
            + (SELECT COALESCE(SUM(fish), 0) FROM game_achievements WHERE household = {:h})
            - (SELECT COALESCE(SUM(price), 0) FROM room_items WHERE household = {:h}) AS balance`,
        )
        .bind({ h: household })
        .one(row);
      const balance = row.balance;
      if (balance < price)
        throw new BadRequestError(`Не хватает рыбок: нужно ${price} 🐟, есть ${balance} 🐟.`);
      const rec = new Record(tx.findCollectionByNameOrId('room_items'));
      rec.set('household', household);
      rec.set('item', item);
      rec.set('price', price);
      rec.set('placed', true);
      rec.set('bought_by', e.auth.id);
      tx.save(rec);
      created = rec;
    });
    return e.json(200, created);
  },
  $apis.requireAuth('users'),
);
