import type { EntryStatus, RiskLevel } from "../types/habit";
import type { Prediction } from "../types/recommendation";
import type { HabitStats, Summary } from "../types/statistics";
import { percent } from "./formatDate";

export const riskMinimumEntries = 3;

export const riskLabels: Record<RiskLevel, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий"
};

export const riskDescriptions: Record<RiskLevel, string> = {
  low: "Темп стабильный",
  medium: "Нужна мягкая поддержка",
  high: "Лучше выбрать минимальный шаг"
};

export const statusLabels: Record<EntryStatus, string> = {
  completed: "Выполнено",
  missed: "Пропуск",
  recovery_completed: "Мягкий шаг"
};

export const emptySummary: Summary = {
  user_id: 0,
  total_habits: 0,
  active_habits: 0,
  total_entries: 0,
  completed_count: 0,
  missed_count: 0,
  completed_last_7_days: 0,
  missed_last_7_days: 0,
  completed_last_30_days: 0,
  missed_last_30_days: 0,
  completion_rate: 0,
  activity_score: 0,
  current_streak: 0,
  longest_streak: 0,
  average_current_streak: 0,
  experience_points: 0,
  level: 1,
  lives: 5,
  recovery_mode: false
};

export function getNumericFeature(prediction: Prediction | undefined, key: string): number {
  const value = prediction?.features[key];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function hasEnoughRiskData(
  prediction: Prediction | undefined,
  stats: Pick<HabitStats, "total_entries"> | undefined
): prediction is Prediction {
  const entriesCount = stats?.total_entries ?? getNumericFeature(prediction, "total_entries");
  return Boolean(prediction) && entriesCount >= riskMinimumEntries;
}

export function getRiskLevel(prediction: Prediction): RiskLevel {
  if (prediction.miss_risk < 0.4) {
    return "low";
  }
  if (prediction.miss_risk < 0.7) {
    return "medium";
  }
  return "high";
}

export function formatRiskDisplay(
  prediction: Prediction | undefined,
  stats: Pick<HabitStats, "total_entries"> | undefined
): string {
  if (!hasEnoughRiskData(prediction, stats)) {
    return "Пока рано считать";
  }
  const level = getRiskLevel(prediction);
  return `${riskLabels[level]} риск · ${percent(prediction.miss_risk)}`;
}
