import {
  assigneeFor,
  CATEGORY_LABELS,
  localDate,
  localDayBounds,
  occurrences,
  taskWeight,
  WEEKDAY_SHORT,
  type DutyZone,
  type DutyZones,
  type TaskCategory,
} from '@cathub/core';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { Button, Field, Input } from '../components/ui';
import { useUser } from '../lib/auth';
import { useBoard, useDutyContext } from '../lib/board';
import { useDutyActions } from '../lib/duties';
import { errorMessage } from '../lib/pb';
import { useAbsences, useHousehold, useMembers } from '../lib/queries';
import type { User } from '../lib/types';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const ORDER: TaskCategory[] = [
  'feeding',
  'litter',
  'grooming',
  'parasites',
  'vaccines',
  'vet',
  'health',
  'supplies',
  'other',
];

function PersonSelect({
  label,
  value,
  members,
  onChange,
  empty = 'Любой',
}: {
  label: string;
  value: string;
  members: User[];
  onChange: (v: string) => void;
  empty?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-card border-line min-h-11 w-full min-w-0 rounded-2xl border px-3"
    >
      <option value="">{empty}</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name || m.email}
        </option>
      ))}
    </select>
  );
}

function ZoneRow({
  category,
  zone,
  members,
  onChange,
}: {
  category: TaskCategory;
  zone: DutyZone | undefined;
  members: User[];
  onChange: (z: DutyZone | undefined) => void;
}) {
  const [open, setOpen] = useState(Boolean(zone?.weekdays && Object.keys(zone.weekdays).length));
  const label = CATEGORY_LABELS[category];
  const set = (user: string, weekdays = zone?.weekdays) =>
    onChange(user || (weekdays && Object.keys(weekdays).length) ? { user, weekdays } : undefined);
  return (
    <li className="px-4 py-3">
      <div className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
        <span className="font-medium">{label}</span>
        <PersonSelect
          label={`${label}: кто отвечает`}
          value={zone?.user ?? ''}
          members={members}
          onChange={(v) => set(v)}
        />
      </div>
      {open ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {WEEKDAYS.map((d) => (
            <label key={d} className="grid grid-cols-[2rem_1fr] items-center gap-2 text-sm">
              <span className="text-ink-soft">{WEEKDAY_SHORT[d]}</span>
              <PersonSelect
                label={`${label}, ${WEEKDAY_SHORT[d]}`}
                value={zone?.weekdays?.[d] ?? ''}
                members={members}
                empty="как обычно"
                onChange={(v) => {
                  const weekdays = { ...zone?.weekdays };
                  if (v) weekdays[d] = v;
                  else delete weekdays[d];
                  set(zone?.user ?? '', weekdays);
                }}
              />
            </label>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-ink-soft mt-1 text-sm underline underline-offset-4"
        >
          По дням недели по-разному
        </button>
      )}
    </li>
  );
}

/** The next 7 days: who has what, plus the load (task weights) per person. */
function Week({ members }: { members: User[] }) {
  const { items, now, tz } = useBoard();
  const ctx = useDutyContext();
  const nameOf = (id: string | null) =>
    id ? (members.find((m) => m.id === id)?.name ?? 'Кто-то') : 'Любой';
  const days = Array.from({ length: 7 }, (_, i) =>
    localDate(new Date(now.getTime() + i * 86_400_000), tz),
  );
  const load = new Map<string | null, number>();
  const rows = days.map((date) => {
    const [start, end] = localDayBounds(date, tz);
    const byPerson = new Map<string | null, string[]>();
    for (const { task, ev } of items) {
      const occ =
        task.schedule.kind === 'daily_slots'
          ? occurrences(task.schedule, [], start, new Date(end.getTime() - 1), { now, tz })
          : ev.due && ev.due >= start && ev.due < end
            ? [ev.due]
            : [];
      for (const o of occ) {
        const who = assigneeFor(task, o, ctx).user;
        byPerson.set(who, [...(byPerson.get(who) ?? []), task.emoji || '🐾']);
        load.set(who, (load.get(who) ?? 0) + taskWeight(task));
      }
    }
    return { date, start, byPerson };
  });
  const dayFmt = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    timeZone: tz,
  });
  return (
    <section className="bg-card mt-3 rounded-3xl p-4 shadow-card">
      <p className="text-ink-soft text-sm">
        Нагрузка за неделю (лёгкое дело — 1, тяжёлое — 3):{' '}
        {[...load.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id, n]) => `${nameOf(id)} ${n}`)
          .join(' · ') || 'дел нет'}
      </p>
      <ul className="divide-line mt-2 divide-y">
        {rows.map((r) => (
          <li key={r.date} className="grid grid-cols-[3.5rem_1fr] gap-2 py-2 text-sm">
            <span className="text-ink-soft first-letter:uppercase">{dayFmt.format(r.start)}</span>
            <span className="grid gap-0.5">
              {[...r.byPerson.entries()].map(([id, emojis]) => (
                <span key={id ?? 'any'}>
                  <b className="font-medium">{nameOf(id)}:</b> {emojis.join(' ')}
                </span>
              ))}
              {!r.byPerson.size ? <span className="text-ink-soft">—</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Away({ members }: { members: User[] }) {
  const me = useUser();
  const absences = useAbsences();
  const actions = useDutyActions();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(
      new Date(`${d}T12:00:00`),
    );
  const add = async () => {
    if (!from || !to || to < from) return toast.error('Укажите даты: с какого по какое');
    setBusy(true);
    try {
      await actions.addAbsence(from, to);
      setFrom('');
      setTo('');
      toast.success('Пока вас нет, ваши дела достанутся остальным');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="bg-card mt-3 rounded-3xl p-4 shadow-card">
      <p className="text-ink-soft text-sm">
        На эти дни ваши дела станут «для любого», и напоминания уйдут остальным.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="С">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="По">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <Button className="mt-3 w-full" variant="secondary" busy={busy} onClick={add}>
        Меня не будет дома
      </Button>
      {absences.data?.length ? (
        <ul className="mt-3 grid gap-2 text-sm">
          {absences.data.map((a) => {
            const name = members.find((m) => m.id === a.user)?.name ?? 'Кто-то';
            const mine = a.user === me?.id || me?.role === 'owner';
            return (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span>
                  {name} в отъезде с {fmt(a.from)} по {fmt(a.to)}
                </span>
                {mine ? (
                  <button
                    type="button"
                    onClick={() => void actions.removeAbsence(a.id).catch(() => {})}
                    className="text-tomato-ink text-sm font-medium"
                    aria-label={`Убрать отъезд: ${name}, с ${fmt(a.from)} по ${fmt(a.to)}`}
                  >
                    Убрать
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

export function Duties() {
  const household = useHousehold();
  const members = useMembers();
  const actions = useDutyActions();
  const zones: DutyZones = household.data?.duty_zones ?? {};
  const list = members.data ?? [];

  const change = async (category: TaskCategory, zone: DutyZone | undefined) => {
    const next = { ...zones };
    if (zone) next[category] = zone;
    else delete next[category];
    try {
      await actions.saveZones(next);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-28">
      <header className="mb-4 flex items-center gap-2">
        <Link href="/home" aria-label="Назад" className="-ml-2 p-2">
          <ArrowLeft />
        </Link>
        <h1 className="font-display text-[1.65rem] font-semibold tracking-tight">Обязанности</h1>
      </header>

      <h2 className="text-ink-soft mb-2 px-1 text-sm font-semibold">Кто за что отвечает</h2>
      <p className="text-ink-soft mb-2 px-1 text-sm">
        Дела в режиме «По зоне» берут человека отсюда. У любого дела можно выбрать своё в редакторе.
      </p>
      <ul className="bg-card divide-line divide-y overflow-hidden rounded-3xl shadow-card">
        {ORDER.map((c) => (
          <ZoneRow
            key={c}
            category={c}
            zone={zones[c]}
            members={list}
            onChange={(z) => void change(c, z)}
          />
        ))}
      </ul>

      <h2 className="text-ink-soft mt-6 mb-0 px-1 text-sm font-semibold">Неделя</h2>
      <Week members={list} />

      <h2 className="text-ink-soft mt-6 mb-0 px-1 text-sm font-semibold">Меня нет дома</h2>
      <Away members={list} />
    </main>
  );
}
