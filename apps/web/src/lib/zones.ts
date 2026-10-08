import type { DutyZone, DutyZones, TaskCategory } from '@cathub/core';
import type { Household } from './types';

/** A change to one category's zone, applied to whatever the zone currently is. */
export type ZoneUpdate = (zone: DutyZone | undefined) => DutyZone | undefined;

interface Edit {
  category: TaskCategory;
  fn: ZoneUpdate;
}

export function applyZone(
  zones: DutyZones | null | undefined,
  category: TaskCategory,
  fn: ZoneUpdate,
): DutyZones {
  const next = { ...zones };
  const zone = fn(next[category]);
  if (zone) next[category] = zone;
  else delete next[category];
  return next;
}

/** Zone edits shown on screen but not saved yet (saves go one at a time). */
const pending: Edit[] = [];

export function addPendingZone(edit: Edit) {
  pending.push(edit);
  return () => {
    const i = pending.indexOf(edit);
    if (i >= 0) pending.splice(i, 1);
  };
}

/** The newest household copy from the server. */
let lastServer: Household | undefined;

function applyPending<H extends Household | undefined>(h: H): H {
  if (!h || !pending.length) return h;
  return {
    ...h,
    duty_zones: pending.reduce((z, e) => applyZone(z, e.category, e.fn), h.duty_zones),
  };
}

/** Household data as the server sent it plus the edits still on their way, so a refetch in the
 * middle of saving doesn't flip the selects back. */
export function withPendingZones<H extends Household | undefined>(h: H): H {
  if (h) lastServer = h;
  return applyPending(h);
}

/** With no edit on its way, the cached household is the server's copy (also one restored from
 * the offline cache before any fetch this session). */
export function seedServerCopy(h: Household | undefined) {
  if (h && !pending.length) lastServer = h;
}

/** What to show after a save failed: the server's copy plus the edits still on their way. */
export function zonesAfterFailure(): Household | undefined {
  return applyPending(lastServer);
}
