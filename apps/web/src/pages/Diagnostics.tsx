import type { RecordModel } from 'pocketbase';
import { useEffect, useState } from 'react';
import { pb } from '../lib/pb';

type Heartbeat = RecordModel & {
  telegram_ok: boolean;
  telegram_ms: number;
  telegram_error: string;
  bot_version: string;
  bot_username: string;
  uptime_s: number;
  created: string;
};

type Health = 'checking' | 'ok' | 'error';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const ago = (now: number, t?: number) =>
  t === undefined ? '—' : `${Math.max(0, Math.round((now - t) / 1000))} с назад`;

/**
 * Stage-0 checks from docs/DEPLOY_AMVERA.md §2: PocketBase health, realtime (SSE) through the
 * hosting ingress, and the bot's Telegram probe. Leave the page open on a phone over mobile data:
 * a new heartbeat should arrive every minute without reloading.
 */
export function Diagnostics() {
  const now = useNow();
  const [health, setHealth] = useState<Health>('checking');
  const [connectedAt, setConnectedAt] = useState<number>();
  const [reconnects, setReconnects] = useState(0);
  const [lastEventAt, setLastEventAt] = useState<number>();
  const [beats, setBeats] = useState<Heartbeat[]>([]);

  useEffect(() => {
    pb.health
      .check()
      .then(() => setHealth('ok'))
      .catch(() => setHealth('error'));

    pb.collection('diagnostics')
      .getList<Heartbeat>(1, 10, { sort: '-created' })
      .then((res) => setBeats(res.items))
      .catch(() => {});

    let connects = 0;
    const unsubs: Array<Promise<() => Promise<void>>> = [
      pb.realtime.subscribe('PB_CONNECT', () => {
        connects += 1;
        setConnectedAt(Date.now());
        setReconnects(Math.max(0, connects - 1));
      }),
      pb.collection('diagnostics').subscribe<Heartbeat>('*', (e) => {
        if (e.action !== 'create') return;
        setLastEventAt(Date.now());
        setBeats((prev) => [e.record, ...prev].slice(0, 10));
      }),
    ];
    return () => {
      for (const u of unsubs) void u.then((fn) => fn());
    };
  }, []);

  const last = beats[0];

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <a href="/" className="text-muted text-sm">
        ← Назад
      </a>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Диагностика</h1>

      <div className="mt-6 space-y-3">
        <Row label="PocketBase" ok={health === 'ok'} pending={health === 'checking'}>
          {health === 'checking' ? 'проверяю…' : health === 'ok' ? 'работает' : 'недоступен'}
        </Row>
        <Row
          label="Realtime (SSE)"
          ok={connectedAt !== undefined}
          pending={connectedAt === undefined}
        >
          {connectedAt ? `подключено ${ago(now, connectedAt)}` : 'подключаюсь…'}
          <br />
          переподключений: {reconnects}, последнее событие: {ago(now, lastEventAt)}
        </Row>
        <Row label="Бот → Telegram" ok={Boolean(last?.telegram_ok)} pending={!last}>
          {last
            ? last.telegram_ok
              ? `ok, ${last.telegram_ms} мс${last.bot_username ? ` · @${last.bot_username}` : ''}`
              : `ошибка: ${last.telegram_error || 'нет ответа'}`
            : 'нет данных от бота'}
          {last && (
            <>
              <br />
              версия {last.bot_version}, аптайм {last.uptime_s} с
            </>
          )}
        </Row>
      </div>

      <h2 className="text-muted mt-8 text-sm font-semibold uppercase">Последние heartbeat</h2>
      <ul className="mt-2 divide-y divide-black/5 rounded-2xl bg-white text-sm ring-1 ring-black/5">
        {beats.map((b) => (
          <li key={b.id} className="flex justify-between px-4 py-2">
            <span>{new Date(b.created).toLocaleTimeString('ru-RU')}</span>
            <span className={b.telegram_ok ? 'text-mint-ink' : 'text-tomato-ink'}>
              {b.telegram_ok ? `TG ${b.telegram_ms} мс` : 'TG ✕'}
            </span>
          </li>
        ))}
        {beats.length === 0 && <li className="text-muted px-4 py-3">пока пусто</li>}
      </ul>
    </main>
  );
}

function Row(props: { label: string; ok: boolean; pending: boolean; children: React.ReactNode }) {
  const color = props.pending ? 'bg-amber' : props.ok ? 'bg-mint' : 'bg-tomato';
  return (
    <div className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${color}`} />
      <div>
        <p className="font-semibold">{props.label}</p>
        <p className="text-muted text-sm">{props.children}</p>
      </div>
    </div>
  );
}
