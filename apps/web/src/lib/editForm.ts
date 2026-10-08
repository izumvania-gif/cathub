import { useState } from 'react';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Fields of `values` that differ from `base` (what the user changed). */
export function diff<T extends Record<string, unknown>>(values: T, base: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(values) as Array<keyof T>)
    if (!same(values[k], base[k])) out[k] = values[k];
  return out;
}

/** New server data: untouched fields follow the server, edited ones keep the user's value. */
export function rebase<T extends Record<string, unknown>>(values: T, base: T, server: T): T {
  const next = { ...values };
  for (const k of Object.keys(server) as Array<keyof T>)
    if (same(values[k], base[k])) next[k] = server[k];
  return next;
}

/**
 * State for a form that edits a server record.
 *
 * The form opens with whatever data is at hand, which can be stale: the offline cache is restored
 * on reload and only then refreshed from the server, and another family member may edit the same
 * record. So:
 * - when the record's version changes (pass `updated`), fields the user hasn't touched take the
 *   new server value, fields being edited keep the user's text;
 * - `changes()` returns only the fields the user changed, so a save never writes back an old
 *   value the form happened to be showing.
 */
export function useEditForm<T extends Record<string, unknown>>(server: T, version: string) {
  const [base, setBase] = useState(server);
  const [values, setValues] = useState(server);
  const [seen, setSeen] = useState(version);

  // Newer server data arrived (React's "adjust state when a prop changes" pattern).
  if (version !== seen) {
    setSeen(version);
    setValues(rebase(values, base, server));
    setBase(server);
  }

  const changes = () => diff(values, base);

  return {
    values,
    set: (patch: Partial<T>) => setValues((v) => ({ ...v, ...patch })),
    changes,
    dirty: Object.keys(changes()).length > 0,
    /** After a successful save: what was sent is now the server's state. */
    saved: (sent: Partial<T>) => setBase((b) => ({ ...b, ...sent })),
  };
}
