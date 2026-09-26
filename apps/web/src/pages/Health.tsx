import { describeDue, describeSchedule, type HealthTip } from '@cathub/core';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { FileText, Paperclip, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { HealthTips } from '../components/HealthTips';
import { Sheet } from '../components/Sheet';
import { Button, Empty, Field, Input, PageHeader } from '../components/ui';
import { WeightChart } from '../components/WeightChart';
import { useTaskActions } from '../lib/actions';
import { useUser } from '../lib/auth';
import { useBoard, useTz } from '../lib/board';
import { errorMessage, pb, toPbDate } from '../lib/pb';
import { keys, useCat, useHealthRecords, useMeasurements } from '../lib/queries';
import { HEALTH_TYPES, TYPE_CATEGORIES } from '../lib/health';
import { useTipActions } from '../lib/healthTips';
import type { HealthRecord, HealthType, Task } from '../lib/types';

const dateFmt = (tz: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: tz,
  });

function WeightCard() {
  const { items, now, tz } = useBoard();
  const weightItem =
    items.find(
      (i) => i.task.track_value && /вес|взвес/i.test(`${i.task.title} ${i.task.track_value.label}`),
    ) ?? items.find((i) => i.task.track_value);
  const task = weightItem?.task;
  const measurements = useMeasurements(task?.id);
  const actions = useTaskActions();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (!task) {
    return (
      <Empty title="Вес пока не отслеживается">
        <Link href="/tasks/new" className="underline underline-offset-4">
          Добавьте дело «Взвесить»
        </Link>{' '}
        — и здесь появится график.
      </Empty>
    );
  }

  const unit = task.track_value!.unit;
  const pts = (measurements.data ?? []).map((c) => ({
    at: new Date(c.done_at),
    value: c.value,
    who: c.expand?.user?.name,
  }));
  const last = pts.at(-1);
  // Change vs the latest measurement at least ~4 weeks older.
  const monthAgo = last
    ? [...pts].reverse().find((p) => last.at.getTime() - p.at.getTime() >= 25 * 86_400_000)
    : undefined;
  const delta = last && monthAgo ? last.value - monthAgo.value : null;
  const num = value.trim() ? Number(value.replace(',', '.')) : NaN;

  const save = async () => {
    try {
      await actions.complete(task, { value: num });
      toast.success(`Записано: ${num.toLocaleString('ru-RU')} ${unit}`);
      setValue('');
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <section className="bg-card rounded-[2rem] p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-ink-soft text-sm font-semibold">{task.track_value!.label}</h2>
          {last ? (
            <p className="mt-1">
              <span className="font-display text-4xl font-semibold tracking-tight">
                {last.value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
              </span>{' '}
              <span className="text-ink-soft">{unit}</span>
            </p>
          ) : (
            <p className="font-display mt-1 text-xl font-semibold">Ещё нет записей</p>
          )}
          <p className="text-ink-soft mt-1 text-sm">
            {delta !== null
              ? `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${unit} за месяц · `
              : ''}
            {weightItem
              ? weightItem.ev.status === 'done'
                ? 'взвешено сегодня'
                : `следующее ${describeDue(weightItem.ev, now, tz)}`
              : ''}
          </p>
        </div>
        <Button variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" strokeWidth={3} /> Записать
        </Button>
      </div>

      {pts.length >= 2 ? (
        <div className="mt-4">
          <WeightChart points={pts} unit={unit} tz={tz} />
        </div>
      ) : (
        <p className="text-ink-soft mt-4 text-sm">
          {pts.length
            ? 'Ещё одно взвешивание — и появится график.'
            : 'Запишите первый вес, чтобы следить за динамикой.'}
        </p>
      )}

      {pts.length ? (
        <>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-ink-soft mt-3 text-sm underline underline-offset-4"
          >
            {showAll ? 'Скрыть таблицу' : 'Все взвешивания'}
          </button>
          {showAll ? (
            <table className="mt-2 w-full text-sm">
              <thead className="text-ink-soft text-left">
                <tr>
                  <th className="py-1 font-medium">Дата</th>
                  <th className="py-1 text-right font-medium">{task.track_value!.label}</th>
                  <th className="py-1 text-right font-medium">Кто</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {[...pts].reverse().map((p, i) => (
                  <tr key={i}>
                    <td className="py-1.5">{dateFmt(tz).format(p.at)}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {p.value.toLocaleString('ru-RU')} {unit}
                    </td>
                    <td className="text-ink-soft py-1.5 text-right">{p.who ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title={task.track_value!.label}>
        <div className="grid gap-4">
          <Field label={`${task.track_value!.label}, ${unit}`}>
            <Input
              inputMode="decimal"
              autoFocus
              placeholder="например, 4,3"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          <Button disabled={!(num > 0)} onClick={save}>
            Записать
          </Button>
        </div>
      </Sheet>
    </section>
  );
}

function RecordForm({
  onDone,
  initial,
}: {
  onDone: (saved: boolean) => void;
  initial?: { type: HealthType; title: string };
}) {
  const user = useUser()!;
  const cat = useCat();
  const tz = useTz();
  const { items } = useBoard();
  const qc = useQueryClient();
  const actions = useTaskActions();
  const [type, setType] = useState<HealthType>(initial?.type ?? 'vaccination');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()),
  );
  const [clinic, setClinic] = useState('');
  const [batch, setBatch] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const candidates = items
    .map((i) => i.task)
    .filter((t) => t.medical || TYPE_CATEGORIES[type].includes(t.category));
  // Suggest the task a record of this type usually completes (e.g. a vaccination → vaccine task).
  const defaultTaskFor = (t: HealthType) =>
    items.map((i) => i.task).find((x) => TYPE_CATEGORIES[t].includes(x.category))?.id ?? '';
  const [markTask, setMarkTask] = useState<string>(() =>
    defaultTaskFor(initial?.type ?? 'vaccination'),
  );
  const pickType = (t: HealthType) => {
    setType(t);
    setMarkTask(defaultTaskFor(t));
  };

  const save = async () => {
    if (!title.trim()) return toast.error('Как назвать запись?');
    setBusy(true);
    try {
      // Noon of the chosen day, but never in the future: the engine ignores completions
      // from the future, so a record made just after midnight wouldn't count.
      const noon = new Date(`${date}T12:00:00`);
      const at = noon.getTime() > Date.now() ? new Date() : noon;
      await pb.collection('health_records').create({
        household: user.household,
        cat: cat.data?.id ?? '',
        type,
        date: toPbDate(at),
        title: title.trim(),
        clinic: clinic.trim(),
        batch: batch.trim(),
        notes: notes.trim(),
        user: user.id,
        files,
      });
      const task = items.find((i) => i.task.id === markTask)?.task as Task | undefined;
      if (task) await actions.complete(task, { at, note: title.trim() });
      await qc.invalidateQueries({ queryKey: keys.health });
      toast.success(task ? `Сохранено, «${task.title}» отмечено` : 'Сохранено');
      onDone(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {(Object.keys(HEALTH_TYPES) as HealthType[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={t === type}
            onClick={() => pickType(t)}
            className={clsx(
              'min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold',
              t === type ? 'bg-ink text-paper' : 'bg-tint text-ink-soft',
            )}
          >
            {HEALTH_TYPES[t].emoji} {HEALTH_TYPES[t].label}
          </button>
        ))}
      </div>
      <Field label="Название">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={HEALTH_TYPES[type].placeholder}
        />
      </Field>
      <Field label="Дата">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Клиника, врач">
        <Input value={clinic} onChange={(e) => setClinic(e.target.value)} />
      </Field>
      {type === 'vaccination' || type === 'medication' ? (
        <Field label={type === 'vaccination' ? 'Серия вакцины' : 'Дозировка'}>
          <Input value={batch} onChange={(e) => setBatch(e.target.value)} />
        </Field>
      ) : null}
      <Field label="Заметка">
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Что сказал врач, реакция…"
        />
      </Field>
      <label className="bg-tint flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-semibold">
        <Paperclip className="size-4" />
        {files.length ? `Файлов: ${files.length}` : 'Прикрепить фото или PDF (ветпаспорт, анализы)'}
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 10))}
        />
      </label>
      {candidates.length ? (
        <Field
          label="Отметить дело выполненным"
          hint="Срок следующего раза посчитается от даты записи."
        >
          <select
            className="bg-card border-line min-h-12 w-full rounded-2xl border px-3"
            value={markTask}
            onChange={(e) => setMarkTask(e.target.value)}
          >
            <option value="">Не отмечать</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.emoji} {t.title} ({describeSchedule(t.schedule)})
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Button busy={busy} onClick={save}>
        Сохранить запись
      </Button>
    </div>
  );
}

function RecordDetail({ record, onClose }: { record: HealthRecord | null; onClose: () => void }) {
  const tz = useTz();
  const qc = useQueryClient();
  const [fileToken, setFileToken] = useState('');
  useEffect(() => {
    if (record?.files.length)
      pb.files
        .getToken()
        .then(setFileToken)
        .catch(() => {});
  }, [record]);

  const remove = async () => {
    if (!record || !confirm('Удалить запись вместе с файлами?')) return;
    try {
      await pb.collection('health_records').delete(record.id);
      await qc.invalidateQueries({ queryKey: keys.health });
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Sheet open={Boolean(record)} onClose={onClose}>
      {record ? (
        <div className="grid gap-3">
          <div className="flex items-center gap-3">
            <span className="bg-tint flex size-14 items-center justify-center rounded-2xl text-3xl">
              {HEALTH_TYPES[record.type].emoji}
            </span>
            <div className="min-w-0">
              <h2 className="font-display truncate text-lg font-semibold">{record.title}</h2>
              <p className="text-ink-soft text-sm">
                {HEALTH_TYPES[record.type].label} · {dateFmt(tz).format(new Date(record.date))}
              </p>
            </div>
          </div>
          <dl className="grid gap-2 text-sm">
            {record.clinic ? (
              <div>
                <dt className="text-ink-soft">Клиника</dt>
                <dd>{record.clinic}</dd>
              </div>
            ) : null}
            {record.batch ? (
              <div>
                <dt className="text-ink-soft">
                  {record.type === 'vaccination' ? 'Серия' : 'Дозировка'}
                </dt>
                <dd>{record.batch}</dd>
              </div>
            ) : null}
            {record.notes ? (
              <div>
                <dt className="text-ink-soft">Заметка</dt>
                <dd className="whitespace-pre-line">{record.notes}</dd>
              </div>
            ) : null}
            {record.expand?.user?.name ? (
              <div>
                <dt className="text-ink-soft">Добавил(а)</dt>
                <dd>{record.expand.user.name}</dd>
              </div>
            ) : null}
          </dl>
          {record.files.length ? (
            <div className="grid grid-cols-3 gap-2">
              {record.files.map((f) => {
                const isPdf = f.toLowerCase().endsWith('.pdf');
                const url = fileToken ? pb.files.getURL(record, f, { token: fileToken }) : '';
                return (
                  <a
                    key={f}
                    href={url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-tint flex aspect-square items-center justify-center overflow-hidden rounded-2xl"
                  >
                    {isPdf || !fileToken ? (
                      <FileText className="text-ink-soft size-8" />
                    ) : (
                      <img
                        src={pb.files.getURL(record, f, { token: fileToken, thumb: '300x300f' })}
                        alt=""
                        className="size-full object-cover"
                      />
                    )}
                  </a>
                );
              })}
            </div>
          ) : null}
          <Button variant="danger" onClick={remove}>
            Удалить запись
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}

export function Health() {
  const records = useHealthRecords();
  const tz = useTz();
  const { now } = useBoard();
  const tipActions = useTipActions();
  /** false = closed; otherwise the prefill (and the tip it answers, if any). */
  const [adding, setAdding] = useState<
    false | { type?: HealthType; title?: string; tip?: HealthTip }
  >(false);
  const [selected, setSelected] = useState<HealthRecord | null>(null);

  const byYear = useMemo(() => {
    const out = new Map<string, HealthRecord[]>();
    for (const r of records.data ?? []) {
      const y = new Intl.DateTimeFormat('ru-RU', { year: 'numeric', timeZone: tz }).format(
        new Date(r.date),
      );
      out.set(y, [...(out.get(y) ?? []), r]);
    }
    return [...out.entries()];
  }, [records.data, tz]);

  return (
    <main className="mx-auto max-w-lg px-4 pb-28">
      <PageHeader
        title="Здоровье"
        action={
          <button
            type="button"
            onClick={() => setAdding({})}
            className="bg-ink text-paper flex min-h-10 items-center gap-1.5 rounded-2xl px-4 text-sm font-semibold"
          >
            <Plus className="size-4" strokeWidth={3} /> Запись
          </button>
        }
      />
      <HealthTips now={now} onRecord={(type, title, tip) => setAdding({ type, title, tip })} />
      <WeightCard />

      <h2 className="text-ink-soft mb-2 mt-8 px-1 text-sm font-semibold">
        Прививки, визиты, лекарства
      </h2>
      {byYear.length === 0 ? (
        <Empty title="Записей пока нет">
          Сохраняйте прививки и визиты к ветеринару — с фото ветпаспорта и анализов.
        </Empty>
      ) : (
        byYear.map(([year, list]) => (
          <section key={year} className="mb-5">
            <h3 className="text-ink-soft mb-2 px-1 text-xs font-semibold">{year}</h3>
            <ul className="bg-card divide-line divide-y overflow-hidden rounded-3xl shadow-card">
              {list.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="hover:bg-tint/60 active:bg-tint flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
                  >
                    <span className="text-xl">{HEALTH_TYPES[r.type].emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.title}</span>
                      <span className="text-ink-soft block truncate text-sm">
                        {new Intl.DateTimeFormat('ru-RU', {
                          day: 'numeric',
                          month: 'long',
                          timeZone: tz,
                        }).format(new Date(r.date))}
                        {r.clinic ? ` · ${r.clinic}` : ''}
                      </span>
                    </span>
                    {r.files.length ? (
                      <Paperclip
                        className="text-ink-soft size-4 shrink-0"
                        aria-label={`Файлов: ${r.files.length}`}
                      />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Sheet open={Boolean(adding)} onClose={() => setAdding(false)} title="Новая запись">
        {adding ? (
          <RecordForm
            initial={adding.type ? { type: adding.type, title: adding.title ?? '' } : undefined}
            onDone={(saved) => {
              // A record answers the tip; mark it done too (e.g. the sterilization talk).
              if (saved && adding.tip) void tipActions.done(adding.tip).catch(() => {});
              setAdding(false);
            }}
          />
        ) : null}
      </Sheet>
      <RecordDetail record={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
