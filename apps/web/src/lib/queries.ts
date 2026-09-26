import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { pb, toIso } from './pb';
import type {
  AbsenceRec,
  DutyOverrideRec,
  HealthTipRec,
  Cat,
  Completion,
  HealthRecord,
  Household,
  Snooze,
  Supply,
  Task,
  User,
  FishBalance,
  RoomItem,
} from './types';
import { useUser } from './auth';

export const keys = {
  household: ['household'] as const,
  members: ['members'] as const,
  cat: ['cat'] as const,
  tasks: ['tasks'] as const,
  completions: ['completions'] as const,
  snoozes: ['snoozes'] as const,
  health: ['health'] as const,
  measurements: ['measurements'] as const,
  supplies: ['supplies'] as const,
  room: ['room'] as const,
  overrides: ['overrides'] as const,
  absences: ['absences'] as const,
  fish: ['fish'] as const,
  healthTips: ['healthTips'] as const,
  games: ['games'] as const,
};

/** Journal / slot coverage window. Latest completion per task is fetched separately. */
const RECENT_DAYS = 60;

export function useHousehold() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.household, user?.household],
    enabled: Boolean(user?.household),
    queryFn: () => pb.collection('households').getOne<Household>(user!.household),
  });
}

export function useMembers() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.members, user?.household],
    enabled: Boolean(user?.household),
    queryFn: () => pb.collection('users').getFullList<User>({ sort: 'created' }),
  });
}

export function useCat() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.cat, user?.household],
    enabled: Boolean(user?.household),
    queryFn: async () => {
      const list = await pb.collection('cats').getList<Cat>(1, 1, { sort: 'created' });
      return list.items[0] ?? null;
    },
  });
}

export function useTasks() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.tasks, user?.household],
    enabled: Boolean(user?.household),
    queryFn: () =>
      pb
        .collection('tasks')
        .getFullList<Task>({ filter: 'archived = false', sort: 'sort,created' }),
  });
}

/**
 * Recent completions (for the journal and daily slots) merged with the latest completion of
 * every task (rare tasks like a 3-year vaccine may be older than the window).
 */
export function useCompletions() {
  const user = useUser();
  const tasks = useTasks();
  return useQuery({
    queryKey: [...keys.completions, user?.household, tasks.data?.map((t) => t.id).join(',')],
    enabled: Boolean(user?.household) && tasks.isSuccess,
    queryFn: async () => {
      const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString().replace('T', ' ');
      const recent = await pb.collection('completions').getFullList<Completion>({
        filter: pb.filter('done_at >= {:since}', { since }),
        sort: '-done_at',
        expand: 'user',
      });
      const have = new Set(recent.map((c) => c.task));
      const older = await Promise.all(
        (tasks.data ?? [])
          .filter((t) => !have.has(t.id))
          .map((t) =>
            pb
              .collection('completions')
              .getList<Completion>(1, 1, {
                filter: pb.filter('task = {:task}', { task: t.id }),
                sort: '-done_at',
                expand: 'user',
              })
              .then((r) => r.items),
          ),
      );
      return [...recent, ...older.flat()].map((c) => ({ ...c, done_at: toIso(c.done_at) }));
    },
  });
}

export function useSnoozes() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.snoozes, user?.household],
    enabled: Boolean(user?.household),
    queryFn: async () =>
      (await pb.collection('snoozes').getFullList<Snooze>()).map((s) => ({
        ...s,
        until: toIso(s.until),
      })),
  });
}

export function useHealthRecords() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.health, user?.household],
    enabled: Boolean(user?.household),
    queryFn: async () =>
      (
        await pb
          .collection('health_records')
          .getFullList<HealthRecord>({ sort: '-date,-created', expand: 'user' })
      ).map((r) => ({ ...r, date: toIso(r.date) })),
  });
}

/** What the household did with age-based tips (hid, added to chores, done). */
export function useHealthTips() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.healthTips, user?.household],
    enabled: Boolean(user?.household),
    queryFn: () => pb.collection('health_tips').getFullList<HealthTipRec>(),
  });
}

