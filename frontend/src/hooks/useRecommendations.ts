import { useDashboardData, useUIFeedback } from "../app/providers";

export function useRecommendations() {
  const {
    recommendations,
    recommendationOfDay,
    refreshRecommendations,
    markRecommendationRead,
    activeHabits
  } = useDashboardData();
  const { isLoading } = useUIFeedback();

  return {
    recommendations,
    recommendationOfDay,
    refreshRecommendations,
    markRecommendationRead,
    activeHabits,
    isLoading
  };
}
