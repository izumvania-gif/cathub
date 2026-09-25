import { pb, toIso } from './pb';
import type { Cat, Completion, HealthRecord, Household, Task, User } from './types';

function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Everything of the household as JSON (attachments are listed by name, not embedded). */
export async function exportJson(household: Household) {
  const [cats, members, tasks, completions, health, supplies] = await Promise.all([
    pb.collection('cats').getFullList<Cat>(),
    pb.collection('users').getFullList<User>({ fields: 'id,name,email,role' }),
    pb.collection('tasks').getFullList<Task>(),
    pb.collection('completions').getFullList<Completion>({ sort: 'done_at' }),
    pb.collection('health_records').getFullList<HealthRecord>({ sort: 'date' }),
    pb
      .collection('supplies')
      .getFullList()
      .catch(() => []),
  ]);
  const data = {
    exported_at: new Date().toISOString(),
    household: { id: household.id, name: household.name, timezone: household.timezone },
    members,
    cats,
    tasks,
    completions,
    health_records: health,
    supplies,
  };
  download(`cathub-${stamp()}.json`, 'application/json', JSON.stringify(data, null, 2));
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The journal as CSV (opens in Excel / Google Sheets). */
export async function exportJournalCsv(tz: string) {
  const [tasks, completions, members] = await Promise.all([
    pb.collection('tasks').getFullList<Task>(),
    pb.collection('completions').getFullList<Completion>({ sort: 'done_at' }),
    pb.collection('users').getFullList<User>({ fields: 'id,name' }),
  ]);
  const taskName = new Map(tasks.map((t) => [t.id, t.title]));
  const userName = new Map(members.map((u) => [u.id, u.name]));
  const fmt = new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: tz,
  });
  const rows = [
    ['Дата', 'Дело', 'Кто', 'Тип', 'Значение', 'Заметка'],
    ...completions.map((c) => [
      fmt.format(new Date(toIso(c.done_at))),
      taskName.get(c.task) ?? '',
      userName.get(c.user) ?? '',
      c.kind === 'skipped' ? 'пропуск' : 'сделано',
      c.value || '',
      c.note,
    ]),
  ];
  // BOM so Excel opens UTF-8 Cyrillic correctly; ';' is the Russian Excel separator.
  download(
    `cathub-journal-${stamp()}.csv`,
    'text/csv;charset=utf-8',
    '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n'),
  );
}
