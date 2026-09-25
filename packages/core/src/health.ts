import type { TaskCategory } from './templates';

/**
 * Age-based health recommendations (docs/PLAN.md §6.8). Pure: from the birth date and what's
 * already recorded, returns what to do and when. These are reminders of common practice, not
 * medical advice — every tip carries "уточните у ветеринара" (docs/REFERENCES.md: WSAVA 2024,
 * AAHA/AAFP 2020–2021, ESCCAP, Минсельхоз № 705 for rabies in Russia).
 */

export type HealthRecordType = 'vaccination' | 'visit' | 'medication' | 'lab' | 'other';

export interface HealthEvent {
  /** A record in «Здоровье», or a done chore mapped to one (see healthEventsFromTasks). */
  type: HealthRecordType;
  /** ISO timestamp. */
  date: string;
  title: string;
}

export interface HealthPlanInput {
  /** ISO date/timestamp, or null if unknown. */
  birthDate: string | null;
  neutered?: boolean;
  history: readonly HealthEvent[];
  now: Date;
}

export type TipStatus = 'overdue' | 'now' | 'soon' | 'later';

export interface HealthTip {
  /** Stable per occurrence, so hiding it or adding it to chores sticks. */
  key: string;
  title: string;
  why: string;
  emoji: string;
  category: TaskCategory;
  /** What «Уже сделано» records, if it's a health record at all. */
  recordType?: HealthRecordType;
  /** Window: from `due` until `until`. */
  due: Date;
  until: Date;
  status: TipStatus;
}

type TipInput = Omit<HealthTip, 'status'> & {
  /** Only makes sense inside its window (teeth, food): gone afterwards, never "overdue". */
  expires?: boolean;
};

const DAY = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const addMonths = (d: Date, n: number) => {
  const r = new Date(d.getTime());
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
};

const RABIES = /беш|rabi|рабикан|рабизин/i;
const DEWORM =
  /глист|гельмин|мильбемакс|milbemax|празицид|дронтал|drontal|профендер|profender|празиквантел|стронгхолд|stronghold|инспектор/i;

export const isRabies = (e: HealthEvent) => e.type === 'vaccination' && RABIES.test(e.title);
/** Complex (FVRCP) vaccines: any vaccination that isn't rabies-only. Combined ones count as both. */
export const isComplex = (e: HealthEvent) =>
  e.type === 'vaccination' &&
  (!RABIES.test(e.title) ||
    /\+|трио|trio|tricat|мультифел|пуревакс|purevax|фелоцел|felocell/i.test(e.title));
export const isDeworming = (e: HealthEvent) =>
  (e.type === 'medication' || e.type === 'other') && DEWORM.test(e.title);

function status(due: Date, until: Date, now: Date): TipStatus {
  const n = now.getTime();
  if (n > until.getTime()) return 'overdue';
  if (n >= due.getTime()) return 'now';
  if (due.getTime() - n <= 30 * DAY) return 'soon';
  return 'later';
}

