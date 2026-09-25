import { TZDate } from '@date-fns/tz';
import type { Mood } from '../cat/behavior';
import type { BoardItem } from './board';

/** The feeding task shown in the hero: the template one, else a custom daily feeding task. */
export function findFeeding(items: BoardItem[]): BoardItem | undefined {
  return (
    items.find((i) => i.task.template_key === 'feeding') ??
    items.find(
      (i) =>
        i.task.category === 'feeding' &&
        i.task.schedule.kind === 'daily_slots' &&
        /корм/i.test(i.task.title),
    )
  );
}

/** Evening in the household's timezone: the room lights up and the cat gets sleepy. */
export function isEvening(now: Date, tz: string) {
  const h = new TZDate(now, tz).getHours();
  return h >= 21 || h < 7;
}

function isNight(now: Date, tz: string) {
  const h = new TZDate(now, tz).getHours();
  return h >= 23 || h < 7;
}

const FED_FOR = 30 * 60_000;

/**
 * How the cat feels, from top priority down (docs/PLAN.md §6.2). Medical chores never make it
 * sad or sick — no guilt trips; they only count as "something's overdue".
 */
export function catMood(items: BoardItem[], now: Date, tz: string): Mood {
  const feeding = findFeeding(items);
  if (feeding?.covered && feeding.covered.kind === 'done') {
    const ago = now.getTime() - Date.parse(feeding.covered.done_at);
    if (ago >= 0 && ago < FED_FOR) return 'fed';
  }
  if (feeding && (feeding.ev.status === 'due' || feeding.ev.status === 'overdue')) return 'hungry';
  const overdue = items.filter((i) => i.ev.status === 'overdue' && !i.ev.snoozed);
  if (overdue.some((i) => i.task.category === 'litter')) return 'grumpy';
  if (overdue.length) return 'restless';
  if (isNight(now, tz)) return 'sleepy';
  const pending = items.some((i) => i.ev.status === 'due' || i.ev.status === 'overdue');
  const doneToday = items.some((i) => i.ev.status === 'done');
  if (!pending && doneToday) return 'happy';
  return 'calm';
}

/** Food in the room's bowl: full right after feeding, empty by the next slot. */
export function bowlLevel(feeding: BoardItem | undefined) {
  if (!feeding) return 0.5;
  const fed = feeding.ev.status === 'done' && feeding.covered;
  return fed ? Math.max(0.08, 1 - feeding.ev.dueness) : 0;
}
