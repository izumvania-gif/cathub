import { useQueryClient } from '@tanstack/react-query';
import { Copy, RefreshCw, Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { Avatar, Button, Field, Input, PageHeader, Toggle } from '../components/ui';
import { logout, useUser } from '../lib/auth';
import { inviteLink } from '../lib/invite';
import { errorMessage, pb, toIso, toPbDate } from '../lib/pb';
import { keys, useCat, useHousehold, useMembers } from '../lib/queries';
import type { Cat } from '../lib/types';

const TIMEZONES = [
  ['Europe/Kaliningrad', 'Калининград (UTC+2)'],
  ['Europe/Moscow', 'Москва (UTC+3)'],
  ['Europe/Samara', 'Самара (UTC+4)'],
  ['Asia/Yekaterinburg', 'Екатеринбург (UTC+5)'],
  ['Asia/Omsk', 'Омск (UTC+6)'],
  ['Asia/Novosibirsk', 'Новосибирск (UTC+7)'],
  ['Asia/Krasnoyarsk', 'Красноярск (UTC+7)'],
  ['Asia/Irkutsk', 'Иркутск (UTC+8)'],
  ['Asia/Yakutsk', 'Якутск (UTC+9)'],
  ['Asia/Vladivostok', 'Владивосток (UTC+10)'],
  ['Asia/Magadan', 'Магадан (UTC+11)'],
  ['Asia/Kamchatka', 'Камчатка (UTC+12)'],
] as const;

export function InviteCard({ code, onRotate }: { code: string; onRotate?: () => void }) {
  const link = inviteLink(code);
  const share = async () => {
    if (navigator.share) {
      await navigator
        .share({ title: 'CatHub', text: 'Присоединяйся к уходу за котом', url: link })
        .catch(() => {});
    } else {
      await navigator.clipboard.writeText(link);
      toast('Ссылка скопирована');
    }
  };
  return (
    <div className="bg-ink text-paper rounded-3xl p-5">
      <p className="text-paper/70 text-sm">Код приглашения</p>
      <p className="font-display mt-1 text-3xl font-semibold tracking-[0.18em]">{code}</p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={share}
          className="bg-amber text-amber-ink flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl font-semibold"
        >
          <Share2 className="size-4" /> Отправить ссылку
        </button>
        <button
          type="button"
          aria-label="Скопировать код"
          onClick={() => navigator.clipboard.writeText(code).then(() => toast('Код скопирован'))}
          className="bg-paper/10 flex size-11 items-center justify-center rounded-2xl"
        >
          <Copy className="size-4" />
        </button>
        {onRotate ? (
          <button
            type="button"
            aria-label="Выпустить новый код"
            onClick={onRotate}
            className="bg-paper/10 flex size-11 items-center justify-center rounded-2xl"
          >
            <RefreshCw className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CatForm({ cat }: { cat: Cat }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: cat.name,
    birth: cat.birth_date ? toIso(cat.birth_date).slice(0, 10) : '',
    outdoor: cat.outdoor,
    long_hair: cat.long_hair,
    neutered: cat.neutered,
    chip_number: cat.chip_number,
    vet_clinic: cat.vet_clinic,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await pb.collection('cats').update(cat.id, {
        name: form.name.trim(),
        birth_date: form.birth ? toPbDate(new Date(`${form.birth}T12:00:00`)) : '',
        outdoor: form.outdoor,
        long_hair: form.long_hair,
        neutered: form.neutered,
        chip_number: form.chip_number.trim(),
        vet_clinic: form.vet_clinic.trim(),
      });
      await qc.invalidateQueries({ queryKey: keys.cat });
      toast.success('Сохранено');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Field label="Имя">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Дата рождения">
        <Input
          type="date"
          value={form.birth}
          onChange={(e) => setForm({ ...form, birth: e.target.value })}
        />
      </Field>
      <div className="bg-card divide-line divide-y rounded-3xl px-4">
        <Toggle
          label="Гуляет на улице"
          checked={form.outdoor}
          onChange={(v) => setForm({ ...form, outdoor: v })}
        />
        <Toggle
          label="Длинная шерсть"
          checked={form.long_hair}
          onChange={(v) => setForm({ ...form, long_hair: v })}
        />
        <Toggle
          label="Стерилизован(а)"
          checked={form.neutered}
          onChange={(v) => setForm({ ...form, neutered: v })}
        />
      </div>
      <Field label="Номер чипа">
        <Input
          value={form.chip_number}
          onChange={(e) => setForm({ ...form, chip_number: e.target.value })}
          inputMode="numeric"
        />
      </Field>
      <Field label="Клиника и ветеринар">
        <Input
          value={form.vet_clinic}
          onChange={(e) => setForm({ ...form, vet_clinic: e.target.value })}
          placeholder="Название, телефон"
        />
      </Field>
      <Button variant="secondary" busy={busy} onClick={save}>
        Сохранить
      </Button>
    </div>
  );
}

export function Household() {
  const user = useUser();
  const household = useHousehold();
  const members = useMembers();
  const cat = useCat();
  const qc = useQueryClient();
  const isOwner = user?.role === 'owner';

  const rotate = async () => {
    if (!confirm('Старый код и ссылка перестанут работать. Выпустить новый?')) return;
    try {
      await pb.send('/api/cathub/invite', { method: 'POST' });
      await qc.invalidateQueries({ queryKey: keys.household });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const setTz = async (tz: string) => {
    try {
      await pb.collection('households').update(household.data!.id, { timezone: tz });
      await qc.invalidateQueries({ queryKey: keys.household });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 pb-28">
      <PageHeader title={household.data?.name ?? 'Дом'} />

      <h2 className="text-ink-soft mb-2 px-1 text-sm font-semibold">Семья</h2>
      <ul className="bg-card divide-line divide-y rounded-3xl px-4">
        {(members.data ?? []).map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-3">
            <Avatar name={m.name || m.email} className="size-9 text-sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {m.name || m.email}
                {m.id === user?.id ? (
                  <span className="text-ink-soft font-normal"> · вы</span>
                ) : null}
              </span>
              <span className="text-ink-soft text-sm">
                {m.role === 'owner' ? 'создатель дома' : 'участник'}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {household.data?.invite_code ? (
        <div className="mt-3">
          <InviteCard code={household.data.invite_code} onRotate={isOwner ? rotate : undefined} />
        </div>
      ) : null}

      <h2 className="text-ink-soft mb-2 mt-8 px-1 text-sm font-semibold">Кот</h2>
      {cat.data ? <CatForm key={cat.data.id} cat={cat.data} /> : null}

      <h2 className="text-ink-soft mb-2 mt-8 px-1 text-sm font-semibold">Настройки</h2>
      <div className="grid gap-4">
        <Field label="Часовой пояс дома" hint="По нему считаются сроки и время кормления.">
          <select
            className="bg-card border-line min-h-12 w-full rounded-2xl border px-3 disabled:opacity-60"
            value={household.data?.timezone ?? 'Europe/Moscow'}
            disabled={!isOwner}
            onChange={(e) => void setTz(e.target.value)}
          >
            {TIMEZONES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <div className="bg-card rounded-3xl p-4">
          <p className="font-medium">Напоминания в Telegram</p>
          <p className="text-ink-soft mt-1 text-sm">
            Скоро: бот будет напоминать о делах и принимать отметки прямо из чата.
          </p>
        </div>
        <Button variant="danger" onClick={logout}>
          Выйти ({user?.email})
        </Button>
        <Link
          href="/diag"
          className="text-ink-soft text-center text-sm underline underline-offset-4"
        >
          Диагностика сервера
        </Link>
      </div>
    </main>
  );
}