/** All recorded values (e.g. weights) of a task with `track_value`, oldest first. */
export function useMeasurements(taskId: string | undefined) {
  return useQuery({
    queryKey: [...keys.measurements, taskId],
    enabled: Boolean(taskId),
    queryFn: async () =>
      (
        await pb.collection('completions').getFullList<Completion>({
          filter: pb.filter('task = {:t} && kind = "done" && value > 0', { t: taskId }),
          sort: 'done_at',
          expand: 'user',
        })
      ).map((c) => ({ ...c, done_at: toIso(c.done_at) })),
  });
}

export function useSupplies() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.supplies, user?.household],
    enabled: Boolean(user?.household),
    queryFn: async () =>
      (await pb.collection('supplies').getFullList<Supply>({ sort: 'created' })).map((s) => ({
        ...s,
        stock_at: toIso(s.stock_at),
      })),
  });
}

export function useRoomItems() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.room, user?.household],
    enabled: Boolean(user?.household),
    queryFn: () => pb.collection('room_items').getFullList<RoomItem>({ sort: 'created' }),
  });
}

/** Server-side fish balance (a view: fish on completions + bonuses − purchases). */
export function useFishBalance() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.fish, 'balance', user?.household],
    enabled: Boolean(user?.household),
    queryFn: async () => {
      const b = await pb.collection('fish_balance').getOne<FishBalance>(user!.household);
      return (
        b.from_tasks + b.from_bonuses + (b.from_games ?? 0) + (b.from_achievements ?? 0) - b.spent
      );
    },
  });
}

/** Fish earned per member, all time. */
export function useFishByUser() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.fish, 'byUser', user?.household],
    enabled: Boolean(user?.household),
    queryFn: () =>
      pb.collection('fish_by_user').getFullList<{ id: string; household: string; fish: number }>(),
  });
}

/** Hand-overs made in the last 60 days. */
export function useOverrides() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.overrides, user?.household],
    enabled: Boolean(user?.household),
    queryFn: async () => {
      // By creation: a hand-over of an overdue chore can point months back.
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString().replace('T', ' ');
      return (
        await pb.collection('duty_overrides').getFullList<DutyOverrideRec>({
          filter: pb.filter('created >= {:since}', { since }),
        })
      ).map((o) => ({ ...o, occurrence_at: toIso(o.occurrence_at) }));
    },
  });
}

/** Current and future absences. */
export function useAbsences() {
  const user = useUser();
  return useQuery({
    queryKey: [...keys.absences, user?.household],
    enabled: Boolean(user?.household),
    queryFn: () => {
      const today = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      return pb.collection('absences').getFullList<AbsenceRec>({
        filter: pb.filter('to >= {:today}', { today }),
        sort: 'from',
      });
    },
  });
}

/** Live updates: when anyone in the household changes something, refetch. */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const user = useUser();
  useEffect(() => {
    if (!user?.household) return;
    const subs: Array<[string, readonly unknown[]]> = [
      ['completions', keys.completions],
      ['completions', keys.fish],
      ['room_items', keys.room],
      ['room_items', keys.fish],
      ['fish_bonuses', keys.fish],
      ['game_runs', keys.games],
      ['game_runs', keys.fish],
      ['game_achievements', keys.games],
      ['game_achievements', keys.fish],
      ['duty_overrides', keys.overrides],
      ['absences', keys.absences],
      ['completions', keys.measurements],
      ['health_records', keys.health],
      ['health_tips', keys.healthTips],
      ['supplies', keys.supplies],
      ['tasks', keys.tasks],
      ['snoozes', keys.snoozes],
      ['cats', keys.cat],
      ['households', keys.household],
    ];
    const unsubs = subs.map(([collection, key]) =>
      pb.collection(collection).subscribe('*', () => qc.invalidateQueries({ queryKey: key })),
    );
    // After a reconnect (phone woke up, network changed) events may have been missed.
    const onConnect = pb.realtime.subscribe('PB_CONNECT', () => qc.invalidateQueries());
    const onVisible = () => document.visibilityState === 'visible' && qc.invalidateQueries();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      for (const u of [...unsubs, onConnect]) void u.then((fn) => fn()).catch(() => {});
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [qc, user?.household]);
}
