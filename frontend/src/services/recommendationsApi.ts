import { request } from "./apiClient";
import type { Recommendation } from "../types/recommendation";

export const recommendationsApi = {
  list: () => request<Recommendation[]>("/recommendations"),

  generate: () =>
    request<Recommendation[]>("/recommendations/generate", {
      method: "POST"
    }),

  markRead: (recommendationId: number) =>
    request<Recommendation>(`/recommendations/${recommendationId}/read`, {
      method: "PATCH"
    })
};
