import { describe, expect, it } from 'vitest';
import { isTimeOfDay, parseTimeOfDay } from './schedule';

describe('parseTimeOfDay', () => {
  it('parses valid times', () => {
    expect(parseTimeOfDay('00:00')).toBe(0);
    expect(parseTimeOfDay('08:30')).toBe(8 * 60 + 30);
    expect(parseTimeOfDay('23:59')).toBe(23 * 60 + 59);
  });

  it('rejects invalid times', () => {
    for (const v of ['24:00', '8:30', '08:60', '0830', '', 'ab:cd']) {
      expect(parseTimeOfDay(v)).toBeNull();
    }
  });
});

describe('isTimeOfDay', () => {
  it('narrows valid strings', () => {
    expect(isTimeOfDay('20:00')).toBe(true);
    expect(isTimeOfDay('20:0')).toBe(false);
  });
});
