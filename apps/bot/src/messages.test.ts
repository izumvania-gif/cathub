import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  freshHealthTip,
  parseCallback,
  passKeyboard,
  reminderKeyboard,
  summaryText,
} from './messages';

describe('callback data', () => {
  it('round-trips and fits Telegram limits', () => {
    const occ = new Date('2026-09-25T17:00:00Z');
    const kb = reminderKeyboard('abcdefghijklmno', occ);
    const datas = kb.inline_keyboard
      .flat()
      .map((b) => ('callback_data' in b ? b.callback_data : ''));
    for (const d of datas) {
      expect(Buffer.byteLength(d)).toBeLessThanOrEqual(64);
      expect(parseCallback(d)).toMatchObject({ taskId: 'abcdefghijklmno', occurrence: occ });
    }
  });

  it('group reminders offer "take it", private ones "pass it"; picks carry the user', () => {
    const occ = new Date('2026-09-25T17:00:00Z');
    const labels = (kb: ReturnType<typeof reminderKeyboard>) =>
      kb.inline_keyboard.flat().map((b) => b.text);
    expect(labels(reminderKeyboard('abcdefghijklmno', occ, { group: true }))).toContain(
      '🙋 Возьму',
    );
    expect(labels(reminderKeyboard('abcdefghijklmno', occ))).toContain('👉 Передать');
    const pick = passKeyboard('abcdefghijklmno', occ, [{ id: 'userabcdefghijk', name: 'Петя' }]);
    const data = (pick.inline_keyboard[0]![0] as { callback_data: string }).callback_data;
    expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
    expect(parseCallback(data)).toMatchObject({ action: 'g', userId: 'userabcdefghijk' });
    // "give" needs a user, the others must not have one.
    expect(parseCallback('g:abcdefghijklmno:1758800000')).toBeNull();
    expect(parseCallback('d:abcdefghijklmno:1758800000:userabcdefghijk')).toBeNull();
  });

  it('rejects garbage', () => {
    expect(parseCallback('x:abc:1')).toBeNull();
    expect(parseCallback('d:ABCDEFGHIJKLMNO:1758800000')).toBeNull();
  });
});

describe('escapeHtml', () => {
  it('escapes Telegram HTML specials', () => {
    expect(escapeHtml('<b>Кот & пёс</b>')).toBe('&lt;b&gt;Кот &amp; пёс&lt;/b&gt;');
  });
});

describe('health tip in the digest', () => {
  const base = {
    household: {
      id: 'h',
      name: 'H',
      timezone: 'Europe/Moscow',
      telegram_group_chat_id: '',
      duty_zones: null,
    },
    users: [],
    tasks: [],
    completions: [],
    snoozes: [],
    supplies: [],
    overrides: [],
    absences: [],
    health: [],
    handledTips: [] as string[],
  };
  const cat = {
    id: 'c',
    household: 'h',
    name: 'Барсик',
    birth_date: '2026-08-01 00:00:00.000Z',
    neutered: false,
  };

  it('mentions a tip that became due this week, once handled it goes away', () => {
    const now = new Date('2026-09-27T09:00:00Z'); // 57 days: first vaccine window opened yesterday
    const state = { ...base, cat };
    expect(freshHealthTip(state, now)?.key).toBe('kitten_vaccine_1');
    expect(summaryText(state, now, 'Сегодня').text).toContain(
      '🩺 По возрасту: Первая комплексная прививка',
    );
    const handled = {
      ...state,
      handledTips: ['kitten_vaccine_1', 'deworm_before_kitten_vaccine_1'],
    };
    expect(freshHealthTip(handled, now)?.key).not.toBe('kitten_vaccine_1');
  });

  it('says nothing without a birth date', () => {
    expect(freshHealthTip({ ...base, cat: { ...cat, birth_date: '' } }, new Date())).toBeNull();
  });
});
