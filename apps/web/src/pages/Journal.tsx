import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Sheet } from '../components/Sheet';
import { Avatar, Button, Empty, PageHeader } from '../components/ui';
import { useTaskActions } from '../lib/actions';
import { useNow, useTz } from '../lib/board';
import { errorMessage } from '../lib/pb';
import { useCompletions, useMembers, useTasks } from '../lib/queries';
import type { Completion } from '../lib/types';

export function Journal() {
  const completions = useCompletions();
  const tasks = useTasks();
  const members = useMembers();
  const tz = useTz();
  const now = useNow(60_000);
  const { undo } = useTaskActions();
  const [who, setWho] = useState<string>('all');
  const [selected, setSelected] = useState<Completion | null>(null);

  const taskById = useMemo(() => new Map((tasks.data ?? []).map((t) => [t.id, t])), [tasks.data]);
  const groups = useMemo(() => {
    const dayFmt = new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: tz,
    });
    const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    const today = keyFmt.format(now);
    const yesterday = keyFmt.format(new Date(now.getTime() - 86_400_000));
    const list = (completions.data ?? [])
      .filter((c) => who === 'all' || c.user === who)
      .sort((a, b) => b.done_at.localeCompare(a.done_at));
    const out: Array<{ key: string; label: string; items: Completion[] }> = [];
    for (const c of list) {
      const key = keyFmt.format(new Date(c.done_at));
      const label =
        key === today
          ? 'Сегодня'
          : key === yesterday
            ? 'Вчера'
            : dayFmt.format(new Date(c.done_at));
      const g = out.at(-1);
      if (g && g.key === key) g.items.push(c);
      else out.push({ key, label, items: [c] });
    }
    return out;
  }, [completions.data, who, tz, now]);

  const time = (iso: string) =>
    new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(
      new Date(iso),
    );

  const chip = (id: string, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setWho(id)}
      className={clsx(
        'min-h-9 shrink-0 rounded-full px-4 text-sm font-semibold',
        who === id ? 'bg-ink text-paper' : 'bg-card text-ink-soft',
      )}
    >
      {label}
    </button>
  );

  return (
    <main className="mx-auto max-w-lg px-4 pb-28">
      <PageHeader title="Журнал" />
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {chip('all', 'Все')}
        {(members.data ?? []).map((m) => chip(m.id, m.name || m.email))}
      </div>

      {groups.length === 0 ? (
        <Empty title="Записей пока нет">Отмеченные дела появятся здесь.</Empty>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mb-5">
            <h2 className="text-ink-soft mb-2 px-1 text-sm font-semibold first-letter:uppercase">
              {g.label}
            </h2>
            <ul className="bg-card divide-line divide-y rounded-3xl">
              {g.items.map((c) => {
                const t = taskById.get(c.task);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(c)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className="text-xl">{t?.emoji ?? '🐾'}</span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={clsx(
                            'block truncate font-medium',
                            c.kind === 'skipped' && 'text-ink-soft',
                          )}
                        >
                          {t?.title ?? 'Удалённое дело'}
                          {c.kind === 'skipped' ? ' — пропуск' : ''}
                          {c.value ? ` — ${c.value} ${t?.track_value?.unit ?? ''}` : ''}
                        </span>
                        {c.note ? (
                          <span className="text-ink-soft block truncate text-sm">{c.note}</span>
                        ) : null}
                      </span>
                      <span className="text-ink-soft flex items-center gap-2 text-sm tabular-nums">
                        <Avatar name={c.expand?.user?.name} />
                        {time(c.done_at)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title="Запись">
        {selected ? (
          <div className="grid gap-3">
            <p>
              {taskById.get(selected.task)?.title ?? 'Удалённое дело'}
              <br />
              <span className="text-ink-soft text-sm">
                {selected.expand?.user?.name ?? 'Кто-то'},{' '}
                {new Intl.DateTimeFormat('ru-RU', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                  timeZone: tz,
                }).format(new Date(selected.done_at))}
              </span>
            </p>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await undo(selected.id);
                  toast('Запись удалена');
                  setSelected(null);
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              Удалить запись
            </Button>
          </div>
        ) : null}
      </Sheet>
    </main>
  );
}
