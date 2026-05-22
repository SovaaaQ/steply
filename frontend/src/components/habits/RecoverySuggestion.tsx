import type { Habit, HabitEntry } from "../../types/habit";
import type { HabitStats } from "../../types/statistics";
import { getRecoveryTask, getXPForCompletion, shouldActivateRecoveryMode } from "../../utils/gamification";
import { percent } from "../../utils/formatDate";
import { Button } from "../ui/Button";

interface RecoverySuggestionProps {
  habit: Habit;
  stats?: HabitStats;
  predictedRisk?: number;
  todayEntry?: HabitEntry;
  onRecover: () => void;
}

export function RecoverySuggestion({
  habit,
  stats,
  predictedRisk = 0,
  todayEntry,
  onRecover
}: RecoverySuggestionProps) {
  const isActive = shouldActivateRecoveryMode(stats, predictedRisk);
  const isRecoveredToday = todayEntry?.status === "recovery_completed";
  const recoveryXP = getXPForCompletion("recovery_completed", habit.difficulty);

  if ((!isActive && !isRecoveredToday) || todayEntry?.status === "completed") {
    return null;
  }

  return (
    <div className={`recovery-suggestion ${isRecoveredToday ? "done" : ""}`}>
      <div>
        <span>Режим восстановления</span>
        <strong>{isRecoveredToday ? "Минимальная версия выполнена" : getRecoveryTask(habit)}</strong>
        <p>
          {isRecoveredToday
            ? "Отлично, ты вернулся к привычке без лишнего давления."
            : `Риск пропуска ${percent(predictedRisk)}. Выполни короткий вариант и получи +${recoveryXP} XP.`}
        </p>
      </div>
      {!isRecoveredToday && (
        <Button type="button" variant="secondary" onClick={onRecover}>
          Выполнить минимум
        </Button>
      )}
    </div>
  );
}
