export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Exponential backoff with jitter: 1s, 2s, 4s … capped at maxMs. */
export function backoffMs(attempt: number, maxMs = 60_000): number {
  const base = Math.min(maxMs, 1000 * 2 ** attempt);
  return Math.round(base / 2 + Math.random() * (base / 2));
}
