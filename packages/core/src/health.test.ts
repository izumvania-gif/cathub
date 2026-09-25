import { describe, expect, it } from 'vitest';
import { healthEventsFromTasks, healthPlan, visibleTips, type HealthEvent } from './health';

const day = (s: string) => new Date(`${s}T12:00:00Z`);
const birth = '2026-08-01T00:00:00Z'; // a kitten born on Aug 1
const plan = (now: string, history: HealthEvent[] = [], neutered = false) =>
  healthPlan({ birthDate: birth, neutered, history, now: day(now) });
const keys = (now: string, history: HealthEvent[] = []) =>
  visibleTips(plan(now, history)).map((t) => `${t.key}:${t.status}`);

describe('healthPlan', () => {
  it('without a birth date asks for it', () => {
    expect(healthPlan({ birthDate: null, history: [], now: day('2026-09-26') })[0]!.key).toBe(
      'need_birthdate',
    );
  });

  it('an 8-week-old kitten: the first vaccine and deworming before it, most pressing first', () => {
    const k = keys('2026-09-26'); // 56 days old
    // The first deworming is covered by the one before the vaccine.
    expect(k.some((x) => x.startsWith('kitten_deworm_start'))).toBe(false);
    // Deworm first (its week closes soonest), then the vaccine; weighing can wait.
    expect(k.slice(0, 2)).toEqual(['deworm_before_kitten_vaccine_1:now', 'kitten_vaccine_1:now']);
    expect(k).toContain('kitten_vaccine_1:now');
    expect(k).toContain('deworm_before_kitten_vaccine_1:now');
    expect(k).toContain('kitten_weigh:now');
  });

  it('deworming 10–14 days before the vaccine, then the course moves on from the real dates', () => {
    const history: HealthEvent[] = [
      { type: 'medication', date: '2026-09-15T10:00:00Z', title: 'Мильбемакс для котят' },
    ];
    const k = keys('2026-09-20', history);
    expect(k).not.toContain('kitten_deworm_start:overdue');
    expect(k.some((x) => x.startsWith('deworm_before_kitten_vaccine_1'))).toBe(false);

    const vaccinated: HealthEvent[] = [
      ...history,
      { type: 'vaccination', date: '2026-09-28T10:00:00Z', title: 'Нобивак Tricat Trio' },
    ];
    const tips = plan('2026-10-01', vaccinated);
    const second = tips.find((t) => t.key === 'kitten_vaccine_2')!;
    // 4 weeks after the first dose (Oct 26) — later than 12 weeks (Oct 24).
    expect(second.due.toISOString().slice(0, 10)).toBe('2026-10-26');
    expect(
      tips
        .find((t) => t.key === 'rabies_first')!
        .due.toISOString()
        .slice(0, 10),
    ).toBe('2026-10-24');
    // Deworm once before the nearest of them (rabies, Oct 24) when it's within ~6 weeks.
    expect(keys('2026-10-12', vaccinated)).toContain('deworm_before_rabies_first:now');
  });

  it('only one deworming tip, before the nearest vaccination', () => {
    const k = keys('2026-09-26');
    expect(k.filter((x) => x.startsWith('deworm_before_'))).toEqual([
      'deworm_before_kitten_vaccine_1:now',
    ]);
  });

  it('window-only tips disappear after their window; vaccines stay overdue', () => {
    const k = keys('2027-06-01'); // 10 months, nothing recorded
    expect(k.some((x) => x.startsWith('teeth_change'))).toBe(false);
    expect(k.some((x) => x.startsWith('kitten_weigh'))).toBe(false);
    expect(k).toContain('rabies_first:overdue');
    expect(k).toContain('kitten_vaccine_1:overdue');
  });

  it('neutered cats get no sterilization tip; grown-ups get the food switch around a year', () => {
    expect(plan('2027-01-05', [], true).some((t) => t.key === 'neuter_consult')).toBe(false);
    expect(plan('2027-01-05').find((t) => t.key === 'neuter_consult')?.status).toBe('now');
    expect(keys('2027-07-20').some((x) => x.startsWith('adult_food'))).toBe(true);
  });

  it('mature and senior cats: yearly bloodwork after 7, a check-up every 6 months after 10', () => {
    const old = (years: number, history: HealthEvent[] = []) =>
      healthPlan({ birthDate: `${2026 - years}-03-01T00:00:00Z`, history, now: day('2026-09-26') });
    expect(old(8).map((t) => t.key)).toEqual(['mature_bloodwork_2026']);
    expect(old(8, [{ type: 'lab', date: '2026-05-01T00:00:00Z', title: 'ОАК' }])[0]!.status).toBe(
      'later',
    );
    expect(old(12)[0]!.key).toMatch(/^senior_checkup_/);
    expect(old(4)).toEqual([]);
  });

  it('done chores count as health events', () => {
    const ev = healthEventsFromTasks([
      {
        template_key: 'vaccine_rabies',
        title: 'Прививка от бешенства',
        completions: [{ doneAt: '2026-10-25T10:00:00Z', kind: 'done' }],
      },
      {
        template_key: 'water',
        title: 'Вода',
        completions: [{ doneAt: '2026-10-25T10:00:00Z', kind: 'done' }],
      },
    ]);
    expect(ev).toEqual([
      { type: 'vaccination', date: '2026-10-25T10:00:00Z', title: 'Прививка от бешенства' },
    ]);
    expect(keys('2026-10-30', ev).some((x) => x.startsWith('rabies_first'))).toBe(false);
  });

  it('shows current tips plus the next one coming, minus hidden ones', () => {
    const tips = plan('2026-08-10'); // 9 days old
    const shown = visibleTips(tips, new Set(['kitten_weigh']));
    expect(shown.map((t) => `${t.key}:${t.status}`)).toEqual([
      'kitten_deworm_start:soon',
      'kitten_vaccine_1:later', // the next one coming
    ]);
  });
});
