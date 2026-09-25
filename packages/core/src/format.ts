import { TZDate } from '@date-fns/tz';
import { differenceInCalendarDays } from 'date-fns';
import type { Evaluation } from './engine';
import type { IntervalUnit, Schedule } from './schedule';

/** Russian plural: plural(5, ['день', 'дня', 'дней']) → 'дней'. */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

const UNIT_FORMS: Record<IntervalUnit, readonly [string, string, string]> = {
  hour: ['час', 'часа', 'часов'],
  day: ['день', 'дня', 'дней'],
  week: ['неделю', 'недели', 'недель'],
  month: ['месяц', 'месяца', 'месяцев'],
  year: ['год', 'года', 'лет'],
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "5 мин", "3 ч", "2 дня", "3 недели", "2 месяца", "1 год". */
export function formatSpan(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < HOUR) {
    const m = Math.max(1, Math.round(abs / MINUTE));
    return `${m} мин`;
  }
  if (abs < 24 * HOUR) return `${Math.round(abs / HOUR)} ч`;
  const days = Math.round(abs / (24 * HOUR));
  if (days < 14) return `${days} ${plural(days, UNIT_FORMS.day)}`;
  if (days < 60) {
    const w = Math.round(days / 7);
    return `${w} ${plural(w, ['неделю', 'недели', 'недель'])}`;
  }
  if (days < 365) {
    const mo = Math.round(days / 30);
    return `${mo} ${plural(mo, ['месяц', 'месяца', 'месяцев'])}`;
  }
  const y = Math.round(days / 365);
  return `${y} ${plural(y, ['год', 'года', 'лет'])}`;
}

/** "каждый день", "каждые 2 недели", "раз в 3 года", "каждый день в 08:00 и 20:00". */
export function describeSchedule(schedule: Schedule): string {
  switch (schedule.kind) {
    case 'daily_slots': {
      const times = schedule.times.join(', ').replace(/, ([^,]*)$/, ' и $1');
      const days = schedule.weekdays?.length ? ` (${schedule.weekdays.length} дн. в неделю)` : '';
      return `каждый день в ${times}${days}`;
    }
    case 'interval': {
      const { every: n, unit } = schedule;
      if (n === 1) {
        const one = {
          hour: 'каждый час',
          day: 'каждый день',
          week: 'каждую неделю',
          month: 'каждый месяц',
          year: 'раз в год',
        };
        return one[unit];
      }
      if (unit === 'year' || unit === 'month') return `раз в ${n} ${plural(n, UNIT_FORMS[unit])}`;
      return `каждые ${n} ${plural(n, UNIT_FORMS[unit])}`;
    }
    case 'once':
      return 'один раз';
  }
}

/** Short due label for a task card: "просрочено на 3 ч", "сегодня", "через 2 дня", "в 20:00". */
export function describeDue(ev: Evaluation, now: Date, tz: string): string {
  if (!ev.due) return 'выполнено';
  const due = ev.due.getTime();
  const n = now.getTime();
  const dayDiff = differenceInCalendarDays(new TZDate(due, tz), new TZDate(n, tz));
  const time = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(ev.due);
  // Day-granular tasks are due at local midnight: count calendar days, not hours.
  const isMidnight = time === '00:00';
  if (ev.status === 'overdue') {
    const days = -dayDiff;
    return isMidnight && days >= 1
      ? `просрочено на ${days} ${plural(days, UNIT_FORMS.day)}`
      : `просрочено на ${formatSpan(n - due)}`;
  }
  if (ev.status === 'due') return 'пора';
  if (dayDiff === 0) return isMidnight ? 'сегодня' : `сегодня в ${time}`;
  if (dayDiff === 1) return isMidnight ? 'завтра' : `завтра в ${time}`;
  if (dayDiff < 7) return `через ${dayDiff} ${plural(dayDiff, UNIT_FORMS.day)}`;
  return `через ${formatSpan(due - n)}`;
}

/** "сегодня в 08:12", "вчера в 21:40", "3 сент." */
export function describeWhen(iso: string | Date, now: Date, tz: string): string {
  const d = new Date(iso);
  const dayDiff = differenceInCalendarDays(
    new TZDate(now.getTime(), tz),
    new TZDate(d.getTime(), tz),
  );
  const time = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(d);
  if (dayDiff === 0) return `сегодня в ${time}`;
  if (dayDiff === 1) return `вчера в ${time}`;
  const sameYear =
    new TZDate(now.getTime(), tz).getFullYear() === new TZDate(d.getTime(), tz).getFullYear();
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: tz,
  }).format(d);
}
