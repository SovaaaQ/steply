import { useAppData } from "../app/providers";

export function useRecommendations() {
  const {
    recommendations,
    recommendationOfDay,
    refreshRecommendations,
    markRecommendationRead,
    activeHabits,
    isLoading
  } = useAppData();

  return {
    recommendations,
    recommendationOfDay,
    refreshRecommendations,
    markRecommendationRead,
    activeHabits,
    isLoading
  };
}
