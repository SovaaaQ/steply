import type { PetState, PetType } from "../types/auth";
import type { Difficulty, EntryStatus, Habit } from "../types/habit";
import type { HabitStats } from "../types/statistics";

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
  cat: "спокойный спутник",
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
  neutral: "Отметьте привычку, чтобы поддержать питомца",
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
