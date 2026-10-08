import { describe, expect, it } from 'vitest';
import { diff, rebase } from './editForm';

describe('edit form', () => {
  const base = { name: 'Барсик', birth: '2026-05-01', look: { coat: 'brown' } };

  it('sends only what the user changed', () => {
    expect(diff({ ...base, birth: '2026-07-20' }, base)).toEqual({ birth: '2026-07-20' });
    expect(diff({ ...base, look: { coat: 'brown' } }, base)).toEqual({});
    expect(diff({ ...base, look: { coat: 'ginger' } }, base)).toEqual({ look: { coat: 'ginger' } });
  });

  it('a stale form takes fresh server values for untouched fields', () => {
    // Opened from the offline cache with the old date; the server has the new one.
    const server = { ...base, birth: '2026-07-20' };
    expect(rebase(base, base, server)).toEqual(server);
  });

  it("keeps what the user is editing when someone else's change arrives", () => {
    const editing = { ...base, name: 'Барсик Великий' };
    const server = { ...base, birth: '2026-07-20' };
    expect(rebase(editing, base, server)).toEqual({ ...server, name: 'Барсик Великий' });
    // …and only the name is sent afterwards, so the new date is not overwritten.
    expect(diff(rebase(editing, base, server), server)).toEqual({ name: 'Барсик Великий' });
  });
});