/** Recommendations for this cat right now, soonest first. */
export function healthPlan({ birthDate, neutered, history, now }: HealthPlanInput): HealthTip[] {
  const tips: HealthTip[] = [];
  const add = ({ expires, ...t }: TipInput) => {
    if (expires && now.getTime() > t.until.getTime()) return;
    tips.push({ ...t, status: status(t.due, t.until, now) });
  };

  if (!birthDate) {
    add({
      key: 'need_birthdate',
      title: 'Укажите дату рождения',
      why: 'Подскажем прививки, глистогонку и осмотры по возрасту. Можно примерно.',
      emoji: '🎂',
      category: 'health',
      due: now,
      until: addDays(now, 3650),
    });
    return tips;
  }

  const birth = new Date(birthDate);
  const age = (now.getTime() - birth.getTime()) / DAY; // days
  const after = (d: Date) => history.filter((e) => Date.parse(e.date) >= d.getTime());
  const complex = after(addDays(birth, 42))
    .filter(isComplex)
    .sort((a, b) => a.date.localeCompare(b.date));
  const rabies = history.filter(isRabies);
  const dewormed = (from: Date, to: Date) =>
    history.some(
      (e) =>
        isDeworming(e) &&
        Date.parse(e.date) >= from.getTime() &&
        Date.parse(e.date) <= to.getTime(),
    );
  const vet = 'Интервалы — ориентир: уточните у ветеринара.';
  const upcomingVaccines: { key: string; at: Date }[] = [];

  // ── kittens ────────────────────────────────────────────────────────────
  if (age < 365) {
    if (age < 70 && !dewormed(addDays(birth, 14), now)) {
      add({
        key: 'kitten_deworm_start',
        title: 'Первая глистогонка котёнку',
        why: 'Котят обрабатывают от глистов с 3–4 недель, дальше — по схеме ветеринара.',
        emoji: '🐛',
        category: 'parasites',
        recordType: 'medication',
        due: addDays(birth, 21),
        until: addDays(birth, 35),
      });
    }

    // Complex vaccine course: 8–9 weeks, then every ~4 weeks, the last dose not before 16 weeks.
    const last = complex.at(-1);
    const n = complex.length;
    if (n === 0) {
      const due = addDays(birth, 56);
      upcomingVaccines.push({ key: 'kitten_vaccine_1', at: due });
      add({
        key: 'kitten_vaccine_1',
        title: 'Первая комплексная прививка',
        why: 'С 8–9 недель: панлейкопения, калицивироз, ринотрахеит. ' + vet,
        emoji: '💉',
        category: 'vaccines',
        recordType: 'vaccination',
        due,
        until: addDays(birth, 70),
      });
    } else if (n === 1 || (n === 2 && Date.parse(last!.date) < addDays(birth, 112).getTime())) {
      const minAt = n === 1 ? addDays(birth, 84) : addDays(birth, 112);
      const byGap = addDays(new Date(last!.date), 28);
      const due = byGap > minAt ? byGap : minAt;
      const key = `kitten_vaccine_${n + 1}`;
      upcomingVaccines.push({ key, at: due });
      add({
        key,
        title: n === 1 ? 'Ревакцинация комплексной' : 'Последняя доза курса котёнка',
        why:
          (n === 1
            ? 'Через 3–4 недели после первой, около 12 недель. '
            : 'Последняя доза — не раньше 16 недель (WSAVA), если так решит ветеринар. ') + vet,
        emoji: '💉',
        category: 'vaccines',
        recordType: 'vaccination',
        due,
        until: addDays(due, 14),
      });
    } else if (!complex.some((e) => Date.parse(e.date) >= addDays(birth, 170).getTime())) {
      // Booster at about 26 weeks (WSAVA) or a year after the course.
      const due = addDays(birth, 182);
      upcomingVaccines.push({ key: 'kitten_booster', at: due });
      add({
        key: 'kitten_booster',
        title: 'Бустер после курса котёнка',
        why: 'Около 6 месяцев (WSAVA) или через год после курса — как скажет ветеринар.',
        emoji: '💉',
        category: 'vaccines',
        recordType: 'vaccination',
        due,
        until: addDays(birth, 400),
      });
    }

    if (!rabies.length) {
      const due = addDays(birth, 84);
      upcomingVaccines.push({ key: 'rabies_first', at: due });
      add({
        key: 'rabies_first',
        title: 'Прививка от бешенства',
        why: 'В России — с 3 месяцев, дальше ежегодно. Нужна для поездок и выставок. ' + vet,
        emoji: '💉',
        category: 'vaccines',
        recordType: 'vaccination',
        due,
        until: addDays(due, 30),
      });
    }

    if (age < 182) {
      add({
        key: 'kitten_weigh',
        expires: true,
        title: 'Взвешивать каждые 2 недели',
        why: 'До полугода котёнок быстро растёт: вес показывает, хватает ли еды.',
        emoji: '⚖️',
        category: 'health',
        due: birth,
        until: addDays(birth, 182),
      });
    }
    add({
      key: 'teeth_change',
      expires: true,
      title: 'Смена зубов',
      why: 'С 3 до 7 месяцев молочные зубы меняются. Если растут два ряда — к ветеринару.',
      emoji: '🦷',
      category: 'health',
      due: addDays(birth, 90),
      until: addDays(birth, 210),
    });
    if (!neutered) {
      add({
        key: 'neuter_consult',
        expires: true,
        title: 'Обсудить стерилизацию',
        why: 'Обычно в 5–6 месяцев. Сроки лучше выбрать вместе с ветеринаром.',
        emoji: '🩺',
        category: 'vet',
        recordType: 'visit',
        due: addDays(birth, 150),
        until: addDays(birth, 200),
      });
    }
  }
  if (age >= 300 && age < 420) {
    add({
      key: 'adult_food',
      expires: true,
      title: 'Переход на корм для взрослых',
      why: 'Около года: постепенно, за 7–10 дней, смешивая со старым кормом.',
      emoji: '🥣',
      category: 'feeding',
      due: addDays(birth, 365),
      until: addDays(birth, 395),
    });
  }

  // Deworm 10–14 days before each vaccination (common practice in Russian clinics).
  // One deworming before the nearest vaccination is enough (doses are often given together).
  const nearest = [...upcomingVaccines].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 1);
  for (const v of nearest) {
    if (v.at.getTime() - now.getTime() > 45 * DAY) continue;
    // A vaccination already due: deworm now, vaccinate 10–14 days later.
    const late = v.at.getTime() - now.getTime() < 10 * DAY;
    const at = late ? addDays(now, 14) : v.at;
    if (dewormed(addDays(at, -21), late ? now : at)) continue;
    const from = late ? now : addDays(at, -14);
    add({
      key: `deworm_before_${v.key}`,
      title: 'Глистогонка перед прививкой',
      why: 'За 10–14 дней до вакцинации — обычная практика ветклиник. Препарат и дозу уточните у ветеринара.',
      emoji: '🐛',
      category: 'parasites',
      recordType: 'medication',
      due: from,
      until: late ? addDays(now, 7) : addDays(at, -7),
    });
  }

  // Deworming before a vaccination also covers the kitten's first one.
  if (tips.some((t) => t.key.startsWith('deworm_before_'))) {
    const i = tips.findIndex((t) => t.key === 'kitten_deworm_start');
    if (i >= 0) tips.splice(i, 1);
  }

  // ── adults ─────────────────────────────────────────────────────────────
  const years = age / 365.25;
  const lastOf = (type: HealthRecordType) =>
    history
      .filter((e) => e.type === type)
      .map((e) => new Date(e.date))
      .sort((a, b) => b.getTime() - a.getTime())[0];
  if (years >= 7 && years < 10) {
    const lab = lastOf('lab');
    const due = lab ? addMonths(lab, 12) : now;
    add({
      key: `mature_bloodwork_${due.getUTCFullYear()}`,
      title: 'Осмотр с анализами крови',
      why: 'С 7 лет — раз в год: болезни почек и щитовидки лучше заметить рано. ' + vet,
      emoji: '🧪',
      category: 'vet',
      recordType: 'lab',
      due,
      until: addDays(due, 45),
    });
  }
  if (years >= 10) {
    const visit = lastOf('visit');
    const due = visit ? addMonths(visit, 6) : now;
    add({
      key: `senior_checkup_${due.getUTCFullYear()}_${due.getUTCMonth() < 6 ? 1 : 2}`,
      title: 'Осмотр пожилого кота',
      why: 'После 10 лет — не реже раза в полгода (AAFP) и взвешивание каждый месяц. ' + vet,
      emoji: '🩺',
      category: 'vet',
      recordType: 'visit',
      due,
      until: addDays(due, 30),
    });
  }

  return tips.sort((a, b) => a.due.getTime() - b.due.getTime());
}

