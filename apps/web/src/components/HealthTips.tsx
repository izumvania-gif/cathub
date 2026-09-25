import type { HealthRecordType, HealthTip } from '@cathub/core';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { useTz } from '../lib/board';
import { useHealthPlan, useTipActions } from '../lib/healthTips';
import { errorMessage } from '../lib/pb';
import { Button } from './ui';

const DAY = 86_400_000;

function whenLabel(tip: HealthTip, now: Date, tz: string) {
  const date = (d: Date) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: tz }).format(d);
  switch (tip.status) {
    case 'overdue':
      return `пора — срок был до ${date(tip.until)}`;
    case 'now':
      return tip.until.getTime() - now.getTime() > 60 * DAY
        ? 'сейчас'
        : `сейчас, до ${date(tip.until)}`;
    case 'soon': {
      const days = Math.max(1, Math.round((tip.due.getTime() - now.getTime()) / DAY));
      return days <= 7 ? `через ${days} дн.` : `с ${date(tip.due)}`;
    }
    case 'later':
      return `дальше: с ${date(tip.due)}`;
  }
}

const STATUS_STYLE: Record<HealthTip['status'], string> = {
  overdue: 'bg-tomato/12 text-tomato-ink',
  now: 'bg-amber/25 text-ink',
  soon: 'bg-tint text-ink',
  later: 'bg-tint text-ink-soft',
};

/**
 * «Сейчас по возрасту»: what's due for a cat of this age (core's healthPlan), with actions to add
 * it to chores, record it as done, or hide it.
 */
export function HealthTips({
  now,
  onRecord,
}: {
  now: Date;
  /** «Уже сделано» for tips that are a health record: open the record form prefilled. */
  onRecord: (type: HealthRecordType, title: string, tip: HealthTip) => void;
}) {
  const { tips } = useHealthPlan();
  const tz = useTz();
  const actions = useTipActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  if (!tips.length) return null;
  const shown = all ? tips : tips.slice(0, 3);

  const run = async (tip: HealthTip, fn: () => Promise<unknown>) => {
    setBusy(tip.key);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-6" aria-labelledby="age-tips">
      <h2 id="age-tips" className="text-ink-soft mb-2 px-1 text-sm font-semibold">
        Сейчас по возрасту
      </h2>
      <ul className="grid gap-2">
        {shown.map((tip) => (
          <li key={tip.key} className="bg-card relative rounded-3xl p-4 pr-12">
            {tip.key !== 'need_birthdate' ? (
              <button
                type="button"
                disabled={busy === tip.key}
                onClick={() => void run(tip, () => actions.dismiss(tip))}
                aria-label={`Скрыть: ${tip.title}`}
                title="Скрыть"
                className="text-ink-soft hover:bg-tint absolute top-2 right-2 flex size-10 items-center justify-center rounded-full"
              >
                <X className="size-4" />
              </button>
            ) : null}
            <div className="flex items-start gap-3">
              <span className="bg-tint flex size-11 shrink-0 items-center justify-center rounded-2xl text-2xl">
                {tip.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{tip.title}</p>
                <span
                  className={clsx(
                    'mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
                    STATUS_STYLE[tip.status],
                  )}
                >
                  {whenLabel(tip, now, tz)}
                </span>
                <p className="text-ink-soft mt-1.5 text-sm">{tip.why}</p>
              </div>
            </div>
            {tip.key === 'need_birthdate' ? (
              <Link
                href="/home"
                className="bg-tint mt-3 flex min-h-11 items-center justify-center rounded-2xl text-sm font-semibold"
              >
                Указать в профиле кота
              </Link>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {tip.status !== 'later' ? (
                  <Button
                    variant="secondary"
                    className="min-h-10 flex-1 px-3 text-sm whitespace-nowrap"
                    busy={busy === tip.key}
                    onClick={() =>
                      void run(tip, async () => {
                        const at = await actions.addToChores(tip, tz, now);
                        toast.success(
                          `В делах на ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: tz }).format(at)}. Дату можно поменять`,
                        );
                      })
                    }
                  >
                    В дела
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  className="min-h-10 flex-1 px-3 text-sm whitespace-nowrap"
                  disabled={busy === tip.key}
                  onClick={() =>
                    tip.recordType
                      ? onRecord(tip.recordType, recordTitle(tip), tip)
                      : void run(tip, () => actions.done(tip))
                  }
                >
                  Уже сделано
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {tips.length > shown.length ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="text-ink-soft mt-2 w-full py-2 text-sm font-medium underline underline-offset-4"
        >
          Показать ещё {tips.length - shown.length}
        </button>
      ) : null}
    </section>
  );
}

/** A record title the plan will recognise (e.g. "глистогонка" for deworming). */
function recordTitle(tip: HealthTip) {
  if (tip.key.startsWith('rabies')) return 'Прививка от бешенства';
  if (tip.category === 'vaccines') return 'Комплексная прививка';
  if (tip.category === 'parasites') return 'Глистогонка';
  return tip.title;
}
