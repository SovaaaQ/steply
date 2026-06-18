import { useDashboardData, useHabitForm } from "../app/providers";

export function useHabits() {
  const {
    habits,
    activeHabits,
    habitsForToday,
    habitEntries,
    habitStats,
    predictions,
    pendingHabitActionIds,
    markHabit,
    deleteHabit,
    getTodayEntry
  } = useDashboardData();
  const {
    habitForm,
    setHabitForm,
    editingHabitId,
    isSubmitting,
    submitHabit,
    resetHabitForm,
    startEditHabit
  } = useHabitForm();

  return {
    habits,
    activeHabits,
    habitsForToday,
    habitEntries,
    habitStats,
    predictions,
    pendingHabitActionIds,
    habitForm,
    setHabitForm,
    editingHabitId,
    isSubmitting,
    submitHabit,
    resetHabitForm,
    startEditHabit,
    markHabit,
    deleteHabit,
    getTodayEntry
  };
}
