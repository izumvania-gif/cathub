import {
  ACCESSORY_LABELS,
  ACHIEVEMENT_INFO,
  GAME_INFO,
  GAME_ORDER,
  GAME_RULES,
} from '@cathub/core';
import clsx from 'clsx';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { CatSprite } from '../cat/CatScene';
import { useCatLook } from '../lib/catLook';
import { useUser } from '../lib/auth';
import { useAchievements, useGameFishLeft, useGameRecords } from '../lib/games';
import { useMembers } from '../lib/queries';

/** Mini-games: the list with family records, and the achievements (docs/PLAN.md, Phase 7). */
export function Games() {
  const me = useUser();
  const look = useCatLook();
  const records = useGameRecords();
  const achievements = useAchievements();
  const members = useMembers();
  const fish = useGameFishLeft();
  const nameOf = (id: string) => members.data?.find((m) => m.id === id)?.name || 'Кто-то';

  return (
    <main className="mx-auto max-w-lg px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-28">
      <header className="mb-2 flex items-center gap-2">
        <Link href="/room" aria-label="Назад" className="-ml-2 p-2">
          <ArrowLeft />
        </Link>
        <h1 className="font-display text-[1.65rem] font-semibold tracking-tight">Игры</h1>
      </header>
      <p className="text-ink-soft mb-4 px-1 text-sm">
        {fish.left > 0
          ? `Играешь своим котом. Сегодня игры ещё дадут до ${fish.left} 🐟, дальше можно играть на рекорд.`
          : 'Рыбки за игры на сегодня собраны. Можно играть на рекорд, завтра рыбки снова будут.'}
      </p>

      <ul className="grid gap-2">
        {GAME_ORDER.map((g) => {
          const info = GAME_INFO[g];
          const mine = records.data?.find((r) => r.game === g && r.user === me?.id);
          const top = (records.data ?? [])
            .filter((r) => r.game === g)
            .sort((a, b) => b.best - a.best)[0];
          return (
            <li key={g}>
              <Link
                href={`/games/${g}`}
                className="bg-card shadow-card hover:bg-tint/60 flex items-center gap-3 rounded-3xl p-3 transition-colors active:scale-[0.99]"
              >
                <span className="bg-tint flex size-14 shrink-0 items-center justify-center rounded-2xl text-3xl">
                  {info.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{info.title}</span>
                  <span className="text-ink-soft block text-sm">{info.blurb}</span>
                  {mine || top ? (
                    <span className="text-ink-soft mt-0.5 block text-xs tabular-nums">
                      {mine ? `твой рекорд ${mine.best}` : ''}
                      {mine && top && top.user !== me?.id ? ' · ' : ''}
                      {top && top.user !== me?.id
                        ? `лучший в семье: ${nameOf(top.user)}, ${top.best}`
                        : ''}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="text-ink-soft shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>

      <h2 className="text-ink-soft mt-7 mb-2 px-1 text-sm font-semibold">Достижения</h2>
      <p className="text-ink-soft mb-2 px-1 text-sm">
        За каждое достижение разово даются рыбки (сверх дневного лимита), а за самые трудные награды
        для кота, которые не купить в магазине.
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {GAME_RULES.achievements.map((a) => {
          const got = achievements.data?.filter((x) => x.key === a.key) ?? [];
          const info = ACHIEVEMENT_INFO[a.key]!;
          return (
            <li
              key={a.key}
              className={clsx(
                'flex flex-col rounded-3xl p-3 text-sm',
                got.length ? 'bg-card shadow-card' : 'border-line border-2 border-dashed',
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-semibold leading-snug">{info.title}</span>
                <span aria-hidden className="text-lg">
                  {got.length ? '🏅' : '🔒'}
                </span>
              </span>
              <span className="text-ink-soft mt-1 text-xs">{info.how}</span>
              {a.accessory ? (
                <span className="mt-2 flex items-center gap-2 text-xs">
                  <CatSprite
                    look={{ ...look, accessory: a.accessory }}
                    anim="sit"
                    scale={2}
                    label={ACCESSORY_LABELS[a.accessory]}
                  />
                  {ACCESSORY_LABELS[a.accessory]}
                </span>
              ) : (
                <span className="mt-2 text-xs font-semibold">+{a.fish} 🐟</span>
              )}
              {got.length ? (
                <span className="text-mint-ink mt-1 text-xs font-semibold">
                  {got.map((x) => nameOf(x.user)).join(', ')}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Link
        href="/home"
        className="text-ink-soft mt-4 block text-center text-sm underline underline-offset-4"
      >
        Надеть награду коту: «Дом» → «Внешность»
      </Link>
    </main>
  );
}
