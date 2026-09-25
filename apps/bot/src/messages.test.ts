import { describe, expect, it } from 'vitest';
import { escapeHtml, parseCallback, passKeyboard, reminderKeyboard } from './messages';

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