const RANK: Record<TipStatus, number> = { overdue: 0, now: 1, soon: 2, later: 3 };

/** Tips worth showing, most pressing first: current ones, plus the next one coming up. */
export function visibleTips(tips: readonly HealthTip[], hidden: ReadonlySet<string> = new Set()) {
  const open = tips.filter((t) => !hidden.has(t.key));
  const current = open
    .filter((t) => t.status !== 'later')
    // Within a status, the one whose window closes first.
    .sort((a, b) => RANK[a.status] - RANK[b.status] || a.until.getTime() - b.until.getTime());
  const next = open.find((t) => t.status === 'later');
  return next ? [...current, next] : current;
}

/** Done chores that count as health events (so a vaccination marked as a chore is known). */
export function healthEventsFromTasks(
  tasks: readonly {
    template_key?: string | null;
    title: string;
    completions: readonly { doneAt: string; kind: string }[];
  }[],
): HealthEvent[] {
  const TYPE: Record<string, HealthRecordType> = {
    vaccine_complex: 'vaccination',
    vaccine_rabies: 'vaccination',
    deworming: 'medication',
    vet_checkup: 'visit',
  };
  const out: HealthEvent[] = [];
  for (const t of tasks) {
    const type = t.template_key ? TYPE[t.template_key] : undefined;
    if (!type) continue;
    for (const c of t.completions)
      if (c.kind === 'done') out.push({ type, date: c.doneAt, title: t.title });
  }
  return out;
}
