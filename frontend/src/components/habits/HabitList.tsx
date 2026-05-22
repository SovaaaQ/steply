import type { Habit, EntryStatus } from "../../types/habit";
import type { HabitStats } from "../../types/statistics";
import type { Prediction } from "../../types/recommendation";
import type { HabitEntry } from "../../types/habit";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { HabitCard } from "./HabitCard";

interface HabitListProps {
  habits: Habit[];
  predictions: Record<number, Prediction>;
  stats: Record<number, HabitStats>;
  getTodayEntry: (habitId: number) => HabitEntry | undefined;
  compact?: boolean;
  onCreate?: () => void;
  onEdit?: (habit: Habit) => void;
  onDelete?: (habitId: number) => void;
  onMark: (habitId: number, status: EntryStatus) => void;
}

export function HabitList({
  habits,
  predictions,
  stats,
  getTodayEntry,
  compact = false,
  onCreate,
  onEdit,
  onDelete,
  onMark
}: HabitListProps) {
  if (habits.length === 0) {
    return (
      <EmptyState
        title="У вас пока нет привычек"
        action={
          onCreate ? (
            <Button type="button" variant="cta" onClick={onCreate}>
              Новая привычка
            </Button>
          ) : undefined
        }
      >
        Создайте короткий шаг на сегодня. После первой отметки откроются XP, серия,
        квест дня и персональные рекомендации.
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
          todayEntry={getTodayEntry(habit.id)}
          onEdit={onEdit}
          onDelete={onDelete}
          onMark={onMark}
        />
      ))}
    </div>
  );
}
