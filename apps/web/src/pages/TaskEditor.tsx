import {
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
import { keys, useCat, useTasks } from '../lib/queries';
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

        <div className="bg-card divide-line divide-y rounded-3xl px-4">
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
