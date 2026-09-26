import { CATEGORY_LABELS, describeDue, describeSchedule, type TaskCategory } from '@cathub/core';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import { AddSupplySheet, SupplyRow, SupplySheet } from '../components/Supplies';
import { useSupplyForecasts } from '../lib/supplies';
import { Empty, ListSkeleton, PageHeader } from '../components/ui';
import { useBoard } from '../lib/board';

export function Tasks() {
  const { items, now, tz, isLoading } = useBoard();
  const supplies = useSupplyForecasts();
  const [adding, setAdding] = useState(false);
  const [openSupply, setOpenSupply] = useState<string | null>(null);
  const selected = supplies.list.find((x) => x.supply.id === openSupply) ?? null;
  const byCategory = new Map<TaskCategory, typeof items>();
  for (const i of [...items].sort((a, b) => a.task.sort - b.task.sort)) {
    const list = byCategory.get(i.task.category) ?? [];
    list.push(i);
    byCategory.set(i.task.category, list);
  }
  return (
    <main className="mx-auto max-w-lg px-4 pb-28">
      <PageHeader
        title="Дела"
        action={
          <Link
            href="/tasks/new"
            className="bg-ink text-paper shadow-card hover:bg-ink/90 flex min-h-10 items-center gap-1.5 rounded-2xl px-4 text-sm font-semibold transition-[transform,background-color] active:scale-[0.97]"
          >
            <Plus className="size-4" strokeWidth={3} /> Новое
          </Link>
        }
      />
      <section className="mb-6">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-ink-soft text-sm font-semibold">Запасы</h2>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-ink-soft text-sm underline underline-offset-4"
          >
            Добавить
          </button>
        </div>
        {supplies.list.length ? (
          <ul className="bg-card divide-line divide-y overflow-hidden rounded-3xl shadow-card">
            {supplies.list.map(({ supply, f }) => (
              <li key={supply.id}>
                <SupplyRow supply={supply} f={f} onOpen={() => setOpenSupply(supply.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="bg-card text-ink-soft w-full rounded-3xl p-4 text-left text-sm shadow-card"
          >
            Следите за кормом и наполнителем: приложение посчитает, на сколько дней хватит, и
            напомнит купить заранее.
          </button>
        )}
      </section>
      <AddSupplySheet open={adding} onClose={() => setAdding(false)} />
      <SupplySheet
        supply={selected?.supply ?? null}
        f={selected?.f ?? null}
        onClose={() => setOpenSupply(null)}
      />
      {isLoading ? <ListSkeleton label="Загружаем дела" /> : null}
      {!isLoading && items.length === 0 ? (
        <Empty title="Дел пока нет">Нажмите «Новое», чтобы добавить.</Empty>
      ) : null}
      {[...byCategory.entries()].map(([cat, list]) => (
        <section key={cat} className="mb-5">
          <h2 className="text-ink-soft mb-2 px-1 text-sm font-semibold">
            {CATEGORY_LABELS[cat] ?? 'Другое'}
          </h2>
          <ul className="bg-card divide-line divide-y overflow-hidden rounded-3xl shadow-card">
            {list.map(({ task, ev }) => (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="hover:bg-tint/60 active:bg-tint flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  <span className="text-xl">{task.emoji || '🐾'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block font-medium leading-snug">
                      {task.title}
                    </span>
                    <span className="text-ink-soft block text-sm">
                      {describeSchedule(task.schedule)}
                    </span>
                  </span>
                  <span className="text-ink-soft max-w-[30%] shrink-0 text-right text-xs leading-tight text-balance">
                    {ev.status === 'done' ? 'сделано' : describeDue(ev, now, tz)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
