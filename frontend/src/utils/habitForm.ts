import type { HabitCreate, HabitFormState, WeekdayKey } from "../types/habit";

export const weekdayKeys: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const defaultHabitForm: HabitFormState = {
  title: "",
  description: "",
  frequency_type: "daily",
  target_per_week: 7,
  difficulty: "medium",
  preferred_time: "",
  scheduledDays: weekdayKeys
};

export function buildHabitPayload(form: HabitFormState): HabitCreate {
  const scheduleDays = form.frequency_type === "daily" ? weekdayKeys : form.scheduledDays;

  return {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    frequency_type: form.frequency_type,
    target_per_week: scheduleDays.length || 1,
    difficulty: form.difficulty,
    preferred_time: form.preferred_time || undefined,
    schedule_days: scheduleDays
  };
}
