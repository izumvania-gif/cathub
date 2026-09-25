import { expect, test } from '@playwright/test';
import { APP_URL } from '../support/env';
import {
  api,
  createHousehold,
  createTask,
  createUser,
  statusOf,
  todayMidnightIso,
} from '../support/api';

// Phase 3: health records (API rules, protected files) and the calendar feed.

test('health records are private to the household, files need a token', async () => {
  const owner = await createUser('Маша');
  const stranger = await createUser('Чужой');
  const { household, cat } = await createHousehold(owner);

  const form = new FormData();
  form.set('household', household.id);
  form.set('cat', cat.id);
  form.set('type', 'vaccination');
  form.set('date', new Date().toISOString().replace('T', ' '));
  form.set('title', 'Нобивак Rabies');
  form.set(
    'files',
    new Blob([Buffer.from('%PDF-1.4\n%%EOF\n')], { type: 'application/pdf' }),
    'passport.pdf',
  );
  const res = await fetch(`${APP_URL}/api/collections/health_records/records`, {
    method: 'POST',
    headers: { authorization: owner.token },
    body: form,
  });
  expect(res.status).toBe(200);
  const rec = (await res.json()) as { id: string; collectionId: string; files: string[] };
  expect(rec.files).toHaveLength(1);

  const theirs = await api<{ totalItems: number }>(
    'GET',
    '/api/collections/health_records/records',
    undefined,
    stranger.token,
  );
  expect(theirs.totalItems).toBe(0);

  const fileUrl = `${APP_URL}/api/files/${rec.collectionId}/${rec.id}/${rec.files[0]}`;
  expect((await fetch(fileUrl)).status).not.toBe(200);
  const { token } = await api<{ token: string }>(
    'POST',
    '/api/files/token',
    undefined,
    owner.token,
  );
  expect((await fetch(`${fileUrl}?token=${token}`)).status).toBe(200);
});

test('calendar feed: rare tasks as all-day events, secret token, rotation', async () => {
  const owner = await createUser('Маша');
  const { household } = await createHousehold(owner);
  await createTask(owner, household.id, {
    title: 'Прививка от бешенства',
    emoji: '💉',
    medical: true,
    schedule: {
      kind: 'interval',
      every: 1,
      unit: 'year',
      anchor: 'completion',
      startDate: todayMidnightIso(),
    },
  });
  await createTask(owner, household.id, {
    title: 'Покормить',
    schedule: { kind: 'daily_slots', times: ['08:00'] },
  });

  const h = await api<{ calendar_token: string }>(
    'GET',
    `/api/collections/households/records/${household.id}`,
    undefined,
    owner.token,
  );
  expect(h.calendar_token).toMatch(/^[a-z0-9]{32}$/);

  const res = await fetch(`${APP_URL}/api/cathub/calendar/${h.calendar_token}.ics`);
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('text/calendar');
  const ics = await res.text();
  expect(ics).toContain('BEGIN:VCALENDAR');
  expect(ics).toContain('Прививка от бешенства — Барсик');
  expect(ics).toContain('DTSTART;VALUE=DATE:');
  expect(ics).toContain('BEGIN:VALARM');
  expect(ics).not.toContain('Покормить');

  expect((await fetch(`${APP_URL}/api/cathub/calendar/${'x'.repeat(32)}.ics`)).status).toBe(404);

  const { calendar_token } = await api<{ calendar_token: string }>(
    'POST',
    '/api/cathub/calendar/rotate',
    {},
    owner.token,
  );
  expect(calendar_token).not.toBe(h.calendar_token);
  expect((await fetch(`${APP_URL}/api/cathub/calendar/${h.calendar_token}.ics`)).status).toBe(404);
  expect(await statusOf(api('POST', '/api/cathub/calendar/rotate', {}))).toBe(401);
});
