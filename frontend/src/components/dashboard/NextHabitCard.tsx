import type { EntryStatus, Habit, HabitEntry } from "../../types/habit";
import type { Prediction } from "../../types/recommendation";
import type { HabitStats } from "../../types/statistics";
import { formatPreferredTime } from "../../utils/formatDate";
import { getRecoveryTask, shouldActivateRecoveryMode } from "../../utils/gamification";
import {
  formatNextScheduledOccurrence,
  getNextScheduledOccurrence
} from "../../utils/habitSchedule";
import { formatRiskDisplay, hasEnoughRiskData } from "../../utils/risk";
import { Button } from "../ui/Button";
import { HabitStatusBadge } from "../habits/HabitStatusBadge";

interface NextHabitCardProps {
  habit?: Habit;
  prediction?: Prediction;
  stats?: HabitStats;
  todayEntry?: HabitEntry;
  onOpenHabits: () => void;
  onMark: (habitId: number, status: EntryStatus) => void;
}

export function NextHabitCard({
  habit,
  prediction,
  stats,
  todayEntry,
  onOpenHabits,
  onMark
}: NextHabitCardProps) {
  if (!habit) {
    return (
      <section className="next-habit-card">
        <span className="page-kicker">Ближайшая привычка</span>
        <h3>На сегодня нет активных привычек</h3>
        <p>Создай одну небольшую привычку, чтобы собрать маршрут дня</p>
        <Button type="button" variant="cta" onClick={onOpenHabits}>
          Перейти к привычкам
        </Button>
      </section>
    );
  }

  const isDone = todayEntry?.status === "completed" || todayEntry?.status === "recovery_completed";
  const hasRiskData = hasEnoughRiskData(prediction, stats);
  const recoveryActive = shouldActivateRecoveryMode(stats, hasRiskData ? prediction.miss_risk : 0);
  const nextOccurrence = isDone ? getNextScheduledOccurrence(habit, new Date(), 1) : undefined;

  return (
    <section className="next-habit-card">
      <div className="next-habit-top">
        <span className="page-kicker">Ближайшая привычка</span>
        {todayEntry && <HabitStatusBadge status={todayEntry.status} />}
      </div>
      <h3>{habit.title}</h3>
      <p>
        {isDone
          ? `Сегодня привычка уже выполнена. ${formatNextScheduledOccurrence(nextOccurrence)}.`
          : habit.description || "Короткий шаг на сегодня"}
      </p>

      <dl className="next-habit-facts">
        <div>
          <dt>Время</dt>
          <dd>{formatPreferredTime(habit.preferred_time)}</dd>
        </div>
        <div>
          <dt>{isDone ? "Риск следующего шага" : "Риск"}</dt>
          <dd>{formatRiskDisplay(prediction, stats)}</dd>
        </div>
      </dl>

      {recoveryActive && !isDone && (
        <p className="next-habit-recovery">
          Минимальная версия: {getRecoveryTask(habit)}
        </p>
      )}

      <div className="hero-actions">
        <Button
          type="button"
          variant="cta"
          disabled={isDone}
          onClick={() => onMark(habit.id, "completed")}
        >
          {isDone ? "Уже отмечено" : "Отметить привычку"}
        </Button>
        <Button type="button" variant="secondary" onClick={onOpenHabits}>
          Перейти к привычкам
        </Button>
      </div>
    </section>
  );
}
