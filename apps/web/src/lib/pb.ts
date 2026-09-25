import PocketBase from 'pocketbase';

/** Same-origin client: in production PocketBase serves the app, in dev Vite proxies /api. */
export const pb = new PocketBase(window.location.origin);
pb.autoCancellation(false);

/** PocketBase dates look like "2026-09-25 08:12:00.000Z"; Safari can't parse the space. */
export const toIso = (pbDate: string) => pbDate.replace(' ', 'T');
export const toPbDate = (d: Date) => d.toISOString().replace('T', ' ');

export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (
      err as { response?: { message?: string; data?: Record<string, { message?: string }> } }
    ).response;
    const field = r?.data && Object.values(r.data)[0]?.message;
    if (field) return field;
    if (r?.message) return r.message;
  }
  if (err instanceof Error) return err.message;
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}
