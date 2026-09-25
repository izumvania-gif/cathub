/// <reference path="../pb_data/types.d.ts" />

// Household membership is changed only through these routes (users can't set `household`
// or `role` via the regular API — see the users.updateRule in the core schema migration).
// Note: each handler runs in its own JS VM, so helpers are required from a module.

// POST /api/cathub/household {name, timezone} → create a household, caller becomes owner.
routerAdd(
  'POST',
  '/api/cathub/household',
  (e) => {
    const h = require(`${__hooks}/lib/household.js`);
    const user = e.auth;
    if (user.getString('household')) {
      throw new BadRequestError('Вы уже состоите в доме.');
    }
    const body = e.requestInfo().body || {};
    const name = String(body.name || '').trim() || 'Наш дом';
    const timezone = String(body.timezone || '').trim() || 'Europe/Moscow';
    if (!h.isValidTimezone(timezone)) throw new BadRequestError('Неизвестный часовой пояс.');

    let household;
    $app.runInTransaction((txApp) => {
      household = new Record(txApp.findCollectionByNameOrId('households'));
      household.set('name', name.slice(0, 80));
      household.set('timezone', timezone);
      household.set('invite_code', h.newInviteCode(txApp));
      txApp.save(household);

      const u = txApp.findRecordById('users', user.id);
      u.set('household', household.id);
      u.set('role', 'owner');
      txApp.save(u);
    });
    return e.json(200, household);
  },
  $apis.requireAuth('users'),
);

// POST /api/cathub/join {code} → join an existing household by invite code.
routerAdd(
  'POST',
  '/api/cathub/join',
  (e) => {
    const h = require(`${__hooks}/lib/household.js`);
    const user = e.auth;
    if (user.getString('household')) {
      throw new BadRequestError('Вы уже состоите в доме.');
    }
    const code = h.normalizeCode((e.requestInfo().body || {}).code);
    if (!code) throw new BadRequestError('Введите код приглашения.');
    let household;
    try {
      household = $app.findFirstRecordByData('households', 'invite_code', code);
    } catch (_) {
      throw new NotFoundError('Код не найден. Проверьте его или попросите новый.');
    }
    const u = $app.findRecordById('users', user.id);
    u.set('household', household.id);
    u.set('role', 'member');
    $app.save(u);
    return e.json(200, household);
  },
  $apis.requireAuth('users'),
);

// POST /api/cathub/invite → owner rotates the invite code (old links stop working).
routerAdd(
  'POST',
  '/api/cathub/invite',
  (e) => {
    const h = require(`${__hooks}/lib/household.js`);
    const user = e.auth;
    if (!user.getString('household') || user.getString('role') !== 'owner') {
      throw new ForbiddenError('Только владелец дома может менять код приглашения.');
    }
    const household = $app.findRecordById('households', user.getString('household'));
    household.set('invite_code', h.newInviteCode($app));
    $app.save(household);
    return e.json(200, { invite_code: household.getString('invite_code') });
  },
  $apis.requireAuth('users'),
);

// Basic shape validation of task schedules (the real logic lives in packages/core).
onRecordValidate((e) => {
  const h = require(`${__hooks}/lib/household.js`);
  const err = h.validateSchedule(e.record.getString('schedule'));
  if (err) throw new BadRequestError('Некорректное расписание: ' + err);
  e.next();
}, 'tasks');
