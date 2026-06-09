import { useAppData } from "../app/providers";

export function useHabits() {
  const {
    habits,
    activeHabits,
    habitsForToday,
    habitEntries,
    habitStats,
    predictions,
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
  } = useAppData();

  return {
    habits,
    activeHabits,
    habitsForToday,
    habitEntries,
    habitStats,
    predictions,
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
