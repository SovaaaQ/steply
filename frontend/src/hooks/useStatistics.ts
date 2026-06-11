import { useDashboardData } from "../app/providers";

export function useStatistics() {
  const {
    summary,
    completedToday,
    todayProgress
  } = useDashboardData();

  return {
    summary,
    completedToday,
    todayProgress
  };
}
