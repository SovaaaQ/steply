import { request } from "./apiClient";
import type { HabitStats, Summary } from "../types/statistics";
import type { Prediction } from "../types/recommendation";

export const statisticsApi = {
  summary: () => request<Summary>("/analytics/summary"),
  habitStats: (habitId: number) => request<HabitStats>(`/analytics/habits/${habitId}`),
  prediction: (habitId: number, targetDate?: string) =>
    request<Prediction>(
      `/analytics/habits/${habitId}/prediction${targetDate ? `?target_date=${targetDate}` : ""}`
    )
};
