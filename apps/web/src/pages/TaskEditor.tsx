import {
  NOTIFY_LABELS,
  notifyLevel,
  type NotifyLevel,
  ASSIGN_MODE_LABELS,
  assignMode,
  WEEKDAY_SHORT,
  type AssignMode,
  FISH_PER_WEIGHT,
  ON_TIME_BONUS,
  taskWeight,
  WEIGHT_LABELS,
  type Weight,
  CATEGORY_LABELS,
  describeSchedule,
  isTimeOfDay,
  TASK_TEMPLATES,
  type IntervalUnit,
  type Schedule,
  type TaskCategory,
  type TimeOfDay,
} from '@cathub/core';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Link, useLocation } from 'wouter';
import { Button, Field, Input, Segmented, Toggle } from '../components/ui';
import { useUser } from '../lib/auth';
import { useTz } from '../lib/board';
import { errorMessage, pb } from '../lib/pb';
import { keys, useCat, useHousehold, useMembers, useTasks } from '../lib/queries';
import { todayIso } from '../lib/templates';
import type { Task } from '../lib/types';

type Kind = Schedule['kind'];
const UNITS: Array<{ value: IntervalUnit; label: string }> = [
  { value: 'hour', label: 'часов' },
  { value: 'day', label: 'дней' },
  { value: 'week', label: 'недель' },
  { value: 'month', label: 'месяцев' },
  { value: 'year', label: 'лет' },
];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const dateOnly = (iso: string) => (iso ? iso.slice(0, 10) : '');
const pad = (n: number) => String(n).padStart(2, '0');
function localDateTime(iso: string) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Draft {
  title: string;
  emoji: string;
  category: TaskCategory;
  kind: Kind;
  times: string[];
  weekdays: number[];
  every: number;
  unit: IntervalUnit;
  anchor: 'completion' | 'calendar';
  startDate: string; // yyyy-mm-dd
  graceDays: number;
  onceAt: string; // datetime-local
  track: boolean;
  trackLabel: string;
  trackUnit: string;
  medical: boolean;
  notes: string;
  who: AssignMode;
  dutyMap: Record<string, string>;
  assignee: string;
  rotation: string[];
  weight: Weight;
  notify: NotifyLevel;
}

function draftFrom(task: Task | undefined): Draft {
  const s = task?.schedule;
  return {
    title: task?.title ?? '',
    emoji: task?.emoji ?? '🐾',
    category: task?.category ?? 'other',
    kind: s?.kind ?? 'interval',
    times: s?.kind === 'daily_slots' ? s.times : ['09:00'],
    weekdays: s?.kind === 'daily_slots' ? (s.weekdays ?? []) : [],
    every: s?.kind === 'interval' ? s.every : 1,
    unit: s?.kind === 'interval' ? s.unit : 'week',
    anchor: s?.kind === 'interval' ? s.anchor : 'completion',
    startDate:
      s?.kind === 'interval' ? dateOnly(s.startDate) : new Date().toISOString().slice(0, 10),
    graceDays: s?.kind === 'interval' ? (s.graceDays ?? 0) : 0,
    onceAt: localDateTime(s?.kind === 'once' ? s.at : ''),
    track: Boolean(task?.track_value),
    trackLabel: task?.track_value?.label ?? 'Вес',
    trackUnit: task?.track_value?.unit ?? 'кг',
    medical: task?.medical ?? false,
    notes: task?.notes ?? '',
    who: task ? assignMode(task) : 'zone',
    dutyMap: task?.duty_map ?? {},
    assignee: task?.assignee ?? '',
    rotation: task?.rotation ?? [],
    weight: taskWeight(task ?? {}),
    notify: notifyLevel(task ?? {}),
  };
}

