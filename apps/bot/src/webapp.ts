import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Validates Telegram Mini App initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 * secret = HMAC_SHA256(key="WebAppData", bot_token); hash = hex(HMAC_SHA256(secret, data_check_string)).
 * Returns the Telegram user id, or null if the signature is wrong or the data is too old.
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  now = Date.now(),
  maxAgeSec = 24 * 60 * 60,
): { userId: number } | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheck).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSec) return null;
  try {
    const user = JSON.parse(params.get('user') ?? '') as { id?: number };
    return typeof user.id === 'number' ? { userId: user.id } : null;
  } catch {
    return null;
  }
}

/** Builds signed initData (used by tests). */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const dataCheck = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(dataCheck).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
