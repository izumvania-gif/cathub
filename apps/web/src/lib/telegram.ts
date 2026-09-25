import { pb } from './pb';

const KEY = 'cathub.tgInitData';

/**
 * Telegram opens a Mini App with `#tgWebAppData=<initData>&…` in the URL. Grab it once on load
 * (the router may drop the hash later) without loading Telegram's SDK from telegram.org.
 */
export function captureTelegramInitData(): void {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const data = hash.get('tgWebAppData');
  if (!data) return;
  try {
    sessionStorage.setItem(KEY, data);
  } catch {
    /* ignore */
  }
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

export const isTelegramMiniApp = () => {
  try {
    return Boolean(sessionStorage.getItem(KEY));
  } catch {
    return false;
  }
};

/** Signs in with Telegram inside the Mini App. Returns an error message, or '' on success. */
export async function loginWithTelegram(): Promise<string> {
  let initData = '';
  try {
    initData = sessionStorage.getItem(KEY) ?? '';
  } catch {
    /* ignore */
  }
  if (!initData) return 'Откройте приложение из бота в Telegram.';
  try {
    const res = await pb.send<{ token: string; record: Record<string, unknown> }>(
      '/api/cathub/telegram/webapp-auth',
      { method: 'POST', body: { initData } },
    );
    pb.authStore.save(res.token, res.record as never);
    return '';
  } catch (err) {
    const msg = (err as { response?: { message?: string } }).response?.message;
    return msg || 'Не получилось войти через Telegram.';
  }
}
