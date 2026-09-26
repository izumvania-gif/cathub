import { describeSupply, formatAmount, SUPPLY_TEMPLATES, type SupplyForecast } from '@cathub/core';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { toast } from 'sonner';
import { useUser } from '../lib/auth';
import { errorMessage, pb, toPbDate } from '../lib/pb';
import { keys } from '../lib/queries';
import type { Supply } from '../lib/types';
import { Sheet } from './Sheet';
import { Button, Field, Input } from './ui';

const num = (v: string) => Number(v.replace(',', '.'));
const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso}T12:00:00Z`),
  );

function statusText(f: SupplyForecast) {
  const base = describeSupply(f);
  return f.runsOutOn && f.status !== 'out' ? `${base} · до ${dayMonth(f.runsOutOn)}` : base;
}

export function SupplyRow({
  supply,
  f,
  onOpen,
}: {
  supply: Supply;
  f: SupplyForecast;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hover:bg-tint/60 active:bg-tint flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
    >
      <span className="text-xl">{supply.emoji || '📦'}</span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block font-medium leading-snug">{supply.name}</span>
        <span
          className={clsx(
            'block text-sm',
            f.status === 'ok'
              ? 'text-ink-soft'
              : f.status === 'low'
                ? 'text-ink font-semibold'
                : 'text-tomato-ink font-semibold',
          )}
        >
          {f.status === 'low' ? '⚠️ ' : ''}
          {describeSupply(f)}
        </span>
        {f.runsOutOn && f.status !== 'out' ? (
          <span className="text-ink-soft block text-xs">до {dayMonth(f.runsOutOn)}</span>
        ) : null}
      </span>
      <span className="text-ink-soft shrink-0 text-sm whitespace-nowrap tabular-nums">
        ≈ {formatAmount(f.remaining, supply.unit)}
      </span>
    </button>
  );
}

/** Buy / recount / edit a supply. */
export function SupplySheet({
  supply,
  f,
  onClose,
}: {
  supply: Supply | null;
  f: SupplyForecast | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'buy' | 'count' | 'edit'>('buy');
  const [amount, setAmount] = useState('');
  const [usage, setUsage] = useState('');
  const [lowDays, setLowDays] = useState('');
  const close = () => {
    setMode('buy');
    setAmount('');
    onClose();
  };
  const save = async (body: Record<string, unknown>, msg: string) => {
    try {
      await pb.collection('supplies').update(supply!.id, body);
      await qc.invalidateQueries({ queryKey: keys.supplies });
      toast.success(msg);
      close();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  if (!supply || !f)
    return (
      <Sheet open={false} onClose={close}>
        {null}
      </Sheet>
    );
  const a = num(amount);
  return (
    <Sheet open onClose={close} title={`${supply.emoji || '📦'} ${supply.name}`}>
      <p className="text-ink-soft -mt-2 mb-4 text-sm">
        Сейчас ≈ {formatAmount(f.remaining, supply.unit)}, {statusText(f)}. Расход{' '}
        {supply.daily_usage.toLocaleString('ru-RU')} {supply.unit} в день.
      </p>
      <div className="bg-tint mb-4 grid grid-cols-3 gap-1 rounded-2xl p-1">
        {(
          [
            ['buy', 'Купили'],
            ['count', 'Остаток'],
            ['edit', 'Расход'],
          ] as const
        ).map(([m, l]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={clsx(
              'min-h-10 rounded-xl text-sm font-semibold',
              m === mode ? 'bg-card shadow-sm' : 'text-ink-soft',
            )}
          >
            {l}
          </button>
        ))}
      </div>
      {mode === 'buy' ? (
        <div className="grid gap-3">
          <Field label={`Сколько купили, ${supply.unit}`}>
            <Input
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="например, 2"
            />
          </Field>
          <Button
            disabled={!(a > 0)}
            onClick={() =>
              save({ stock: f.remaining + a, stock_at: toPbDate(new Date()) }, 'Запас пополнен')
            }
          >
            Добавить к остатку
          </Button>
        </div>
      ) : mode === 'count' ? (
        <div className="grid gap-3">
          <Field
            label={`Сколько осталось сейчас, ${supply.unit}`}
            hint="Если прогноз разошёлся с реальностью — просто укажите остаток."
          >
            <Input
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Button
            disabled={!(a >= 0) || amount.trim() === ''}
            onClick={() => save({ stock: a, stock_at: toPbDate(new Date()) }, 'Остаток обновлён')}
          >
            Сохранить остаток
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          <Field label={`Расход в день, ${supply.unit}`}>
            <Input
              inputMode="decimal"
              value={usage}
              placeholder={String(supply.daily_usage).replace('.', ',')}
              onChange={(e) => setUsage(e.target.value)}
            />
          </Field>
          <Field label="Предупреждать, когда останется на, дней">
            <Input
              inputMode="numeric"
              value={lowDays}
              placeholder={String(supply.low_days)}
              onChange={(e) => setLowDays(e.target.value)}
            />
          </Field>
          <Button
            onClick={() =>
              save(
                {
                  // Re-anchor the stock so the new usage applies from now on.
                  stock: f.remaining,
                  stock_at: toPbDate(new Date()),
                  ...(usage.trim() ? { daily_usage: num(usage) } : {}),
                  ...(lowDays.trim() ? { low_days: Math.round(num(lowDays)) } : {}),
                },
                'Сохранено',
              )
            }
          >
            Сохранить
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!confirm(`Больше не отслеживать «${supply.name}»?`)) return;
              await pb.collection('supplies').delete(supply.id);
              await qc.invalidateQueries({ queryKey: keys.supplies });
              close();
            }}
          >
            Не отслеживать
          </Button>
        </div>
      )}
    </Sheet>
  );
}

export function AddSupplySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useUser();
  const qc = useQueryClient();
  const [tpl, setTpl] = useState(SUPPLY_TEMPLATES[0]!);
  const [name, setName] = useState(tpl.name);
  const [stock, setStock] = useState('');
  const [usage, setUsage] = useState(String(tpl.dailyUsage).replace('.', ','));
  const pick = (key: string) => {
    const t = SUPPLY_TEMPLATES.find((x) => x.key === key)!;
    setTpl(t);
    setName(t.name);
    setUsage(String(t.dailyUsage).replace('.', ','));
  };
  const save = async () => {
    try {
      await pb.collection('supplies').create({
        household: user!.household,
        name: name.trim() || tpl.name,
        emoji: tpl.emoji,
        unit: tpl.unit,
        stock: num(stock),
        stock_at: toPbDate(new Date()),
        daily_usage: num(usage) || 0,
        low_days: tpl.lowDays,
        template_key: tpl.key,
      });
      await qc.invalidateQueries({ queryKey: keys.supplies });
      toast.success('Запас добавлен');
      setStock('');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Отслеживать запас">
      <div className="grid gap-4">
        <div className="flex gap-2">
          {SUPPLY_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={t.key === tpl.key}
              onClick={() => pick(t.key)}
              className={clsx(
                'min-h-10 rounded-full px-3 text-sm font-semibold',
                t.key === tpl.key ? 'bg-ink text-paper' : 'bg-tint text-ink-soft',
              )}
            >
              {t.emoji} {t.name}
            </button>
          ))}
        </div>
        <Field label="Название">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={`Сколько есть сейчас, ${tpl.unit}`}>
          <Input
            inputMode="decimal"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="например, 1,5"
          />
        </Field>
        <Field
          label={`Расход в день, ${tpl.unit}`}
          hint="Примерно. Потом можно поправить — или просто уточнять остаток."
        >
          <Input inputMode="decimal" value={usage} onChange={(e) => setUsage(e.target.value)} />
        </Field>
        <Button disabled={stock.trim() === '' || !(num(stock) >= 0)} onClick={save}>
          Добавить
        </Button>
      </div>
    </Sheet>
  );
}
