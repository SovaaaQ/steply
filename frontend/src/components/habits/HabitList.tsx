import type { Habit, EntryStatus } from "../../types/habit";
import type { HabitStats } from "../../types/statistics";
import type { Prediction, Recommendation } from "../../types/recommendation";
import type { HabitEntry } from "../../types/habit";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { HabitCard } from "./HabitCard";

interface HabitListProps {
  habits: Habit[];
  predictions: Record<number, Prediction>;
  stats: Record<number, HabitStats>;
  recommendations?: Record<number, Recommendation>;
  pendingHabitActionIds?: number[];
  getTodayEntry: (habitId: number) => HabitEntry | undefined;
  compact?: boolean;
  onCreate?: () => void;
  onEdit?: (habit: Habit) => void;
  onDelete?: (habitId: number) => void;
  onMark: (habitId: number, status: EntryStatus) => void;
  onGoToTips?: () => void;
}

export function HabitList({
  habits,
  predictions,
  stats,
  recommendations,
  pendingHabitActionIds = [],
  getTodayEntry,
  compact = false,
  onCreate,
  onEdit,
  onDelete,
  onMark,
  onGoToTips
}: HabitListProps) {
  if (habits.length === 0) {
    return (
      <EmptyState
        title="Привычек пока нет"
        action={
          onCreate ? (
            <Button type="button" variant="cta" onClick={onCreate}>
              Новая привычка
            </Button>
          ) : undefined
        }
      >
        Добавьте короткий шаг на сегодня, после первой отметки появятся XP,
        серия и советы
      </EmptyState>
    );
  }

  return (
    <div className="habit-list">
      {habits.map((habit) => (
        <HabitCard
          compact={compact}
          habit={habit}
          key={habit.id}
          prediction={predictions[habit.id]}
          stats={stats[habit.id]}
          recommendation={recommendations?.[habit.id]}
          todayEntry={getTodayEntry(habit.id)}
          isMarking={pendingHabitActionIds.includes(habit.id)}
          onEdit={onEdit}
          onDelete={onDelete}
          onMark={onMark}
          onGoToTips={onGoToTips}
        />
      ))}
    </div>
  );
}
