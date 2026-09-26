import {
  GAME_RULES,
  plausible,
  unlockedAccessories,
  type GameAccessory,
  type GameKey,
} from '@cathub/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useUser } from './auth';
import { pb, toPbDate } from './pb';
import { keys } from './queries';
import type { GameAchievementRec, GameRecordRec, GameRunRec } from './types';

export interface FinishResult {
  fish: number;
  capped: boolean;
  left: number;
  best: number;
  record: boolean;
  counted: boolean;
  achievements: Array<{ key: string; fish: number; accessory: GameAccessory | null }>;
}

/** Best score per member per game (the game_records view). */
export function useGameRecords() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.games, 'records', user?.household],
    enabled: Boolean(user?.household),
    queryFn: () => pb.collection('game_records').getFullList<GameRecordRec>(),
  });
}

/** Everyone's achievements in the household. */
export function useAchievements() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.games, 'achievements', user?.household],
    enabled: Boolean(user?.household),
    queryFn: () =>
      pb.collection('game_achievements').getFullList<GameAchievementRec>({ sort: 'created' }),
  });
}

/** Accessories the family has earned (the cat is shared, so anyone's achievement counts). */
export function useUnlockedAccessories(): ReadonlySet<GameAccessory> {
  const list = useAchievements().data;
  return useMemo(() => unlockedAccessories((list ?? []).map((a) => a.key)), [list]);
}

/** Fish I can still get from games in the rolling 24 hours. */
export function useGameFishLeft() {
  const user = useUser();
  const q = useQuery({
    queryKey: [...keys.games, 'today', user?.id],
    enabled: Boolean(user?.id),
    queryFn: () =>
      pb.collection('game_runs').getFullList<GameRunRec>({
        filter: pb.filter('user = {:u} && created > {:since} && fish > 0', {
          u: user!.id,
          since: toPbDate(new Date(Date.now() - 86_400_000)),
        }),
        fields: 'fish',
      }),
  });
  const used = (q.data ?? []).reduce((s, r) => s + r.fish, 0);
  return { left: Math.max(0, GAME_RULES.dailyCap - used), isLoading: q.isLoading };
}

/** Report a finished run; the server prices it and grants achievements. */
export function useFinishGame() {
  const qc = useQueryClient();
  return async (
    game: GameKey,
    stats: Record<string, number>,
    durationMs: number,
  ): Promise<FinishResult> => {
    const clean = Object.fromEntries(
      Object.keys(GAME_RULES.games[game].stats).map((k) => [
        k,
        Math.max(0, Math.round(stats[k] ?? 0)),
      ]),
    );
    if (!plausible(game, clean, durationMs)) throw new Error('Результат не похож на настоящий.');
    const res = await pb.send<FinishResult>('/api/cathub/games/finish', {
      method: 'POST',
      body: { game, stats: clean, durationMs: Math.round(durationMs) },
    });
    await Promise.all([
      qc.invalidateQueries({ queryKey: keys.games }),
      qc.invalidateQueries({ queryKey: keys.fish }),
    ]);
    return res;
  };
}
