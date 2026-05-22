import { request } from "./apiClient";
import type { EntryStatus, Habit, HabitCreate, HabitEntry, HabitUpdate } from "../types/habit";

export const habitsApi = {
  list: () => request<Habit[]>("/habits"),

  create: (payload: HabitCreate) =>
    request<Habit>("/habits", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  update: (habitId: number, payload: HabitUpdate) =>
    request<Habit>(`/habits/${habitId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),

  delete: (habitId: number) =>
    request<void>(`/habits/${habitId}`, {
      method: "DELETE"
    }),

  mark: (habitId: number, status: EntryStatus) =>
    request<HabitEntry>(`/habits/${habitId}/entries`, {
      method: "POST",
      body: JSON.stringify({ status })
    }),

  entries: (habitId: number) => request<HabitEntry[]>(`/habits/${habitId}/entries`)
};
