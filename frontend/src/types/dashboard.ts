import type { GamificationSummary } from "./gamification";
import type { Habit, HabitEntry } from "./habit";
import type { Prediction, Recommendation } from "./recommendation";
import type { HabitStats, Summary } from "./statistics";
import type { User } from "./auth";

export interface DaySyncResponse {
  auto_missed_created: number;
  gamification: GamificationSummary;
}

export interface DashboardResponse {
  user: User;
  habits: Habit[];
  summary: Summary;
  habit_stats: Record<number, HabitStats>;
  habit_entries: Record<number, HabitEntry[]>;
  predictions: Record<number, Prediction>;
  recommendations: Recommendation[];
  gamification: GamificationSummary;
}
