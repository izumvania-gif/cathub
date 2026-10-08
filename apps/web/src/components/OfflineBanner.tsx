import { useQueryClient } from '@tanstack/react-query';
import { CloudOff } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { flushOutbox, useOutbox } from '../lib/outbox';
import { errorMessage, toIso } from '../lib/pb';
import { keys } from '../lib/queries';
import type { Completion, Task } from '../lib/types';
import { plural } from '@cathub/core';

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** Shows offline state and sends queued marks when the connection is back. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine);
  const queued = useOutbox();
  const qc = useQueryClient();

  useEffect(() => {
    const flush = async () => {
      const sent = await flushOutbox({
        // Into the cache before it leaves the queue, so the mark never blinks off the board
        // (a fetch already on its way may predate it: cancel it, the final refresh redoes it).
        sent: async (record) => {
          const rec = { ...record, done_at: toIso(record.done_at) };
          const add = (list: Completion[] | undefined) =>
            list && !list.some((c) => c.id === rec.id) ? [...list, rec] : list;
          await qc.cancelQueries({ queryKey: keys.completions });
          qc.setQueriesData<Completion[]>({ queryKey: keys.completions }, add);
          if (rec.kind === 'done' && rec.value > 0) {
            const key = [...keys.measurements, rec.task];
            await qc.cancelQueries({ queryKey: key });
            qc.setQueriesData<Completion[]>({ queryKey: key }, add);
          }
        },
        dropped: (q, err) => {
          const title = qc
            .getQueriesData<Task[]>({ queryKey: keys.tasks })
            .flatMap(([, d]) => d ?? [])
            .find((t) => t.id === q.task)?.title;
          toast.error(`Отметка${title ? ` «${title}»` : ''} не сохранилась: ${errorMessage(err)}`);
        },
      });
      if (sent) {
        await qc.invalidateQueries();
        toast.success(`Отправлено отметок: ${sent}`);
      }
    };
    void flush();
    window.addEventListener('online', flush);
    const id = setInterval(flush, 30_000);
    return () => {
      window.removeEventListener('online', flush);
      clearInterval(id);
    };
  }, [qc]);

  if (online && !queued.length) return null;
  return (
    <div
      role="status"
      className="bg-ink text-paper sticky top-0 z-30 flex items-center gap-2 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] text-sm"
    >
      <CloudOff className="size-4 shrink-0" />
      {online
        ? `Отправляем ${queued.length} ${plural(queued.length, ['отметку', 'отметки', 'отметок'])}…`
        : queued.length
          ? `Нет сети. ${queued.length} ${plural(queued.length, ['отметка', 'отметки', 'отметок'])} отправится, когда появится связь.`
          : 'Нет сети. Показаны сохранённые данные, отметки отправятся позже.'}
    </div>
  );
}
