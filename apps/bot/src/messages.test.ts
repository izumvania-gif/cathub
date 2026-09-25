import { describe, expect, it } from 'vitest';
import { escapeHtml, parseCallback, reminderKeyboard } from './messages';

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
