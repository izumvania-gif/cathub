import { describe, expect, it } from 'vitest';
import { backoffMs } from './retry';

describe('backoffMs', () => {
  it('grows exponentially and stays within [base/2, base]', () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const base = 1000 * 2 ** attempt;
      const v = backoffMs(attempt);
      expect(v).toBeGreaterThanOrEqual(base / 2);
      expect(v).toBeLessThanOrEqual(base);
    }
  });

  it('is capped', () => {
    expect(backoffMs(20, 60_000)).toBeLessThanOrEqual(60_000);
  });
});
