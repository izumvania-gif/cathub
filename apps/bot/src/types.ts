import type { DutyZones, Schedule } from '@cathub/core';

export interface HouseholdRec {
  id: string;
  name: string;
  timezone: string;
  telegram_group_chat_id: string;
  duty_zones: DutyZones | null;
}
export interface UserRec {
  id: string;
  name: string;
  email: string;
  household: string;
  telegram_chat_id: string;
  telegram_username: string;
  notify: boolean;
  quiet_hours: { from: string; to: string } | null;
  digest_time: string;
  digest_sent_on: string;
}
export interface CatRec {
  id: string;
  household: string;
  name: string;
}
export interface TaskRec {
  id: string;
  household: string;
  title: string;
  emoji: string;
  category: string;
  schedule: Schedule;
  assignee: string;
  medical: boolean;
  weight: number;
  template_key: string;
  created: string;
  assign_mode: string;
  duty_map: Record<string, string> | null;
  rotation: string[];
}

export interface OverrideRec {
  id: string;
  household: string;
  task: string;
  occurrence_at: string;
  user: string;
  by: string;
  notified: boolean;
}

export interface AbsenceRec {
  id: string;
  household: string;
  user: string;
  from: string;
  to: string;
}
export interface CompletionRec {
  id: string;
  household: string;
  task: string;
  user: string;
  done_at: string;
  kind: 'done' | 'skipped';
  fish: number;
  rewarded: boolean;
}
export interface SnoozeRec {
  id: string;
  household: string;
  task: string;
  until: string;
}
export interface ReminderLogRec {
  id: string;
  task: string;
  occurrence_at: string;
  stage: 'before' | 'due' | 'overdue';
  chat_id: string;
  message_id: number;
  sent_at: string;
  resolved: boolean;
  text: string;
}

export interface SupplyRec {
  id: string;
  household: string;
  name: string;
  emoji: string;
  unit: string;
  stock: number;
  stock_at: string;
  daily_usage: number;
  low_days: number;
}

/** Everything the reminder loop needs for one household. */
export interface HouseholdState {
  household: HouseholdRec;
  cat: CatRec | null;
  users: UserRec[];
  tasks: TaskRec[];
  completions: CompletionRec[];
  snoozes: SnoozeRec[];
  supplies: SupplyRec[];
  /** Fish 🐟 balance (the fish_balance view), if known. */
  fish?: number;
  overrides: OverrideRec[];
  absences: AbsenceRec[];
}
