export interface Summary {
  user_id: number;
  total_habits: number;
  active_habits: number;
  total_entries: number;
  completed_count: number;
  missed_count: number;
  completed_last_7_days: number;
  missed_last_7_days: number;
  completed_last_30_days: number;
  missed_last_30_days: number;
  completion_rate: number;
  activity_score: number;
  current_streak: number;
  longest_streak: number;
  average_current_streak: number;
  experience_points: number;
  level: number;
  lives: number;
  recovery_mode: boolean;
}

export interface HabitStats {
  habit_id: number;
  title: string;
  total_entries: number;
  completed_count: number;
  missed_count: number;
  completion_rate: number;
  completed_last_7_days: number;
  missed_last_7_days: number;
  completion_rate_last_7: number;
  consecutive_missed: number;
  recovery_mode: boolean;
  recovery_task: string;
  current_streak: number;
  longest_streak: number;
  days_since_last_completion: number | null;
  weekday_success_rates: Record<string, number>;
}
