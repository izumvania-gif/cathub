import { describe, expect, it } from 'vitest';
import { evaluate } from './engine';
import { describeDue, describeSchedule, formatSpan, plural } from './format';
import { TASK_TEMPLATES } from './templates';

const TZ = 'Europe/Moscow';
const msk = (s: string) => new Date(`${s}+03:00`);

describe('plural', () => {
  it('handles Russian plural forms', () => {
    const f = ['день', 'дня', 'дней'] as const;
    expect([1, 2, 5, 11, 21, 22, 25, 111].map((n) => plural(n, f))).toEqual([
      'день',
      'дня',
      'дней',
      'дней',
      'день',
      'дня',
      'дней',
      'дней',
    ]);
  });
});

describe('formatSpan', () => {
  it('picks a readable unit', () => {
    expect(formatSpan(5 * 60_000)).toBe('5 мин');
    expect(formatSpan(3 * 3_600_000)).toBe('3 ч');
    expect(formatSpan(2 * 86_400_000)).toBe('2 дня');
    expect(formatSpan(21 * 86_400_000)).toBe('3 недели');
    expect(formatSpan(90 * 86_400_000)).toBe('3 месяца');
    expect(formatSpan(365 * 86_400_000)).toBe('1 год');
  });
});

describe('describeSchedule', () => {
  it('describes each kind', () => {
    expect(describeSchedule({ kind: 'daily_slots', times: ['08:00', '20:00'] })).toBe(
      'каждый день в 08:00 и 20:00',
    );
    const base = { kind: 'interval', anchor: 'completion', startDate: '' } as const;
    expect(describeSchedule({ ...base, every: 1, unit: 'day' })).toBe('каждый день');
    expect(describeSchedule({ ...base, every: 2, unit: 'week' })).toBe('каждые 2 недели');
    expect(describeSchedule({ ...base, every: 3, unit: 'year' })).toBe('раз в 3 года');
  });
});

describe('describeDue', () => {
  const litter = {
    kind: 'interval',
    every: 14,
    unit: 'day',
    anchor: 'completion',
    startDate: '',
  } as const;
  const c = [{ doneAt: msk('2026-09-10T20:00:00').toISOString(), kind: 'done' as const }];
  const label = (now: string) => {
    const n = msk(now);
    return describeDue(evaluate(litter, c, { now: n, tz: TZ }), n, TZ);
  };
  it('reads naturally', () => {
    expect(label('2026-09-20T12:00:00')).toBe('через 4 дня');
    expect(label('2026-09-23T12:00:00')).toBe('завтра');
    expect(label('2026-09-24T12:00:00')).toBe('пора');
    expect(label('2026-09-26T12:00:00')).toMatch(/^просрочено на 2 дня$/);
  });
});

describe('templates', () => {
  it('have unique keys and valid schedules for any answers', () => {
    const keys = new Set(TASK_TEMPLATES.map((t) => t.key));
    expect(keys.size).toBe(TASK_TEMPLATES.length);
    for (const outdoor of [true, false])
      for (const longHair of [true, false])
        for (const t of TASK_TEMPLATES) {
          const s = t.schedule({ outdoor, longHair, clumpingLitter: true, ageYears: 12 });
          expect(['daily_slots', 'interval']).toContain(s.kind);
        }
  });

  it('adapts to onboarding answers', () => {
    const deworm = TASK_TEMPLATES.find((t) => t.key === 'deworming')!;
    expect(deworm.schedule({ outdoor: true, longHair: false, clumpingLitter: true })).toMatchObject(
      {
        every: 3,
        unit: 'month',
      },
    );
    const vet = TASK_TEMPLATES.find((t) => t.key === 'vet_checkup')!;
    expect(
      vet.schedule({ outdoor: false, longHair: false, clumpingLitter: true, ageYears: 11 }),
    ).toMatchObject({
      every: 6,
      unit: 'month',
    });
  });
});
