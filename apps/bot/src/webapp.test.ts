import { describe, expect, it } from 'vitest';
import { signInitData, verifyInitData } from './webapp';

const TOKEN = '42:secret';
const now = 1_790_000_000_000;
const fields = {
  auth_date: String(Math.floor(now / 1000) - 60),
  query_id: 'AAE',
  user: JSON.stringify({ id: 111, first_name: 'Маша' }),
};

describe('verifyInitData', () => {
  it('accepts correctly signed, fresh data', () => {
    expect(verifyInitData(signInitData(fields, TOKEN), TOKEN, now)).toEqual({ userId: 111 });
  });

  it('rejects a wrong token, tampering and old data', () => {
    expect(verifyInitData(signInitData(fields, 'other'), TOKEN, now)).toBeNull();
    const tampered = signInitData(fields, TOKEN).replace('111', '222');
    expect(verifyInitData(tampered, TOKEN, now)).toBeNull();
    expect(verifyInitData(signInitData(fields, TOKEN), TOKEN, now + 2 * 86_400_000)).toBeNull();
    expect(verifyInitData('user=1', TOKEN, now)).toBeNull();
  });
});
