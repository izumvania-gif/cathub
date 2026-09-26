import type { GameKey } from '@cathub/core';
import type {
  AssignMode,
  DutyZones,
  NotifyLevel,
  Schedule,
  TaskCategory,
  TrackValue,
} from '@cathub/core';
import type { RecordModel } from 'pocketbase';

export interface User extends RecordModel {
  email: string;
  name: string;
  avatar: string;
  household: string;
  role: '' | 'owner' | 'member';
  telegram_chat_id: string;
  telegram_username: string;
  notify: boolean;
  digest_time: string;
  quiet_hours: { from: string; to: string } | null;
}

export interface Household extends RecordModel {
  name: string;
  timezone: string;
  invite_code: string;
  telegram_group_chat_id: string;
  calendar_token: string;
  duty_zones: DutyZones | null;
}

export interface DutyOverrideRec extends RecordModel {
  household: string;
  task: string;
  occurrence_at: string;
  user: string;
  by: string;
}

export interface HealthTipRec extends RecordModel {
  household: string;
  tip: string;
  state: 'dismissed' | 'added' | 'done';
  task: string;
}

export interface AbsenceRec extends RecordModel {
  household: string;
  user: string;
  from: string;
  to: string;
  note: string;
}

export interface Cat extends RecordModel {
  household: string;
  name: string;
  photo: string;
  birth_date: string;
  sex: '' | 'male' | 'female';
  breed: string;
  neutered: boolean;
  outdoor: boolean;
  long_hair: boolean;
  chip_number: string;
  vet_clinic: string;
  notes: string;
  /** Pixel cat look; see normalizeLook(). */
  appearance: unknown;
}

export interface Task extends RecordModel {
  household: string;
  cat: string;
  title: string;
  emoji: string;
  category: TaskCategory;
  schedule: Schedule;
  track_value: TrackValue | null;
  template_key: string;
  /** 1–3, or 0 for the default by template/category (core's taskWeight). */
  weight: number;
  /** See core's assignMode(); '' on tasks from before duty sharing. */
  assign_mode: AssignMode | '';
  duty_map: Record<string, string> | null;
  /** How it reaches Telegram (core's notifyLevel); '' = default by template. */
  notify: NotifyLevel | '';
  medical: boolean;
  notes: string;
  assignee: string;
  rotation: string[];
  archived: boolean;
  sort: number;
}

export interface Completion extends RecordModel {
  household: string;
  task: string;
  user: string;
  done_at: string;
  kind: 'done' | 'skipped';
  value: number;
  note: string;
  /** Fish 🐟 the bot priced this completion at (see core's rewardFor). */
  fish: number;
  rewarded: boolean;
  expand?: { user?: User; task?: Task };
}

export interface RoomItem extends RecordModel {
  household: string;
  item: string;
  price: number;
  placed: boolean;
  bought_by: string;
}

export interface FishBalance extends RecordModel {
  from_tasks: number;
  from_bonuses: number;
  /** Mini-game runs and achievements. */
  from_games?: number;
  from_achievements?: number;
  spent: number;
}

export interface Snooze extends RecordModel {
  household: string;
  task: string;
  until: string;
}

export type HealthType = 'vaccination' | 'visit' | 'medication' | 'lab' | 'other';

export interface HealthRecord extends RecordModel {
  household: string;
  cat: string;
  type: HealthType;
  date: string;
  title: string;
  clinic: string;
  batch: string;
  notes: string;
  files: string[];
  user: string;
  expand?: { user?: User };
}

export interface Supply extends RecordModel {
  household: string;
  name: string;
  emoji: string;
  unit: string;
  stock: number;
  stock_at: string;
  daily_usage: number;
  low_days: number;
  template_key: string;
}

export interface GameRunRec extends RecordModel {
  household: string;
  user: string;
  game: GameKey;
  score: number;
  stats: Record<string, number>;
  fish: number;
  duration_ms: number;
  created: string;
}

export interface GameAchievementRec extends RecordModel {
  household: string;
  user: string;
  key: string;
  fish: number;
  created: string;
}

export interface GameRecordRec extends RecordModel {
  household: string;
  user: string;
  game: GameKey;
  best: number;
  runs: number;
}
