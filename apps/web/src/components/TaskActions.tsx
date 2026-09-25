import { describeSchedule, describeWhen } from '@cathub/core';
import { TZDate } from '@date-fns/tz';
import { addDays } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { useTaskActions } from '../lib/actions';
import { useCompleteFlow } from '../lib/completeFlow';
import type { BoardItem } from '../lib/board';
import { errorMessage } from '../lib/pb';
import { Sheet } from './Sheet';
import { Button, Field, Input } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');
/** Value for <input type="datetime-local"> in the device timezone. */
function localInputValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DoubleCheckSheet({
  item,
  now,
  tz,
  onConfirm,
  onClose,
}: {
  item: BoardItem | null;
  now: Date;
  tz: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const who = item?.covered?.expand?.user?.name ?? 'Кто-то';
  return (
    <Sheet open={Boolean(item)} onClose={onClose} title="Уже сделано">
      {item?.covered ? (
        <>
          <p className="text-lg">
            {who} уже {item.task.category === 'feeding' ? 'отметил(а) кормление' : 'отметил(а) это'}{' '}
            {describeWhen(item.covered.done_at, now, tz)}.
          </p>
          <p className="text-ink-soft mt-1">Отметить ещё раз?</p>
          <div className="mt-6 grid gap-2">
            <Button variant="secondary" onClick={onClose}>
              Не отмечать
            </Button>
            <Button variant="ghost" onClick={onConfirm}>
              Отметить ещё раз
            </Button>
          </div>
        </>
      ) : null}
    </Sheet>
  );
}

export function TaskActionsSheet({
  item,
  now,
  tz,
  onClose,
}: {
  item: BoardItem | null;
  now: Date;
  tz: string;
  onClose: () => void;
}) {
  const actions = useTaskActions();
  const flow = useCompleteFlow();
  const [mode, setMode] = useState<'menu' | 'backdate'>('menu');
  const [when, setWhen] = useState(() => localInputValue(new Date()));
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setMode('menu');
    setValue('');
    onClose();
  };
  const task = item?.task;
  const track = task?.track_value;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      close();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const numericValue = value.trim() ? Number(value.replace(',', '.')) : null;
  const tomorrowMorning = () => {
    const d = addDays(new TZDate(now.getTime(), tz), 1);
    return new Date(new TZDate(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0, tz).getTime());
  };

  return (
    <Sheet open={Boolean(item)} onClose={close}>
      {task && item ? (
        <div>
          <div className="flex items-center gap-3">
            <span className="bg-tint flex size-14 items-center justify-center rounded-2xl text-3xl">
              {task.emoji || '🐾'}
            </span>
            <div className="min-w-0">
              <h2 className="font-display truncate text-lg font-semibold">{task.title}</h2>
              <p className="text-ink-soft text-sm">{describeSchedule(task.schedule)}</p>
            </div>
          </div>
          {item.last ? (
            <p className="text-ink-soft mt-3 text-sm">
              Последний раз: {describeWhen(item.last.done_at, now, tz)}
              {item.last.expand?.user?.name ? `, ${item.last.expand.user.name}` : ''}
              {item.last.value ? ` — ${item.last.value} ${track?.unit ?? ''}` : ''}
            </p>
          ) : null}
          {task.medical ? (
            <p className="bg-amber/20 text-ink mt-3 rounded-2xl p-3 text-sm">
              Интервал — ориентир. Уточните у ветеринара или в инструкции препарата.
            </p>
          ) : null}

          {track ? (
            <div className="mt-5">
              <Field label={`${track.label}, ${track.unit}`}>
                <Input
                  inputMode="decimal"
                  placeholder="например, 4,3"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {mode === 'backdate' ? (
            <div className="mt-5 grid gap-3">
              <Field label="Когда сделано">
                <Input
                  type="datetime-local"
                  value={when}
                  max={localInputValue(now)}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </Field>
              <Button
                busy={busy}
                onClick={() =>
                  act(() => flow.run(task, { at: new Date(when), value: numericValue }))
                }
              >
                Сохранить
              </Button>
              <Button variant="ghost" onClick={() => setMode('menu')}>
                Назад
              </Button>
            </div>
          ) : (
            <div className="mt-5 grid gap-2">
              <Button
                busy={busy}
                disabled={track ? numericValue === null || Number.isNaN(numericValue) : false}
                onClick={() => act(() => flow.run(task, { value: numericValue }))}
              >
                {track ? 'Записать' : 'Сделано сейчас'}
              </Button>
              <Button variant="secondary" onClick={() => setMode('backdate')}>
                Сделано раньше…
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    act(async () => {
                      await actions.snooze(task, new Date(now.getTime() + 3_600_000));
                      toast('Отложено на час');
                    })
                  }
                >
                  На час позже
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    act(async () => {
                      await actions.snooze(task, tomorrowMorning());
                      toast('Отложено до завтра, 9:00');
                    })
                  }
                >
                  Завтра утром
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => act(() => flow.run(task, { kind: 'skipped' }))}
              >
                Пропустить этот раз
              </Button>
              <Link
                href={`/tasks/${task.id}`}
                className="text-ink-soft py-2 text-center text-sm underline underline-offset-4"
              >
                Изменить дело
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}
