import type { IntervalUnit, Schedule } from './schedule';

export type TaskCategory =
  | 'feeding'
  | 'litter'
  | 'grooming'
  | 'health'
  | 'parasites'
  | 'vaccines'
  | 'vet'
  | 'supplies'
  | 'other';

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  feeding: 'Питание',
  litter: 'Лоток',
  grooming: 'Груминг',
  health: 'Здоровье',
  parasites: 'Паразиты',
  vaccines: 'Прививки',
  vet: 'Ветеринар',
  supplies: 'Запасы',
  other: 'Другое',
};

/** Onboarding answers that tune default intervals (docs/PLAN.md §5). */
export interface OnboardingAnswers {
  outdoor: boolean;
  longHair: boolean;
  clumpingLitter: boolean;
  /** Cat age in years, if known (senior cats get vet checks twice a year). */
  ageYears?: number | null;
}

export interface TrackValue {
  label: string;
  unit: string;
}

export interface TaskTemplate {
  key: string;
  title: string;
  emoji: string;
  category: TaskCategory;
  /** Selected by default in onboarding. */
  recommended: boolean;
  /** Medical interval: show "check with your vet / product label" (CLAUDE.md, Constraints). */
  medical: boolean;
  /** Rare task: onboarding asks when it was last done. */
  askLastDone: boolean;
  trackValue?: TrackValue;
  /** Short explanation of where the default comes from (docs/REFERENCES.md §3). */
  basis: string;
  schedule: (a: OnboardingAnswers) => ScheduleSpec;
}

/** Schedule without the start date, which is filled in when the task is created. */
export type ScheduleSpec =
  | Extract<Schedule, { kind: 'daily_slots' }>
  | (Omit<Extract<Schedule, { kind: 'interval' }>, 'startDate'> & { startDate?: string });

