import { CATEGORY_LABELS, describeDue, describeSchedule, type TaskCategory } from '@cathub/core';
import { Plus } from 'lucide-react';
import { Link } from 'wouter';
import { Empty, PageHeader } from '../components/ui';
import { useBoard } from '../lib/board';

export function Tasks() {
  const { items, now, tz, isLoading } = useBoard();
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
            className="bg-ink text-paper flex min-h-10 items-center gap-1.5 rounded-2xl px-4 text-sm font-semibold"
          >
            <Plus className="size-4" strokeWidth={3} /> Новое
          </Link>
        }
      />
      {!isLoading && items.length === 0 ? (
        <Empty title="Дел пока нет">Нажмите «Новое», чтобы добавить.</Empty>
      ) : null}
      {[...byCategory.entries()].map(([cat, list]) => (
        <section key={cat} className="mb-5">
          <h2 className="text-ink-soft mb-2 px-1 text-sm font-semibold">
            {CATEGORY_LABELS[cat] ?? 'Другое'}
          </h2>
          <ul className="bg-card divide-line divide-y rounded-3xl">
            {list.map(({ task, ev }) => (
              <li key={task.id}>
                <Link href={`/tasks/${task.id}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl">{task.emoji || '🐾'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{task.title}</span>
                    <span className="text-ink-soft block text-sm">
                      {describeSchedule(task.schedule)}
                    </span>
                  </span>
                  <span className="text-ink-soft shrink-0 text-right text-xs">
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
