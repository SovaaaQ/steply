import type { HabitCreate, HabitFormState, WeekdayKey } from "../types/habit";

export const weekdayKeys: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export interface HabitStarterTemplate {
  description: string;
  form: HabitFormState;
  id: string;
  title: string;
}

export const defaultHabitForm: HabitFormState = {
  title: "",
  description: "",
  frequency_type: "daily",
  target_per_week: 7,
  difficulty: "medium",
  preferred_time: "",
  scheduledDays: weekdayKeys
};

export const habitStarterTemplates: HabitStarterTemplate[] = [
  {
    id: "thesis",
    title: "Диплом 10 минут",
    description: "Мягкий учебный старт без перегруза",
    form: {
      title: "Диплом 10 минут",
      description: "Открыть документ и написать один небольшой фрагмент",
      frequency_type: "daily",
      target_per_week: 7,
      difficulty: "medium",
      preferred_time: "10:00",
      scheduledDays: weekdayKeys
    }
  },
  {
    id: "english",
    title: "Английские слова",
    description: "Короткое повторение вечером",
    form: {
      title: "Английские слова",
      description: "Повторить 10 слов или одну карточку",
      frequency_type: "custom",
      target_per_week: 5,
      difficulty: "easy",
      preferred_time: "19:30",
      scheduledDays: ["mon", "tue", "wed", "thu", "fri"]
    }
  },
  {
    id: "walk",
    title: "Прогулка 15 минут",
    description: "Простое восстановление энергии",
    form: {
      title: "Прогулка 15 минут",
      description: "Выйти на короткий круг без цели пройти много",
      frequency_type: "daily",
      target_per_week: 7,
      difficulty: "easy",
      preferred_time: "18:00",
      scheduledDays: weekdayKeys
    }
  }
];

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
