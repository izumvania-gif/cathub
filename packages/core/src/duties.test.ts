import { describe, expect, it } from 'vitest';
import { assigneeFor, assignMode, type AssignableTask, type DutyContext } from './duties';

const TZ = 'Europe/Moscow';
const msk = (s: string) => new Date(`${s}+03:00`);
// 2026-09-25 is a Friday (5), 26th Saturday (6).
const FRI = msk('2026-09-25T09:00:00');
const SAT = msk('2026-09-26T09:00:00');

const litter: AssignableTask = {
  id: 'litter',
  category: 'litter',
  schedule: { kind: 'daily_slots', times: ['09:00', '21:00'] },
  assign_mode: 'zone',
};
const ctx: DutyContext = {
  tz: TZ,
  zones: {
    litter: { user: 'petya', weekdays: { 6: 'masha', 7: 'masha' } },
    feeding: { user: 'masha' },
  },
};

describe('assigneeFor', () => {
  it('zones: the category person, or someone else on some weekdays', () => {
    expect(assigneeFor(litter, FRI, ctx)).toEqual({ user: 'petya', source: 'zone' });
    expect(assigneeFor(litter, SAT, ctx)).toEqual({ user: 'masha', source: 'zone' });
    expect(assigneeFor({ ...litter, category: 'vet' }, FRI, ctx)).toEqual({
      user: null,
      source: 'anyone',
    });
  });

  it('weekday and slot maps use the household timezone', () => {
    const t: AssignableTask = { ...litter, assign_mode: 'weekday', duty_map: { '5': 'masha' } };
    expect(assigneeFor(t, FRI, ctx).user).toBe('masha');
    // 23:30 UTC on Thursday is already Friday in Moscow.
    expect(assigneeFor(t, new Date('2026-09-24T23:30:00Z'), ctx).user).toBe('masha');
    expect(assigneeFor(t, SAT, ctx).user).toBeNull();
    const slots: AssignableTask = {
      ...litter,
      assign_mode: 'slot',
      duty_map: { '09:00': 'petya', '21:00': 'masha' },
    };
    expect(assigneeFor(slots, FRI, ctx).user).toBe('petya');
    expect(assigneeFor(slots, msk('2026-09-25T21:00:00'), ctx).user).toBe('masha');
  });

  it('an override for that occurrence wins', () => {
    const c = {
      ...ctx,
      overrides: [{ task: 'litter', occurrence: FRI.toISOString(), user: 'masha' }],
    };
    expect(assigneeFor(litter, FRI, c)).toEqual({ user: 'masha', source: 'override' });
    expect(assigneeFor(litter, msk('2026-09-25T21:00:00'), c).user).toBe('petya');
  });

  it('when the person is away, it falls to anyone', () => {
    const c = { ...ctx, absences: [{ user: 'petya', from: '2026-09-25', to: '2026-09-27' }] };
    expect(assigneeFor(litter, FRI, c)).toEqual({ user: null, source: 'anyone', away: 'petya' });
    expect(assigneeFor(litter, msk('2026-09-28T09:00:00'), c).user).toBe('petya');
  });

  it('older tasks: mode from assignee and rotation', () => {
    expect(assignMode({ ...litter, assign_mode: '', assignee: 'masha' })).toBe('one');
    expect(
      assignMode({ ...litter, assign_mode: '', assignee: 'masha', rotation: ['masha', 'petya'] }),
    ).toBe('rotation');
    expect(assignMode({ ...litter, assign_mode: '' })).toBe('anyone');
    expect(
      assigneeFor({ ...litter, assign_mode: 'rotation', assignee: 'petya' }, FRI, ctx).user,
    ).toBe('petya');
  });
});