function scheduleFrom(d: Draft, tz: string): Schedule | string {
  switch (d.kind) {
    case 'daily_slots': {
      const times = [...new Set(d.times)].sort();
      if (!times.length || !times.every(isTimeOfDay)) return 'Укажите время в формате ЧЧ:ММ.';
      return {
        kind: 'daily_slots',
        times: times as TimeOfDay[],
        ...(d.weekdays.length && d.weekdays.length < 7
          ? { weekdays: [...d.weekdays].sort() as never }
          : {}),
      };
    }
    case 'interval': {
      if (!(d.every >= 1)) return 'Интервал должен быть не меньше 1.';
      const start = d.startDate ? new Date(`${d.startDate}T00:00:00`).toISOString() : todayIso(tz);
      return {
        kind: 'interval',
        every: Math.round(d.every),
        unit: d.unit,
        anchor: d.anchor,
        startDate: start,
        ...(d.graceDays > 0 ? { graceDays: Math.round(d.graceDays) } : {}),
      };
    }
    case 'once':
      if (!d.onceAt) return 'Укажите дату.';
      return { kind: 'once', at: new Date(d.onceAt).toISOString() };
  }
}

export function TaskEditor({ id }: { id: string }) {
  const isNew = id === 'new';
  const tasks = useTasks();
  const task = tasks.data?.find((t) => t.id === id);
  if (!isNew && !task) {
    return tasks.isLoading ? null : (
      <main className="mx-auto max-w-lg px-4 py-10">
        <p>Дело не найдено.</p>
        <Link href="/tasks" className="underline">
          К списку дел
        </Link>
      </main>
    );
  }
  return <Editor key={id} task={task} />;
}

