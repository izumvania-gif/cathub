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
}

export interface Household extends RecordModel {
  name: string;
  timezone: string;
  invite_code: string;
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
