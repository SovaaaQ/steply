import type { PetState, PetType } from "../types/auth";
import type { GamificationSummary } from "../types/gamification";
import type { Difficulty, EntryStatus, Habit } from "../types/habit";
import type { HabitStats } from "../types/statistics";

export const emptyGamificationSummary: GamificationSummary = {
  profile: {
    level: 1,
    title: "Старт маршрута",
    milestone: "Создайте первую привычку и отметьте первый шаг",
    total_xp: 0,
    current_level_xp: 0,
    current_level_min_xp: 0,
    next_level: 2,
    next_level_xp: 100,
    xp_to_next_level: 100,
    progress_percent: 0,
    current_streak: 0,
    longest_streak: 0,
    last_active_date: null,
    streak_status: "empty"
  },
  pet: {
    pet_type: null,
    pet_name: null,
    pet_state: "neutral",
    level: 1,
    xp: 0,
    progress_percent: 0,
    next_level: 2,
    next_level_xp: 100,
    xp_to_next_level: 100,
    is_configured: false
  },
  streak: {
    current: 0,
    best: 0,
    status: "empty",
    label: "Серия ещё не началась",
    next_step: "Создайте привычку и отметьте первый короткий шаг",
    is_at_risk: false,
    last_active_date: null,
    completed_today: 0,
    scheduled_today: 0
  },
  achievements: [],
  goals: [],
  recent_events: [],
  next_best_action: {
    title: "Начните с одной привычки",
    description: "Добавьте первый шаг, чтобы появился прогресс",
    cta_label: "Создать привычку",
    cta_section: "habits"
  }
};

export const petEmoji: Record<PetType, string> = {
  dog: "🐶",
  cat: "🐱",
  parrot: "🦜",
  hamster: "🐹"
};

export const petTypeLabels: Record<PetType, string> = {
  dog: "Собака",
  cat: "Кошка",
  parrot: "Попугай",
  hamster: "Хомяк"
};

export const petTypeDescriptions: Record<PetType, string> = {
  dog: "бодрый напарник",
  cat: "тихий спутник",
  parrot: "яркий товарищ",
  hamster: "тихий хранитель ритма"
};

export const petStateLabels: Record<PetState, string> = {
  happy: "Питомец в форме",
  neutral: "Питомцу нужна забота",
  sad: "Ритм на паузе"
};

export const petStateShortLabels: Record<PetState, string> = {
  happy: "в форме",
  neutral: "нужна забота",
  sad: "ритм на паузе"
};

export const petMiniPhrases: Record<PetState, string> = {
  happy: "Так держать, питомец доволен",
  neutral: "Отметьте привычку, чтобы питомец рос",
  sad: "Можно вернуться одним коротким шагом"
};

export function formatPetCaption(value: string) {
  return value.trim().replace(/\s*\.+\s*$/g, "");
}

const difficultyXP: Record<Difficulty, number> = {
  easy: 5,
  medium: 10,
  hard: 15
};

export function getXPForCompletion(status: EntryStatus, difficulty: Difficulty = "medium") {
  const baseXP = difficultyXP[difficulty];
  if (status === "completed") {
    return baseXP;
  }
  if (status === "recovery_completed") {
    return Math.max(5, Math.ceil(baseXP * 0.5));
  }
  return 0;
}

export function shouldActivateRecoveryMode(
  habitStats:
    | Pick<
        HabitStats,
        "completion_rate_last_7" | "consecutive_missed" | "completed_last_7_days" | "missed_last_7_days"
      >
    | undefined,
  predictedRisk = 0
) {
  if (!habitStats) {
    return predictedRisk >= 0.7;
  }
  const hasRecentActivity =
    habitStats.completed_last_7_days + habitStats.missed_last_7_days > 0;
  return (
    predictedRisk >= 0.7 ||
    habitStats.consecutive_missed >= 2 ||
    (hasRecentActivity && habitStats.completion_rate_last_7 < 0.4)
  );
}

export function getRecoveryTask(habit: Pick<Habit, "recovery_task">) {
  return (
    habit.recovery_task?.trim() ||
    "Сделайте минимальную версию привычки"
  );
}
