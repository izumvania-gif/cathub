import { describeWhen, type Evaluation } from '@cathub/core';
import { AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Link } from 'wouter';
import { Bowl } from '../components/Bowl';
import { InstallHint } from '../components/InstallHint';
import { SleepyCat } from '../components/SleepyCat';
import { DoubleCheckSheet, TaskActionsSheet } from '../components/TaskActions';
import { useCompleteFlow } from '../lib/completeFlow';
import { TaskCard } from '../components/TaskCard';
import { Button, Empty } from '../components/ui';
import { useBoard, type BoardItem } from '../lib/board';
import { useCat, useMembers } from '../lib/queries';
import { SupplyRow, SupplySheet } from '../components/Supplies';
import { useSupplyForecasts } from '../lib/supplies';

const WEEK = 7 * 86_400_000;

function FeedingHero({
  item,
  catName,
  now,
  tz,
  onFeed,
}: {
  item: BoardItem;
  catName: string;
  now: Date;
  tz: string;
  onFeed: () => void;
}) {
  const { ev, covered } = item;
  const fed = ev.status === 'done' && covered;
  const level = fed ? Math.max(0.08, 1 - ev.dueness) : 0;
  const next = ev.due
    ? new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(
        ev.due,
      )
    : null;
  return (
    <section className="bg-card flex flex-col items-center rounded-[2rem] px-5 pb-5 pt-6 text-center">
      <Bowl level={level} name={catName} />
      {fed ? (
        <>
          <p className="font-display mt-4 text-xl font-semibold">{catName} сыт</p>
          <p className="text-ink-soft mt-1 text-sm">
            {covered.expand?.user?.name ?? 'Кто-то'} покормил(а){' '}
            {describeWhen(covered.done_at, now, tz)}
            {next ? ` · следующее в ${next}` : ''}
          </p>
        </>
      ) : (
        <>
          <p className="font-display mt-4 text-xl font-semibold">
            {ev.status === 'overdue'
              ? 'Миска пустая'
              : ev.status === 'due'
                ? 'Пора кормить'
                : 'Скоро кормить'}
          </p>
          <p className="text-ink-soft mt-1 text-sm">
            {item.last
              ? `Последний раз ${describeWhen(item.last.done_at, now, tz)}`
              : 'Кормлений пока не было'}
            {next && ev.status !== 'overdue' && ev.status !== 'due' ? ` · в ${next}` : ''}
          </p>
          <Button className="mt-4 w-full" onClick={onFeed}>
            Покормил(а)
          </Button>
        </>
      )}
    </section>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-ink-soft mb-2 flex items-baseline gap-2 px-1 text-sm font-semibold">
        {title}
        {count !== undefined ? <span className="text-ink-soft font-normal">{count}</span> : null}
      </h2>
      <ul className="grid gap-2">
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </ul>
    </section>
  );
}

export function Today() {
  const { items, now, tz, isLoading } = useBoard();
  const cat = useCat();
  const flow = useCompleteFlow();
  const [open, setOpen] = useState<BoardItem | null>(null);
  const supplies = useSupplyForecasts();
  const members = useMembers();
  const nameOf = (id: string) => members.data?.find((m) => m.id === id)?.name;
  const lowSupplies = supplies.list.filter((x) => x.f.status !== 'ok');
  const [openSupply, setOpenSupply] = useState<string | null>(null);
  const selectedSupply = supplies.list.find((x) => x.supply.id === openSupply) ?? null;

  // The bowl shows the feeding task: the template one, else a custom daily feeding task.
  const feeding =
    items.find((i) => i.task.template_key === 'feeding') ??
    items.find(
      (i) =>
        i.task.category === 'feeding' &&
        i.task.schedule.kind === 'daily_slots' &&
        /корм/i.test(i.task.title),
    );
  const rest = items.filter((i) => i !== feeding);
  const is =
    (...s: Evaluation['status'][]) =>
    (i: BoardItem) =>
      s.includes(i.ev.status);
  const now_ = rest.filter(is('overdue', 'due'));
  const soon = rest.filter(is('soon'));
  const done = rest.filter(is('done'));
  const later = rest.filter(
    (i) => i.ev.status === 'upcoming' && i.ev.due && i.ev.due.getTime() - now.getTime() < WEEK,
  );
  // The feeding task counts toward the day's progress too.
  const fedCount = feeding?.ev.status === 'done' ? 1 : 0;
  const doneCount = done.length + fedCount;
  const todayTotal = now_.length + soon.length + doneCount + (feeding && !fedCount ? 1 : 0);

  const card = (i: BoardItem) => (
    <TaskCard
      key={i.task.id}
      item={i}
      now={now}
      tz={tz}
      onComplete={() => flow.request(i)}
      onOpen={() => setOpen(i)}
      assignee={i.task.assignee ? nameOf(i.task.assignee) : undefined}
    />
  );

  const dateLabel = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  }).format(now);

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <header className="mb-4 px-1">
        <p className="text-ink-soft text-sm first-letter:uppercase">{dateLabel}</p>
        <h1 className="font-display text-[1.65rem] font-semibold tracking-tight">
          {todayTotal > 0 ? `Сделано ${doneCount} из ${todayTotal}` : 'Сегодня'}
        </h1>
      </header>

      {isLoading ? (
        <div className="bg-card h-72 animate-pulse rounded-[2rem]" />
      ) : items.length === 0 ? (
        <Empty title="Дел пока нет">
          <Link href="/tasks/new" className="underline underline-offset-4">
            Добавьте первое дело
          </Link>
        </Empty>
      ) : (
        <>
          {feeding ? (
            <FeedingHero
              item={feeding}
              catName={cat.data?.name ?? 'Котик'}
              now={now}
              tz={tz}
              onFeed={() => flow.request(feeding)}
            />
          ) : null}
          {lowSupplies.length ? (
            <section className="mt-6">
              <h2 className="text-ink-soft mb-2 px-1 text-sm font-semibold">Заканчивается</h2>
              <ul className="bg-card divide-line divide-y rounded-3xl">
                {lowSupplies.map(({ supply, f }) => (
                  <li key={supply.id}>
                    <SupplyRow supply={supply} f={f} onOpen={() => setOpenSupply(supply.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {now_.length ? (
            <Section title="Сейчас" count={now_.length}>
              {now_.map(card)}
            </Section>
          ) : null}
          {soon.length ? (
            <Section title="Скоро" count={soon.length}>
              {soon.map(card)}
            </Section>
          ) : null}
          {done.length ? (
            <Section title="Сделано" count={done.length}>
              {done.map(card)}
            </Section>
          ) : null}
          {later.length ? (
            <Section title="На неделе" count={later.length}>
              {later.map(card)}
            </Section>
          ) : null}
          {!now_.length && !soon.length && !later.length ? (
            <div className="mt-8 flex flex-col items-center text-center">
              <SleepyCat />
              <p className="text-ink-soft mt-2 text-sm">
                На ближайшую неделю больше ничего. Отдыхайте.
              </p>
            </div>
          ) : null}
          <InstallHint />
        </>
      )}

      <SupplySheet
        supply={selectedSupply?.supply ?? null}
        f={selectedSupply?.f ?? null}
        onClose={() => setOpenSupply(null)}
      />
      <TaskActionsSheet item={open} now={now} tz={tz} onClose={() => setOpen(null)} />
      <DoubleCheckSheet
        item={flow.confirm}
        now={now}
        tz={tz}
        onClose={() => flow.setConfirm(null)}
        onConfirm={() => {
          const i = flow.confirm;
          flow.setConfirm(null);
          if (i) void flow.run(i.task);
        }}
      />
    </main>
  );
}
