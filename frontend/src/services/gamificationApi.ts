import { request } from "./apiClient";
import type { GamificationSummary, Pet } from "../types/gamification";
import type { PetType } from "../types/auth";

export const gamificationApi = {
  summary: () => request<GamificationSummary>("/gamification/summary"),
  updatePet: (payload: { pet_type: PetType; pet_name: string }) =>
    request<Pet>("/gamification/pet", {
      method: "PUT",
      body: JSON.stringify(payload)
    })
};