const every = (
  n: number,
  unit: IntervalUnit,
  graceDays?: number,
): Omit<Extract<Schedule, { kind: 'interval' }>, 'startDate'> => ({
  kind: 'interval',
  every: n,
  unit,
  anchor: 'completion',
  ...(graceDays ? { graceDays } : {}),
});

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    key: 'feeding',
    title: 'Покормить',
    emoji: '🍽️',
    category: 'feeding',
    recommended: true,
    medical: false,
    askLastDone: false,
    basis: 'Cornell: взрослой кошке 1–2 раза в день; ICC/AAFP: лучше чаще и понемногу',
    schedule: () => ({ kind: 'daily_slots', times: ['08:00', '20:00'] }),
  },
  {
    key: 'water',
    title: 'Свежая вода и чистые миски',
    emoji: '💧',
    category: 'feeding',
    recommended: true,
    medical: false,
    askLastDone: false,
    basis: 'ASPCA: свежая вода всегда, миски мыть ежедневно',
    schedule: () => ({ kind: 'daily_slots', times: ['09:00'] }),
  },
  {
    key: 'litter_scoop',
    title: 'Убрать лоток',
    emoji: '🧹',
    category: 'litter',
    recommended: true,
    medical: false,
    askLastDone: false,
    basis: 'AAFP/AAHA/ASPCA: минимум раз в день; ICC: дважды в день',
    schedule: () => ({ kind: 'daily_slots', times: ['09:00', '21:00'] }),
  },
  {
    key: 'litter_change',
    title: 'Полностью сменить наполнитель',
    emoji: '🪣',
    category: 'litter',
    recommended: true,
    medical: false,
    askLastDone: true,
    basis: 'AAFP/ISFM: раз в 1–4 недели; ICC: комкующийся — раз в 2–4 недели',
    schedule: (a) => (a.clumpingLitter ? every(14, 'day', 7) : every(7, 'day', 2)),
  },
  {
    key: 'fountain_filter',
    title: 'Заменить фильтр фонтанчика',
    emoji: '⛲',
    category: 'feeding',
    recommended: false,
    medical: false,
    askLastDone: true,
    basis: 'Инструкция к фонтанчику, обычно раз в 4 недели',
    schedule: () => every(28, 'day', 3),
  },
  {
    key: 'brushing',
    title: 'Вычесать',
    emoji: '🪮',
    category: 'grooming',
    recommended: true,
    medical: false,
    askLastDone: false,
    basis: 'ICC: длинную шерсть — ежедневно, короткой почти не нужно',
    schedule: (a) => (a.longHair ? every(1, 'day') : every(7, 'day', 3)),
  },
  {
    key: 'nails',
    title: 'Подстричь когти',
    emoji: '✂️',
    category: 'grooming',
    recommended: true,
    medical: false,
    askLastDone: true,
    basis: 'ASPCA: каждые 10–14 дней',
    schedule: () => every(14, 'day', 7),
  },
  {
    key: 'teeth',
    title: 'Почистить зубы',
    emoji: '🦷',
    category: 'grooming',
    recommended: false,
    medical: false,
    askLastDone: false,
    basis: 'AAHA Dental 2019: ежедневная чистка',
    schedule: () => every(1, 'day'),
  },
  {
    key: 'weight',
    title: 'Взвесить',
    emoji: '⚖️',
    category: 'health',
    recommended: true,
    medical: false,
    askLastDone: false,
    trackValue: { label: 'Вес', unit: 'кг' },
    basis: 'Hill’s: взрослую кошку — раз в месяц',
    schedule: () => every(1, 'month', 7),
  },
  {
    key: 'fleas',
    title: 'Обработка от блох и клещей',
    emoji: '🐛',
    category: 'parasites',
    recommended: true,
    medical: true,
    askLastDone: true,
    basis: 'CAPC: круглый год; большинство средств — раз в месяц',
    schedule: () => every(30, 'day', 3),
  },
  {
    key: 'deworming',
    title: 'Дать средство от глистов',
    emoji: '💊',
    category: 'parasites',
    recommended: true,
    medical: true,
    askLastDone: true,
    basis: 'ESCCAP GL1 (2025): домашним 1–2 раза в год, с выгулом — не реже 4 раз в год',
    schedule: (a) => (a.outdoor ? every(3, 'month', 7) : every(6, 'month', 14)),
  },
  {
    key: 'vaccine_complex',
    title: 'Комплексная прививка',
    emoji: '💉',
    category: 'vaccines',
    recommended: true,
    medical: true,
    askLastDone: true,
    basis: 'WSAVA 2024, AAHA/AAFP 2020: раз в 3 года, при высоком риске — ежегодно',
    schedule: (a) => (a.outdoor ? every(1, 'year', 30) : every(3, 'year', 30)),
  },
  {
    key: 'vaccine_rabies',
    title: 'Прививка от бешенства',
    emoji: '💉',
    category: 'vaccines',
    recommended: true,
    medical: true,
    askLastDone: true,
    basis: 'Приказ Минсельхоза № 705, практика в РФ — ежегодно',
    schedule: () => every(1, 'year', 14),
  },
  {
    key: 'vet_checkup',
    title: 'Осмотр у ветеринара',
    emoji: '🩺',
    category: 'vet',
    recommended: true,
    medical: true,
    askLastDone: true,
    basis: 'AAHA/AAFP 2021: раз в год; с 10 лет — раз в полгода',
    schedule: (a) => ((a.ageYears ?? 0) >= 10 ? every(6, 'month', 30) : every(1, 'year', 30)),
  },
  {
    key: 'supplies',
    title: 'Купить корм и наполнитель',
    emoji: '🛒',
    category: 'supplies',
    recommended: false,
    medical: false,
    askLastDone: false,
    basis: 'Пока по времени; позже — по запасам',
    schedule: () => every(30, 'day', 3),
  },
];

export const templateByKey = (key: string) => TASK_TEMPLATES.find((t) => t.key === key);
