import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { pb, toIso } from './pb';
import type { Cat, Completion, Household, Snooze, Task, User } from './types';
import { useUser } from './auth';

export const keys = {
  household: ['household'] as const,
  members: ['members'] as const,
  cat: ['cat'] as const,
  tasks: ['tasks'] as const,
  completions: ['completions'] as const,
  snoozes: ['snoozes'] as const,
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

/** Live updates: when anyone in the household changes something, refetch. */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const user = useUser();
  useEffect(() => {
    if (!user?.household) return;
    const subs: Array<[string, readonly unknown[]]> = [
      ['completions', keys.completions],
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
