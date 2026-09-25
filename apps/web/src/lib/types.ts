import type { Schedule, TaskCategory, TrackValue } from '@cathub/core';
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
  expand?: { user?: User; task?: Task };
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
