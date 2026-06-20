import type { HabitCreate, HabitFormState, WeekdayKey } from "../types/habit";

export const weekdayKeys: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const preferredTimePattern = "([01][0-9]|2[0-3]):[0-5][0-9]";

const preferredTimeRegex = new RegExp(`^${preferredTimePattern}$`);

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
    description: "Учёба на короткий заход",
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
    description: "Короткий круг после дел",
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

export function formatPreferredTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length === 3 && Number(digits.slice(0, 2)) > 23) {
    return `0${digits[0]}:${digits.slice(1)}`;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function completePreferredTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (!digits) {
    return "";
  }

  let hours = "";
  let minutes = "";

  if (digits.length === 1) {
    hours = `0${digits}`;
    minutes = "00";
  } else if (digits.length === 2) {
    hours = digits;
    minutes = "00";
  } else if (digits.length === 3 && Number(digits.slice(0, 2)) > 23) {
    hours = `0${digits[0]}`;
    minutes = digits.slice(1);
  } else if (digits.length === 3) {
    hours = digits.slice(0, 2);
    minutes = `0${digits[2]}`;
  } else {
    hours = digits.slice(0, 2);
    minutes = digits.slice(2);
  }

  const normalized = `${hours}:${minutes}`;
  return preferredTimeRegex.test(normalized) ? normalized : "";
}
