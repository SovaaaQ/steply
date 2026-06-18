export type EntryStatus = "completed" | "missed" | "recovery_completed";
export type Difficulty = "easy" | "medium" | "hard";
export type FrequencyType = "daily" | "custom";
export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type RiskLevel = "low" | "medium" | "high";

export interface Habit {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  frequency_type: FrequencyType;
  target_per_week: number;
  difficulty: Difficulty;
  preferred_time: string | null;
  recovery_minutes: number;
  recovery_task: string | null;
  schedule_days: WeekdayKey[];
  is_active: boolean;
  created_at: string;
}

export interface HabitCreate {
  title: string;
  description?: string;
  frequency_type: FrequencyType;
  target_per_week: number;
  difficulty: Difficulty;
  preferred_time?: string;
  schedule_days: WeekdayKey[];
}

export type HabitUpdate = Partial<HabitCreate> & { is_active?: boolean };

export type HabitFormState = Omit<HabitCreate, "description" | "preferred_time" | "schedule_days"> & {
  description: string;
  preferred_time: string;
  scheduledDays: WeekdayKey[];
};

export interface HabitEntry {
  id: number;
  habit_id: number;
  user_id: number;
  entry_date: string;
  status: EntryStatus;
  note: string | null;
  completion_value: number | null;
  xp_awarded: number;
  meta: Record<string, unknown>;
  created_at: string;
}
