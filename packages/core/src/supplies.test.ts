import { describe, expect, it } from 'vitest';
import { describeSupply, formatAmount, supplyForecast } from './supplies';

const TZ = 'Europe/Moscow';
const msk = (s: string) => new Date(`${s}+03:00`);
const food = {
  stock: 2,
  stockAt: msk('2026-09-01T12:00:00').toISOString(),
  dailyUsage: 0.1,
  lowDays: 5,
};

describe('supplyForecast', () => {
  it('subtracts usage since the last count', () => {
    const f = supplyForecast(food, msk('2026-09-11T12:00:00'), TZ);
    expect(f.remaining).toBeCloseTo(1);
    expect(f.daysLeft).toBeCloseTo(10);
    expect(f.runsOutOn).toBe('2026-09-21');
    expect(f.status).toBe('ok');
  });

  it('is low within the warning window and out when empty', () => {
    expect(supplyForecast(food, msk('2026-09-17T12:00:00'), TZ).status).toBe('low');
    const out = supplyForecast(food, msk('2026-10-01T12:00:00'), TZ);
    expect(out.status).toBe('out');
    expect(out.remaining).toBe(0);
  });

  it('handles unknown usage', () => {
    const f = supplyForecast({ ...food, dailyUsage: 0 }, msk('2026-09-11T12:00:00'), TZ);
    expect(f).toMatchObject({ remaining: 2, daysLeft: null, runsOutOn: null, status: 'ok' });
  });
});

describe('formatting', () => {
  it('formats amounts and days', () => {
    expect(formatAmount(1.26, 'кг')).toBe('1,3 кг');
    expect(formatAmount(13.7, 'шт')).toBe('13 шт');
    expect(describeSupply(supplyForecast(food, msk('2026-09-11T12:00:00'), TZ))).toBe(
      'хватит на 10 дней',
    );
    expect(describeSupply(supplyForecast(food, msk('2026-09-20T20:00:00'), TZ))).toBe(
      'хватит меньше чем на день',
    );
  });
});
