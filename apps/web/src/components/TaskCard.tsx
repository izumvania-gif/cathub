import { describeDue, describeWhen, type TaskStatus } from '@cathub/core';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import type { BoardItem } from '../lib/board';
import { Avatar } from './ui';

const STATUS_TEXT: Record<TaskStatus, string> = {
  overdue: 'text-tomato',
  due: 'text-amber-ink bg-amber rounded-md px-1.5',
  soon: 'text-ink',
  upcoming: 'text-ink-soft',
  done: 'text-mint',
};

function barColor(status: TaskStatus) {
  if (status === 'overdue') return 'bg-tomato';
  if (status === 'due' || status === 'soon') return 'bg-amber';
  return 'bg-mint';
}

export function TaskCard({
  item,
  now,
  tz,
  onComplete,
  onOpen,
}: {
  item: BoardItem;
  now: Date;
  tz: string;
  onComplete: () => void;
  onOpen: () => void;
}) {
  const { task, ev, last } = item;
  const done = ev.status === 'done';
  const who = last?.expand?.user?.name;
  const width = `${Math.min(1, ev.dueness) * 100}%`;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="bg-card relative overflow-hidden rounded-3xl"
    >
      <div className="flex items-center gap-3 p-3 pr-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`${task.title}: действия`}
        >
          <span className="bg-tint flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl">
            {task.emoji || '🐾'}
          </span>
          <span className="min-w-0">
            <span
              className={clsx(
                'block truncate font-semibold',
                done && 'text-ink-soft line-through decoration-2',
              )}
            >
              {task.title}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-sm">
              <span className={clsx('font-medium', STATUS_TEXT[ev.status])}>
                {ev.snoozed ? 'отложено' : done ? 'сделано' : describeDue(ev, now, tz)}
              </span>
              {last ? (
                <span className="text-ink-soft flex min-w-0 items-center gap-1 truncate">
                  · {who ? <Avatar name={who} className="size-4 text-[0.55rem]" /> : null}
                  {last.kind === 'skipped' ? 'пропуск ' : ''}
                  {describeWhen(last.done_at, now, tz)}
                </span>
              ) : null}
            </span>
          </span>
        </button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={onComplete}
          aria-label={done ? `${task.title}: отметить ещё раз` : `${task.title}: отметить`}
          className={clsx(
            'flex size-12 shrink-0 items-center justify-center rounded-full border-2 transition',
            done ? 'bg-mint border-mint text-white' : 'border-line text-ink-soft hover:border-ink',
          )}
        >
          <Check className="size-6" strokeWidth={3} />
        </motion.button>
      </div>
      <div className="bg-line/60 absolute inset-x-0 bottom-0 h-1">
        <motion.div
          className={clsx('h-full', barColor(ev.status))}
          initial={false}
          animate={{ width }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
      </div>
    </motion.li>
  );
}
