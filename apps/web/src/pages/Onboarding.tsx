import { describeSchedule, TASK_TEMPLATES, type OnboardingAnswers } from '@cathub/core';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Button, Field, Input, Segmented, Toggle } from '../components/ui';
import { InviteCard } from './Household';
import { refreshAuth } from '../lib/auth';
import { PENDING_CODE_KEY } from '../lib/invite';
import { DEFAULT_TZ } from '../lib/board';
import { errorMessage, pb, toPbDate } from '../lib/pb';
import { scheduleFromTemplate } from '../lib/templates';
import type { Household, User } from '../lib/types';
import { DEFAULT_LOOK, type Accessory, type CatLook } from '../cat/look';
import { LookEditor } from '../cat/LookEditor';

function detectTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

/** The household the server has for this user (the local auth copy may not know it yet). */
async function serverHousehold() {
  const me = await pb.collection('users').getOne<User>(pb.authStore.record!.id);
  return me.household;
}

/** An invite code as the server compares it (pb_hooks/lib/household.js). */
const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

function ageYears(birth: string) {
  if (!birth) return null;
  return (Date.now() - new Date(birth).getTime()) / (365.25 * 86_400_000);
}

export function Onboarding() {
  const [, navigate] = useLocation();
  const pending = (() => {
    try {
      return localStorage.getItem(PENDING_CODE_KEY) ?? '';
    } catch {
      return '';
    }
  })();
  const [path, setPath] = useState<'create' | 'join'>(pending ? 'join' : 'create');
  const [step, setStep] = useState(0);
  const [code, setCode] = useState(pending);
  const [catName, setCatName] = useState('');
  const [birth, setBirth] = useState('');
  const [look, setLook] = useState<CatLook>(DEFAULT_LOOK);
  // A new household has earned nothing yet.
  const unlocked = new Set<Accessory>();
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    outdoor: false,
    longHair: false,
    clumpingLitter: true,
  });
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(TASK_TEMPLATES.filter((t) => t.recommended).map((t) => t.key)),
  );
  const [lastDone, setLastDone] = useState<Record<string, string>>({});
  const [household, setHousehold] = useState<Household | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fullAnswers = { ...answers, ageYears: ageYears(birth) };

  /** What a «Готово» that failed half-way already created, so a retry carries on from there. */
  const made = useRef<{ household?: Household; cat?: string; tasks: Set<string> }>({
    tasks: new Set(),
  });

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      try {
        await pb.send('/api/cathub/join', { method: 'POST', body: { code } });
      } catch (err) {
        // A retry after the join went through but the answer was lost: already in that family
        // (not in a half-made household of one's own, which also makes the join fail).
        const existing = await serverHousehold().catch(() => '');
        const joined =
          existing &&
          (await pb
            .collection('households')
            .getOne<Household>(existing)
            .then((x) => x.invite_code === normalizeCode(code))
            .catch(() => false));
        if (!joined) throw err;
      }
      try {
        localStorage.removeItem(PENDING_CODE_KEY);
      } catch {
        /* ignore */
      }
      // The join is done; if this refresh fails, the app's start-up refresh picks it up.
      await refreshAuth().catch(() => window.location.reload());
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const tz = detectTz();
      const done = made.current;
      const retry = Boolean(done.household);
      if (!done.household) {
        // A failed earlier try may have created the household already (the server makes the
        // user its owner in the same step): carry on with it instead of a second one.
        const existing = await serverHousehold();
        if (existing) {
          const cats = await pb
            .collection('cats')
            .getList(1, 1, { filter: pb.filter('household = {:h}', { h: existing }) });
          if (cats.items.length) {
            // Not a half-made one: this user is in a household that's set up.
            await refreshAuth();
            navigate('/');
            return;
          }
          done.household = await pb.collection('households').getOne<Household>(existing);
        } else
          done.household = await pb.send<Household>('/api/cathub/household', {
            method: 'POST',
            body: { name: `Дом ${catName.trim()}`, timezone: tz },
          });
      }
      const h = done.household;
      // Access rules read the user's household from the database, so no auth refresh is
      // needed yet; refreshing now would switch the app away from the invite step.
      const cat = {
        name: catName.trim(),
        birth_date: birth ? toPbDate(new Date(`${birth}T12:00:00`)) : '',
        outdoor: answers.outdoor,
        long_hair: answers.longHair,
        appearance: look,
      };
      if (retry) {
        // An earlier try may have saved more than it heard back about (a lost answer): take
        // what the server has instead of making it twice.
        const [cats, tasks] = await Promise.all([
          pb.collection('cats').getList(1, 1, {
            filter: pb.filter('household = {:h}', { h: h.id }),
            sort: 'created',
          }),
          pb.collection('tasks').getFullList<{ template_key: string }>({
            filter: pb.filter('household = {:h}', { h: h.id }),
            fields: 'template_key',
          }),
        ]);
        done.cat ??= cats.items[0]?.id;
        for (const t of tasks) if (t.template_key) done.tasks.add(t.template_key);
      }
      // On a retry the cat may have been edited after «Назад»: save what the form says now.
      if (done.cat) await pb.collection('cats').update(done.cat, cat);
      else done.cat = (await pb.collection('cats').create({ household: h.id, ...cat })).id;
      const templates = TASK_TEMPLATES.filter((t) => picked.has(t.key));
      for (const [i, t] of templates.entries()) {
        if (done.tasks.has(t.key)) continue;
        await pb.collection('tasks').create({
          household: h.id,
          cat: done.cat,
          title: t.title,
          emoji: t.emoji,
          category: t.category,
          assign_mode: 'zone',
          schedule: scheduleFromTemplate(t, fullAnswers, tz, lastDone[t.key]),
          track_value: t.trackValue ?? null,
          template_key: t.key,
          medical: t.medical,
          sort: i,
        });
        done.tasks.add(t.key);
      }
      setHousehold(h);
      setStep(3);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <main className="mx-auto max-w-lg px-5 pb-16 pt-[max(env(safe-area-inset-top),2rem)]">
      {step === 0 ? (
        <>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Начнём</h1>
          <p className="text-ink-soft mt-2">
            Создайте дом для своего кота или присоединитесь к семье по коду.
          </p>
          <div className="mt-6">
            <Segmented
              value={path}
              onChange={setPath}
              options={[
                { value: 'create', label: 'Создать дом' },
                { value: 'join', label: 'У меня есть код' },
              ]}
            />
          </div>
          {path === 'join' ? (
            <div className="mt-6 grid gap-4">
              <Field
                label="Код приглашения"
                hint="Его можно найти во вкладке «Дом» у того, кто уже пользуется приложением."
              >
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABCD2345"
                  autoCapitalize="characters"
                  className="font-display tracking-[0.2em]"
                />
              </Field>
              {error ? <p className="text-tomato-ink text-sm">{error}</p> : null}
              <Button busy={busy} disabled={code.trim().length < 6} onClick={join}>
                Присоединиться
              </Button>
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              <Field label="Как зовут кота">
                <Input
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Барсик"
                />
              </Field>
              <section aria-label="Какой он" className="grid gap-2">
                <span className="text-ink-soft text-sm font-medium">
                  Какой он? Выберите похожего — его можно настроить потом
                </span>
                <LookEditor look={look} onChange={setLook} collapsible unlocked={unlocked} />
              </section>
              <Field label="Дата рождения" hint="Можно примерно. Пожилым котам осмотр нужен чаще.">
                <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
              </Field>
              <div className="bg-card divide-line divide-y rounded-3xl px-4 shadow-card">
                <Toggle
                  label="Гуляет на улице"
                  hint="Тогда от глистов обрабатывают чаще"
                  checked={answers.outdoor}
                  onChange={(v) => setAnswers({ ...answers, outdoor: v })}
                />
                <Toggle
                  label="Длинная шерсть"
                  hint="Вычёсывать каждый день"
                  checked={answers.longHair}
                  onChange={(v) => setAnswers({ ...answers, longHair: v })}
                />
                <Toggle
                  label="Комкующийся наполнитель"
                  hint="Меняется полностью реже"
                  checked={answers.clumpingLitter}
                  onChange={(v) => setAnswers({ ...answers, clumpingLitter: v })}
                />
              </div>
              <Button disabled={!catName.trim()} onClick={() => setStep(1)}>
                Дальше
              </Button>
            </div>
          )}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Что отслеживать</h1>
          <p className="text-ink-soft mt-2">
            Мы подобрали частоты по рекомендациям ветеринарных ассоциаций. Всё можно поменять потом.
          </p>
          <ul className="mt-6 grid gap-2">
            {TASK_TEMPLATES.map((t) => {
              const on = picked.has(t.key);
              return (
                <li key={t.key} className="bg-card rounded-3xl shadow-card">
                  <button
                    type="button"
                    onClick={() => toggle(t.key)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                    aria-pressed={on}
                  >
                    <span className="bg-tint flex size-11 shrink-0 items-center justify-center rounded-2xl text-xl">
                      {t.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.title}</span>
                      <span className="text-ink-soft block text-sm">
                        {describeSchedule(scheduleFromTemplate(t, fullAnswers, DEFAULT_TZ))}
                      </span>
                    </span>
                    <span
                      className={clsx(
                        'flex size-7 shrink-0 items-center justify-center rounded-full border-2',
                        on ? 'bg-ink border-ink text-paper' : 'border-line',
                      )}
                    >
                      {on ? <Check className="size-4" strokeWidth={3} /> : null}
                    </span>
                  </button>
                  {on && t.askLastDone ? (
                    <div className="flex items-center gap-3 px-3 pb-3">
                      <span className="text-ink-soft w-11 shrink-0 text-right text-xs">когда</span>
                      <Input
                        type="date"
                        aria-label={`${t.title}: когда было в последний раз`}
                        className="min-h-10 flex-1 rounded-xl text-sm"
                        value={lastDone[t.key] ?? ''}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setLastDone({ ...lastDone, [t.key]: e.target.value })}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="text-ink-soft mt-3 text-xs">
            Для редких дел укажите, когда это было в последний раз, — тогда срок посчитается
            правильно. Если не помните, дело появится в списке «Сейчас».
          </p>
          {error ? <p className="text-tomato-ink mt-4 text-sm">{error}</p> : null}
          <div className="mt-6 grid gap-2">
            <Button busy={busy} disabled={picked.size === 0} onClick={create}>
              Готово, создать дом
            </Button>
            <Button variant="ghost" onClick={() => setStep(0)}>
              Назад
            </Button>
          </div>
        </>
      ) : null}

      {step === 3 && household ? (
        <>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Позовите семью</h1>
          <p className="text-ink-soft mt-2">
            Отправьте ссылку тем, кто тоже ухаживает за {catName}. Они увидят, кто и когда что
            сделал.
          </p>
          <div className="mt-6">
            <InviteCard code={household.invite_code} />
          </div>
          <Button
            className="mt-6 w-full"
            onClick={async () => {
              await refreshAuth();
              navigate('/');
            }}
          >
            Перейти к делам
          </Button>
        </>
      ) : null}
    </main>
  );
}
