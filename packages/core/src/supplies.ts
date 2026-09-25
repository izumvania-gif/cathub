import { TZDate } from '@date-fns/tz';
import { addDays, startOfDay } from 'date-fns';
import { plural } from './format';

/** A consumable (food, litter) tracked by stock + daily usage (docs/PLAN.md §3.2). */
export interface SupplyLike {
  /** Amount in `unit` at `stockAt`. */
  stock: number;
  /** ISO timestamp when the stock was last counted or topped up. */
  stockAt: string;
  /** Average usage per day, in `unit`. 0 = not tracked. */
  dailyUsage: number;
  /** Warn when it lasts fewer days than this. */
  lowDays: number;
}

export type SupplyStatus = 'ok' | 'low' | 'out';

export interface SupplyForecast {
  remaining: number;
  /** Days of stock left, or null if usage is unknown. */
  daysLeft: number | null;
  /** Local date "YYYY-MM-DD" when it runs out, or null if usage is unknown. */
  runsOutOn: string | null;
  status: SupplyStatus;
}

export function supplyForecast(s: SupplyLike, now: Date, tz: string): SupplyForecast {
  const elapsedDays = Math.max(0, (now.getTime() - Date.parse(s.stockAt)) / 86_400_000);
  const remaining = Math.max(0, s.stock - s.dailyUsage * elapsedDays);
  if (!(s.dailyUsage > 0)) {
    return { remaining, daysLeft: null, runsOutOn: null, status: remaining > 0 ? 'ok' : 'out' };
  }
  const daysLeft = remaining / s.dailyUsage;
  const runsOut = addDays(startOfDay(new TZDate(now.getTime(), tz)), Math.floor(daysLeft));
  return {
    remaining,
    daysLeft,
    runsOutOn: new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(runsOut),
    status: remaining <= 0 ? 'out' : daysLeft <= s.lowDays ? 'low' : 'ok',
  };
}

/** "1,2 кг", "14 шт": integers for countable units, one decimal otherwise. */
export function formatAmount(value: number, unit: string): string {
  const countable = /^(шт|пач|бан|пак|пауч)/i.test(unit);
  const n = countable ? Math.floor(value) : Math.round(value * 10) / 10;
  return `${n.toLocaleString('ru-RU')} ${unit}`;
}

/** "хватит на 9 дней", "хватит меньше чем на день", "закончилось". */
export function describeSupply(f: SupplyForecast): string {
  if (f.status === 'out') return 'закончилось';
  if (f.daysLeft === null) return 'расход не указан';
  const d = Math.floor(f.daysLeft);
  if (d < 1) return 'хватит меньше чем на день';
  return `хватит на ${d} ${plural(d, ['день', 'дня', 'дней'])}`;
}

export interface SupplyTemplate {
  key: string;
  name: string;
  emoji: string;
  unit: string;
  dailyUsage: number;
  lowDays: number;
}

/** Starting points; usage depends on the cat and the product, so it's editable. */
export const SUPPLY_TEMPLATES: SupplyTemplate[] = [
  { key: 'dry_food', name: 'Сухой корм', emoji: '🥣', unit: 'кг', dailyUsage: 0.06, lowDays: 7 },
  { key: 'wet_food', name: 'Влажный корм', emoji: '🥫', unit: 'шт', dailyUsage: 2, lowDays: 4 },
  { key: 'litter', name: 'Наполнитель', emoji: '🪣', unit: 'кг', dailyUsage: 0.3, lowDays: 7 },
];
