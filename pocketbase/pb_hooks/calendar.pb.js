/// <reference path="../pb_data/types.d.ts" />

// Calendar subscription feed (webcal) for rare tasks. The .ics is built by the bot process with
// packages/core (the single source of truth for due dates); PocketBase only proxies to it.

// GET /api/cathub/calendar/{token} → text/calendar (token may end with ".ics")
routerAdd('GET', '/api/cathub/calendar/{token}', (e) => {
  const token = String(e.request.pathValue('token') || '').replace(/\.ics$/, '');
  if (!/^[a-z0-9]{16,64}$/.test(token)) throw new NotFoundError('Календарь не найден.');
  let household;
  try {
    household = $app.findFirstRecordByData('households', 'calendar_token', token);
  } catch (_) {
    throw new NotFoundError('Календарь не найден. Возможно, ссылку обновили в приложении.');
  }
  const base = String($os.getenv('BOT_INTERNAL_URL') || 'http://127.0.0.1:8091').replace(
    /\/+$/,
    '',
  );
  let res;
  try {
    res = $http.send({ url: `${base}/ics/${household.id}`, method: 'GET', timeout: 15 });
  } catch (err) {
    throw new ApiError(503, 'Календарь временно недоступен.');
  }
  if (res.statusCode !== 200) throw new ApiError(503, 'Календарь временно недоступен.');
  e.response.header().set('Content-Type', 'text/calendar; charset=utf-8');
  e.response.header().set('Cache-Control', 'no-cache');
  return e.string(200, toString(res.body));
});

// POST /api/cathub/calendar/rotate → new secret (old subscription links stop working)
routerAdd(
  'POST',
  '/api/cathub/calendar/rotate',
  (e) => {
    const household = e.auth.getString('household');
    if (!household) throw new BadRequestError('Вы не состоите в доме.');
    const h = $app.findRecordById('households', household);
    h.set(
      'calendar_token',
      $security.randomStringWithAlphabet(32, 'abcdefghijkmnpqrstuvwxyz23456789'),
    );
    $app.save(h);
    return e.json(200, { calendar_token: h.getString('calendar_token') });
  },
  $apis.requireAuth('users'),
);

// New households get a calendar token right away.
onRecordCreate((e) => {
  if (!e.record.getString('calendar_token')) {
    e.record.set(
      'calendar_token',
      $security.randomStringWithAlphabet(32, 'abcdefghijkmnpqrstuvwxyz23456789'),
    );
  }
  e.next();
}, 'households');
