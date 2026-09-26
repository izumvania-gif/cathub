import { motion } from 'motion/react';
import type { Completion, User } from '../lib/types';

/**
 * "Who did how much" over the last 30 days: one horizontal bar per member (single measure →
 * one validated data color; identity comes from the name labels, never color alone), sorted,
 * with direct value labels and a hidden table for screen readers.
 */
export function StatsCard({
  completions,
  members,
  now,
}: {
  completions: Completion[];
  members: User[];
  now: Date;
}) {
  const since = now.getTime() - 30 * 86_400_000;
  const counts = new Map<string, number>();
  for (const c of completions) {
    if (c.kind !== 'done' || Date.parse(c.done_at) < since) continue;
    counts.set(c.user, (counts.get(c.user) ?? 0) + 1);
  }
  const rows = members
    .map((m) => ({ id: m.id, name: m.name || m.email, n: counts.get(m.id) ?? 0 }))
    .sort((a, b) => b.n - a.n);
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (members.length < 2 || total === 0) return null;
  const max = Math.max(...rows.map((r) => r.n));

  return (
    <section className="bg-card shadow-card mb-5 rounded-3xl p-4">
      <h2 className="font-medium">Кто сколько сделал</h2>
      <p className="text-ink-soft text-sm">за 30 дней · всего {total}</p>
      <ul className="mt-3 grid gap-2.5" aria-hidden>
        {rows.map((r, i) => (
          <li key={r.id} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-sm">
            <span className="truncate">{r.name}</span>
            <span className="bg-line/50 h-2.5 overflow-hidden rounded-full">
              <motion.span
                className="bg-data block h-full origin-left rounded-full"
                style={{ width: `${(r.n / max) * 100}%` }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, delay: i * 0.06 }}
              />
            </span>
            <span className="text-ink-soft tabular-nums">
              {r.n} · {Math.round((r.n / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>Выполненные дела за 30 дней по участникам</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.name}</th>
              <td>{r.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
