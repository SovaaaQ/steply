import { useAppData } from "../app/providers";

export function useStatistics() {
  const {
    summary,
    completedToday,
    todayProgress
  } = useAppData();

  return {
    summary,
    completedToday,
    todayProgress
  };
}
