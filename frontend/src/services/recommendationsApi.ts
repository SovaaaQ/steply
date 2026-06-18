import { request } from "./apiClient";
import type { Recommendation } from "../types/recommendation";

export const recommendationsApi = {
  list: () => request<Recommendation[]>("/recommendations"),

  generate: (options?: { forceAi?: boolean }) =>
    request<Recommendation[]>(
      `/recommendations/generate${options?.forceAi ? "?force_ai=true" : ""}`,
      { method: "POST" }
    ),

  markRead: (recommendationId: number) =>
    request<Recommendation>(`/recommendations/${recommendationId}/read`, {
      method: "PATCH"
    })
};
