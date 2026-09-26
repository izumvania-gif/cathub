import { describeDue, describeWhen, type TaskStatus } from '@cathub/core';
import clsx from 'clsx';
import { motion } from 'motion/react';
import { useState } from 'react';
import type { BoardItem } from '../lib/board';
import { SNAP } from '../lib/motion';
import { Avatar } from './ui';

/**
 * The check mark in the round button. When a card turns done while on screen the mark draws
 * itself and the button pops; cards that load already done just show it.
 */
function CheckMark({ done }: { done: boolean }) {
  // Derived from the previous render (React's "store the previous prop" pattern).
  const [prev, setPrev] = useState(done);
  const [justDone, setJustDone] = useState(false);
  if (done !== prev) {
    setPrev(done);
    setJustDone(done);
  }
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
      <motion.path
        key={done ? 'done' : 'open'}
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={justDone ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      />
    </svg>
  );
}

const STATUS_TEXT: Record<TaskStatus, string> = {
  overdue: 'text-tomato-ink',
  due: 'text-amber-ink bg-amber rounded-md px-1.5',
  soon: 'text-ink',
  upcoming: 'text-ink-soft',
  done: 'text-mint-ink',
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
  assignee,
}: {
  assignee?: string;
  item: BoardItem;
  now: Date;
  tz: string;
  onComplete: () => void;
  onOpen: () => void;
}) {
  const { task, ev, last } = item;
  const done = ev.status === 'done';
  const who = last?.expand?.user?.name;
  const fill = Math.max(0, Math.min(1, ev.dueness));
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ layout: { type: 'spring', stiffness: 380, damping: 36 } }}
      className="bg-card shadow-card relative overflow-hidden rounded-3xl"
    >
      <div className="flex items-center gap-3 p-3 pr-2">
        <button
          type="button"
          onClick={onOpen}
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left"
          aria-label={`${task.title}: действия`}
        >
          <span className="bg-tint flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl transition-transform duration-200 group-active:scale-95">
            {task.emoji || '🐾'}
          </span>
          <span className="min-w-0">
            <span
              className={clsx(
                'line-clamp-2 block font-semibold leading-snug',
                done && 'text-ink-soft line-through decoration-2',
              )}
            >
              {task.title}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
              <span className={clsx('font-medium whitespace-nowrap', STATUS_TEXT[ev.status])}>
                {ev.snoozed ? 'отложено' : done ? 'сделано' : describeDue(ev, now, tz)}
              </span>
              {assignee && !done ? (
                <span className="text-ink-soft shrink-0">· {assignee}</span>
              ) : null}
              {last && !assignee ? (
                <span className="text-ink-soft flex min-w-0 items-center gap-1 whitespace-nowrap">
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
          animate={done ? { scale: [1, 1.14, 1] } : { scale: 1 }}
          transition={SNAP}
          onClick={onComplete}
          aria-label={done ? `${task.title}: отметить ещё раз` : `${task.title}: отметить`}
          className={clsx(
            'flex size-12 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
            done ? 'bg-mint border-mint text-white' : 'border-line text-ink-soft hover:border-ink',
          )}
        >
          <CheckMark done={done} />
        </motion.button>
      </div>
      <div className="bg-line/60 absolute inset-x-0 bottom-0 h-1">
        <motion.div
          className={clsx('h-full origin-left transition-colors', barColor(ev.status))}
          initial={false}
          animate={{ scaleX: fill }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
      </div>
    </motion.li>
  );
}
