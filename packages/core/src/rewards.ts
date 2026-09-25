import { TZDate } from '@date-fns/tz';
import { evaluate, slotWindows, type CompletionLike } from './engine';
import type { Schedule, TaskStatus } from './schedule';
import type { TaskCategory } from './templates';

/**
 * Fish 🐟 — the in-app currency for the cat's room (docs/PLAN.md §6.7). No real money. Each
 * completion is priced once, when it's made, from the task's status at that moment, and the
 * amount is stored on the completion; the balance is a sum on the server.
 */

export type Weight = 1 | 2 | 3;

export const WEIGHT_LABELS: Record<Weight, string> = { 1: 'Лёгкое', 2: 'Обычное', 3: 'Тяжёлое' };

const TEMPLATE_WEIGHT: Record<string, Weight> = {
  feeding: 1,
  water: 1,
  litter_scoop: 2,
  litter_change: 3,
  fountain_filter: 2,
  brushing: 2,
  nails: 2,
  teeth: 2,
  weight: 1,
  fleas: 2,
  deworming: 2,
  vaccine_complex: 3,
  vaccine_rabies: 3,
  vet_checkup: 3,
  supplies: 1,
};

const CATEGORY_WEIGHT: Partial<Record<TaskCategory, Weight>> = {
  litter: 2,
  grooming: 2,
  parasites: 2,
  vaccines: 3,
  vet: 3,
};

/** The task's weight: set explicitly (1–3), else a default for its template or category. */
export function taskWeight(t: {
  weight?: number | null;
  template_key?: string | null;
  category?: string | null;
}): Weight {
  if (t.weight === 1 || t.weight === 2 || t.weight === 3) return t.weight;
  return (
    (t.template_key ? TEMPLATE_WEIGHT[t.template_key] : undefined) ??
    CATEGORY_WEIGHT[t.category as TaskCategory] ??
    1
  );
}

export const FISH_PER_WEIGHT = 5;
export const ON_TIME_BONUS = 1.5;
export const PERFECT_DAY_FISH = 10;

export interface RewardInput {
  schedule: Schedule;
  weight: Weight;
  /** Every other completion of the task (any order; later ones are ignored). */
  others: readonly CompletionLike[];
  completion: CompletionLike;
  tz: string;
}

/**
 * Fish for one completion: weight × 5, ×1.5 if done before the task became overdue, nothing for
 * a skip or for a repeat mark of an occurrence that was already covered (no farming).
 */
export function rewardFor({ schedule, weight, others, completion, tz }: RewardInput): number {
  if (completion.kind !== 'done') return 0;
  const at = Date.parse(completion.doneAt);
  // Status just before this completion, from the completions made before it.
  const before = others.filter((c) => c !== completion && Date.parse(c.doneAt) < at);
  const ev = evaluate(schedule, before, { now: new Date(at), tz });
  return fishForStatus(ev.status, weight);
}

/** Fish for marking a task that currently has this status. */
export function fishForStatus(status: TaskStatus, weight: Weight): number {
  if (status === 'done') return 0;
  const base = weight * FISH_PER_WEIGHT;
  return status === 'overdue' ? base : Math.round(base * ON_TIME_BONUS);
}

/** What marking the task now would bring (shown in the app before the server confirms it). */
export function rewardNow(
  schedule: Schedule,
  weight: Weight,
  completions: readonly CompletionLike[],
  now: Date,
  tz: string,
): number {
  const c: CompletionLike = { doneAt: now.toISOString(), kind: 'done' };
  return rewardFor({ schedule, weight, others: completions, completion: c, tz });
}

/**
 * A "perfect day": every slot of every daily task that day was covered (even if late).
 * Days with no daily tasks don't count. `dayStart`/`dayEnd` bound the local day.
 */
export function perfectDay(
  tasks: readonly { schedule: Schedule; completions: readonly CompletionLike[] }[],
  dayStart: Date,
  dayEnd: Date,
  tz: string,
): boolean {
  let slots = 0;
  for (const t of tasks) {
    if (t.schedule.kind !== 'daily_slots') continue;
    const done = t.completions.filter((c) => c.kind === 'done').map((c) => Date.parse(c.doneAt));
    for (const w of slotWindows(t.schedule, dayStart, dayEnd, tz)) {
      slots++;
      if (!done.some((d) => d >= w.start && d < w.end)) return false;
    }
  }
  return slots > 0;
}

/** The room shop. Prices live here so the app, the bot and the tests agree. */
export const ROOM_CATALOG = {
  window: 0,
  box: 0,
  ball: 0,
  rug: 40,
  plant: 50,
  picture: 60,
  mouse: 70,
  scratcher: 80,
  garland: 90,
  bed: 120,
  tree: 250,
  aquarium: 300,
} as const;

export type RoomItemKey = keyof typeof ROOM_CATALOG;

export const STARTER_ITEMS: readonly RoomItemKey[] = (
  Object.keys(ROOM_CATALOG) as RoomItemKey[]
).filter((k) => ROOM_CATALOG[k] === 0);

/** [start, end) of a local calendar day "YYYY-MM-DD" in the timezone. */
export function localDayBounds(date: string, tz: string): [Date, Date] {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const start = new TZDate(y, m - 1, d, tz);
  const end = new TZDate(y, m - 1, d + 1, tz);
  return [new Date(start.getTime()), new Date(end.getTime())];
}
