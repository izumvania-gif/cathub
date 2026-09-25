import { useQueryClient } from '@tanstack/react-query';
import { CloudOff } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { flushOutbox, useOutbox } from '../lib/outbox';
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
      const sent = await flushOutbox();
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
