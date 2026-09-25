import { FISH_PER_WEIGHT, PERFECT_DAY_FISH } from '@cathub/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { CatScene } from '../cat/CatScene';
import { ItemThumb } from '../cat/ItemThumb';
import { ITEMS, SHOP_ORDER, STARTER_ITEMS, type ItemKey } from '../cat/room';
import { FishPill } from '../components/FishPill';
import { useRoomKeys } from '../lib/roomItems';
import { Button } from '../components/ui';
import { useBoard } from '../lib/board';
import { catMood, isEvening } from '../lib/catMood';
import { useCatLook } from '../lib/catLook';
import { useFish } from '../lib/fish';
import { errorMessage, pb } from '../lib/pb';
import { keys, useCat, useFishByUser, useMembers, useRoomItems } from '../lib/queries';
import type { RoomItem } from '../lib/types';

export function Room() {
  const qc = useQueryClient();
  const cat = useCat();
  const look = useCatLook();
  const board = useBoard();
  const fish = useFish();
  const room = useRoomItems();
  const byUser = useFishByUser();
  const members = useMembers();
  const items = useRoomKeys();
  const [busy, setBusy] = useState<string | null>(null);
  const owned = new Map((room.data ?? []).map((r) => [r.item, r]));
  const name = cat.data?.name ?? 'Котик';

  const buy = async (key: ItemKey) => {
    setBusy(key);
    try {
      await pb.send('/api/cathub/room/buy', { method: 'POST', body: { item: key } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.room }),
        qc.invalidateQueries({ queryKey: keys.fish }),
      ]);
      toast.success(`${ITEMS[key].label} — теперь в комнате!`);
      navigator.vibrate?.(20);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (r: RoomItem) => {
    setBusy(r.item);
    try {
      await pb.collection('room_items').update(r.id, { placed: !r.placed });
      await qc.invalidateQueries({ queryKey: keys.room });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const leaders = (byUser.data ?? [])
    .map((u) => ({ ...u, name: members.data?.find((m) => m.id === u.id)?.name || 'Кто-то' }))
    .sort((a, b) => b.fish - a.fish);

  return (
    <main className="mx-auto max-w-lg px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-28">
      <header className="mb-4 flex items-center justify-between gap-3 px-1">
        <h1 className="font-display text-[1.65rem] font-semibold tracking-tight">Комната</h1>
        <FishPill balance={fish.balance} className="text-base" />
      </header>

      <section className="bg-card overflow-hidden rounded-[2rem]">
        <CatScene
          look={look}
          mood={catMood(board.items, board.now, board.tz)}
          name={name}
          items={items}
          bowlLevel={0.5}
          night={isEvening(board.now, board.tz)}
        />
        <p className="text-ink-soft px-5 py-4 text-sm">
          Рыбки 🐟 дают за дела: лёгкое — {FISH_PER_WEIGHT}, обычное — {FISH_PER_WEIGHT * 2},
          тяжёлое — {FISH_PER_WEIGHT * 3}. Вовремя — в полтора раза больше. Все ежедневные дела за
          день — ещё +{PERFECT_DAY_FISH}. Рыбки общие на семью, настоящих денег тут нет.
        </p>
      </section>

      <h2 className="text-ink-soft mt-6 mb-2 px-1 text-sm font-semibold">Магазин</h2>
      <ul className="bg-card divide-line divide-y rounded-3xl">
        {SHOP_ORDER.map((key) => {
          const it = ITEMS[key];
          const starter = STARTER_ITEMS.includes(key);
          const rec = owned.get(key);
          const short = it.price - fish.balance;
          return (
            <li key={key} className="flex items-start gap-3 px-4 py-3">
              <div className="bg-tint flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                <ItemThumb item={key} height={56} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="leading-snug font-medium">{it.label}</p>
                <p className="text-ink-soft text-sm leading-snug">Кот {it.does}</p>
                <div className="mt-2">
                  {starter ? (
                    <span className="text-mint-ink text-sm font-medium">Есть</span>
                  ) : rec ? (
                    <button
                      type="button"
                      onClick={() => void toggle(rec)}
                      disabled={busy === key}
                      aria-pressed={rec.placed}
                      aria-label={`${it.label}: ${rec.placed ? 'в комнате' : 'на складе'}`}
                      className="bg-tint aria-pressed:bg-mint/15 aria-pressed:text-mint-ink min-h-10 rounded-full px-3 text-sm font-medium whitespace-nowrap"
                    >
                      {rec.placed ? 'В комнате' : 'На складе'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        className="min-h-10 px-3 text-sm whitespace-nowrap"
                        busy={busy === key}
                        disabled={short > 0 || busy !== null}
                        onClick={() => void buy(key)}
                        aria-label={`Купить: ${it.label} за ${it.price} рыбок`}
                      >
                        {it.price} 🐟
                      </Button>
                      {short > 0 ? (
                        <span className="text-ink-soft text-xs">не хватает {short} 🐟</span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {leaders.length ? (
        <section className="bg-card mt-6 rounded-3xl p-4">
          <h2 className="font-medium">Кто сколько наловил</h2>
          <ul className="mt-2 grid gap-1 text-sm">
            {leaders.map((u) => (
              <li key={u.id} className="flex justify-between">
                <span>{u.name}</span>
                <span className="tabular-nums">{u.fish} 🐟</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