function Editor({ task }: { task?: Task }) {
  const [, navigate] = useLocation();
  const user = useUser();
  const cat = useCat();
  const members = useMembers();
  const household = useHousehold();
  const tz = useTz();
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(() => draftFrom(task));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const preview = scheduleFrom(d, tz);

  const fromTemplate = (key: string) => {
    const t = TASK_TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    const spec = t.schedule({
      outdoor: cat.data?.outdoor ?? false,
      longHair: cat.data?.long_hair ?? false,
      clumpingLitter: true,
    });
    setD({
      ...draftFrom(undefined),
      title: t.title,
      emoji: t.emoji,
      category: t.category,
      kind: spec.kind,
      ...(spec.kind === 'daily_slots'
        ? { times: spec.times }
        : {
            every: spec.every,
            unit: spec.unit,
            anchor: spec.anchor,
            graceDays: spec.graceDays ?? 0,
          }),
      track: Boolean(t.trackValue),
      medical: t.medical,
    });
  };

  const zoneUser = household.data?.duty_zones?.[d.category]?.user ?? '';
  const isMapKey = (k: string) => (d.who === 'weekday' ? /^[1-7]$/.test(k) : d.times.includes(k));

  const save = async () => {
    const schedule = scheduleFrom(d, tz);
    if (typeof schedule === 'string') return toast.error(schedule);
    if (!d.title.trim()) return toast.error('Как называется дело?');
    setBusy(true);
    try {
      const body = {
        title: d.title.trim(),
        emoji: d.emoji.trim() || '🐾',
        category: d.category,
        schedule,
        track_value: d.track
          ? { label: d.trackLabel.trim() || 'Значение', unit: d.trackUnit.trim() }
          : null,
        medical: d.medical,
        notes: d.notes.trim(),
        // Rotation starts with its first person unless the current assignee is already in it.
        assignee:
          d.who === 'one'
            ? d.assignee
            : d.who === 'rotation' && d.rotation.length
              ? d.rotation.includes(d.assignee)
                ? d.assignee
                : d.rotation[0]
              : '',
        rotation: d.who === 'rotation' ? d.rotation : [],
        assign_mode: d.who,
        duty_map:
          d.who === 'weekday' || (d.who === 'slot' && d.kind === 'daily_slots')
            ? Object.fromEntries(Object.entries(d.dutyMap).filter(([k, v]) => v && isMapKey(k)))
            : null,
        weight: d.weight,
        notify: d.notify,
      };
      if (task) await pb.collection('tasks').update(task.id, body);
      else
        await pb.collection('tasks').create({
          ...body,
          household: user!.household,
          cat: cat.data?.id ?? '',
          sort: Date.now() % 1_000_000,
        });
      await qc.invalidateQueries({ queryKey: keys.tasks });
      toast.success(task ? 'Сохранено' : 'Дело добавлено');
      navigate('/tasks');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!task || !confirm('Убрать дело? История отметок сохранится.')) return;
    await pb.collection('tasks').update(task.id, { archived: true });
    await qc.invalidateQueries({ queryKey: keys.tasks });
    navigate('/tasks');
  };

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 pt-[max(env(safe-area-inset-top),1rem)]">
      <header className="flex items-center gap-2 py-2">
        <Link
          href="/tasks"
          aria-label="Назад"
          className="flex size-10 items-center justify-center rounded-full"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-xl font-semibold">{task ? 'Дело' : 'Новое дело'}</h1>
      </header>

      {!task ? (
        <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
          {TASK_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => fromTemplate(t.key)}
              className="bg-card min-h-9 shrink-0 rounded-full px-3 text-sm"
            >
              {t.emoji} {t.title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4">
        <div className="grid grid-cols-[4.5rem_1fr] gap-3">
          <Field label="Значок">
            <Input
              value={d.emoji}
              onChange={(e) => set('emoji', e.target.value)}
              className="text-center text-2xl"
              maxLength={4}
            />
          </Field>
          <Field label="Название">
            <Input
              value={d.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Подстричь когти"
            />
          </Field>
        </div>
        <Field label="Категория">
          <select
            className="bg-card border-line min-h-12 w-full rounded-2xl border px-3"
            value={d.category}
            onChange={(e) => set('category', e.target.value as TaskCategory)}
          >
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <span className="text-ink-soft mb-1.5 block text-sm font-medium">Как часто</span>
          <Segmented
            value={d.kind}
            onChange={(k) => set('kind', k)}
            options={[
              { value: 'daily_slots', label: 'По времени' },
              { value: 'interval', label: 'Интервал' },
              { value: 'once', label: 'Один раз' },
            ]}
          />
        </div>

        {d.kind === 'daily_slots' ? (
          <div className="grid gap-3">
            {d.times.map((t, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  type="time"
                  value={t}
                  onChange={(e) =>
                    set(
                      'times',
                      d.times.map((x, j) => (j === i ? e.target.value : x)),
                    )
                  }
                />
                {d.times.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Убрать время"
                    onClick={() =>
                      set(
                        'times',
                        d.times.filter((_, j) => j !== i),
                      )
                    }
                    className="bg-card flex size-12 shrink-0 items-center justify-center rounded-2xl"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            ))}
            <Button variant="secondary" onClick={() => set('times', [...d.times, '12:00'])}>
              <Plus className="size-4" /> Ещё время
            </Button>
            <div>
              <span className="text-ink-soft mb-1.5 block text-sm font-medium">
                Дни (по умолчанию каждый день)
              </span>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w, i) => {
                  const day = i + 1;
                  const on = d.weekdays.includes(day);
                  return (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          'weekdays',
                          on ? d.weekdays.filter((x) => x !== day) : [...d.weekdays, day],
                        )
                      }
                      className={`min-h-10 rounded-xl text-sm font-semibold ${on ? 'bg-ink text-paper' : 'bg-card text-ink-soft'}`}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {d.kind === 'interval' ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-[1fr_1.4fr] gap-3">
              <Field label="Каждые">
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={d.every}
                  onChange={(e) => set('every', Number(e.target.value))}
                />
              </Field>
              <Field label="&nbsp;">
                <select
                  aria-label="Единица интервала"
                  className="bg-card border-line min-h-12 w-full rounded-2xl border px-3"
                  value={d.unit}
                  onChange={(e) => set('unit', e.target.value as IntervalUnit)}
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div>
              <span className="text-ink-soft mb-1.5 block text-sm font-medium">Считать</span>
              <Segmented
                value={d.anchor}
                onChange={(a) => set('anchor', a)}
                options={[
                  { value: 'completion', label: 'От выполнения' },
                  { value: 'calendar', label: 'По календарю' },
                ]}
              />
              <p className="text-ink-soft mt-1.5 text-xs">
                {d.anchor === 'completion'
                  ? 'Следующий срок — через интервал после того, как сделали. Подходит для когтей, наполнителя, прививок.'
                  : 'Сроки идут по сетке от первой даты, даже если сделали позже. Например, каждое 1-е число.'}
              </p>
            </div>
            <Field
              label={d.anchor === 'calendar' ? 'Первая дата' : 'Первый срок'}
              hint={
                d.anchor === 'completion'
                  ? 'Нужен, пока дело ни разу не отмечали. Дальше срок считается от последнего раза.'
                  : undefined
              }
            >
              <Input
                type="date"
                value={d.startDate}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </Field>
            <Field
              label="Допуск, дней"
              hint="Сколько дней после срока дело ещё не считается просроченным."
            >
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={d.graceDays}
                onChange={(e) => set('graceDays', Number(e.target.value))}
              />
            </Field>
          </div>
        ) : null}

        {d.kind === 'once' ? (
          <Field label="Когда">
            <Input
              type="datetime-local"
              value={d.onceAt}
              onChange={(e) => set('onceAt', e.target.value)}
            />
          </Field>
        ) : null}

        <p className="bg-tint rounded-2xl px-4 py-3 text-sm">
          {typeof preview === 'string' ? preview : `Итого: ${describeSchedule(preview)}`}
        </p>

        <div>
          <span className="text-ink-soft mb-1.5 block text-sm font-medium">Сложность</span>
          <Segmented
            value={String(d.weight) as '1' | '2' | '3'}
            onChange={(v) => set('weight', Number(v) as Weight)}
            options={([1, 2, 3] as const).map((w) => ({
              value: String(w) as '1' | '2' | '3',
              label: WEIGHT_LABELS[w],
            }))}
          />
          <p className="text-ink-soft mt-1.5 text-sm">
            {d.weight * FISH_PER_WEIGHT} 🐟 за отметку, вовремя —{' '}
            {Math.round(d.weight * FISH_PER_WEIGHT * ON_TIME_BONUS)} 🐟
          </p>
        </div>

        <div>
          <label className="grid gap-1.5">
            <span className="text-ink-soft text-sm font-medium">Кто делает</span>
            <select
              className="bg-card border-line min-h-12 w-full rounded-2xl border px-3"
              value={d.who}
              onChange={(e) => set('who', e.target.value as AssignMode)}
            >
              {(Object.keys(ASSIGN_MODE_LABELS) as AssignMode[])
                .filter((m) => m !== 'slot' || d.kind === 'daily_slots' || d.who === 'slot')
                .map((m) => (
                  <option key={m} value={m}>
                    {ASSIGN_MODE_LABELS[m]}
                  </option>
                ))}
            </select>
          </label>
          {d.who === 'zone' ? (
            <p className="text-ink-soft mt-1.5 text-sm">
              «{CATEGORY_LABELS[d.category]}» —{' '}
              {zoneUser
                ? (members.data?.find((m) => m.id === zoneUser)?.name ?? 'кто-то')
                : 'любой'}
              .{' '}
              <Link href="/duties" className="underline underline-offset-4">
                Зоны ответственности
              </Link>
            </p>
          ) : null}
          {d.who === 'weekday' || d.who === 'slot' ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(d.who === 'weekday'
                ? ([1, 2, 3, 4, 5, 6, 7] as const).map(
                    (w) => [String(w), WEEKDAY_SHORT[w]] as const,
                  )
                : d.times.filter(Boolean).map((t) => [t, t] as const)
              ).map(([key, label]) => (
                <label key={key} className="grid grid-cols-[3rem_1fr] items-center gap-2 text-sm">
                  <span className="text-ink-soft">{label}</span>
                  <select
                    aria-label={`Кто делает: ${label}`}
                    className="bg-card border-line min-h-11 w-full min-w-0 rounded-2xl border px-2"
                    value={d.dutyMap[key] ?? ''}
                    onChange={(e) => set('dutyMap', { ...d.dutyMap, [key]: e.target.value })}
                  >
                    <option value="">Любой</option>
                    {(members.data ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.email}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : null}
          {d.who === 'one' ? (
            <select
              aria-label="Ответственный"
              className="bg-card border-line mt-2 min-h-12 w-full rounded-2xl border px-3"
              value={d.assignee}
              onChange={(e) => set('assignee', e.target.value)}
            >
              <option value="">Выберите</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.email}
                </option>
              ))}
            </select>
          ) : null}
          {d.who === 'rotation' ? (
            <div className="mt-2 grid gap-1">
              {(members.data ?? []).map((m) => {
                const pos = d.rotation.indexOf(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={pos >= 0}
                    onClick={() =>
                      set(
                        'rotation',
                        pos >= 0 ? d.rotation.filter((x) => x !== m.id) : [...d.rotation, m.id],
                      )
                    }
                    className="bg-card flex min-h-12 items-center gap-3 rounded-2xl px-4 text-left"
                  >
                    <span
                      className={`flex size-7 items-center justify-center rounded-full text-sm font-bold ${pos >= 0 ? 'bg-ink text-paper' : 'border-line border-2'}`}
                    >
                      {pos >= 0 ? pos + 1 : ''}
                    </span>
                    {m.name || m.email}
                  </button>
                );
              })}
              <p className="text-ink-soft mt-1 text-xs">
                Отметьте людей в порядке очереди. После каждой отметки дело переходит к следующему,
                и напоминание приходит ему лично.
              </p>
            </div>
          ) : (
            <p className="text-ink-soft mt-1.5 text-xs">
              {d.who === 'anyone'
                ? 'Напоминания всем (или в семейный чат), отмечает тот, кто сделал.'
                : 'Напоминание придёт тому, чья очередь; если его нет дома — остальным. Отметить может любой.'}
            </p>
          )}
        </div>

        <label className="grid gap-1.5">
          <span className="text-ink-soft text-sm font-medium">Напоминания в Telegram</span>
          <select
            className="bg-card border-line min-h-12 w-full rounded-2xl border px-3"
            value={d.notify}
            onChange={(e) => set('notify', e.target.value as NotifyLevel)}
          >
            {(Object.keys(NOTIFY_LABELS) as NotifyLevel[]).map((n) => (
              <option key={n} value={n}>
                {NOTIFY_LABELS[n]}
              </option>
            ))}
          </select>
          <span className="text-ink-soft text-xs">
            {d.notify === 'push'
              ? 'Одно сообщение в срок. Если просрочено — дело просто ждёт в приложении, а редкие дела напомнят о себе ещё раз через день, 3 дня и неделю.'
              : d.notify === 'digest'
                ? 'Без отдельных сообщений: дело будет в утренней сводке.'
                : 'Только в приложении.'}
          </span>
        </label>

        <div className="bg-card divide-line divide-y rounded-3xl px-4 shadow-card">
          <Toggle
            label="Записывать значение"
            hint="Например, вес при взвешивании"
            checked={d.track}
            onChange={(v) => set('track', v)}
          />
          <Toggle
            label="Медицинское"
            hint="Покажем подсказку «уточните у ветеринара»"
            checked={d.medical}
            onChange={(v) => set('medical', v)}
          />
        </div>
        {d.track ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Что записываем">
              <Input value={d.trackLabel} onChange={(e) => set('trackLabel', e.target.value)} />
            </Field>
            <Field label="Единица">
              <Input value={d.trackUnit} onChange={(e) => set('trackUnit', e.target.value)} />
            </Field>
          </div>
        ) : null}
        <Field label="Заметка">
          <Input
            value={d.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Препарат, дозировка, клиника…"
          />
        </Field>

        <Button busy={busy} onClick={save}>
          {task ? 'Сохранить' : 'Добавить дело'}
        </Button>
        {task ? (
          <Button variant="danger" onClick={archive}>
            Убрать дело
          </Button>
        ) : null}
      </div>
    </main>
  );
}
