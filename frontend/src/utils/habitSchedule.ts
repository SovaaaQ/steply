import type { Habit, WeekdayKey } from "../types/habit";
import { formatPreferredTime } from "./formatDate";
import { weekdayKeys } from "./habitForm";

const weekdayLabels: Record<WeekdayKey, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс"
};

export type HabitUnavailableReason = "not-scheduled" | "time-passed";

export interface HabitScheduleAvailability {
  isScheduledToday: boolean;
  isAvailableToday: boolean;
  reason?: HabitUnavailableReason;
}

export interface ScheduledOccurrence {
  date: Date;
  weekday: WeekdayKey;
  time: string | null;
}

function getWeekdayKey(date: Date): WeekdayKey {
  return weekdayKeys[(date.getDay() + 6) % 7];
}

function getEffectiveScheduleDays(habit: Habit): WeekdayKey[] {
  if (habit.schedule_days.length > 0) {
    return habit.schedule_days;
  }

  return habit.frequency_type === "daily" ? weekdayKeys : [];
}

function getTimeMinutes(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const [hours, minutes] = value.split(":");
  const parsedHours = Number(hours);
  const parsedMinutes = Number(minutes);
  if (!Number.isInteger(parsedHours) || !Number.isInteger(parsedMinutes)) {
    return undefined;
  }

  return parsedHours * 60 + parsedMinutes;
}

function getDateMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getHabitScheduleAvailability(
  habit: Habit,
  now: Date
): HabitScheduleAvailability {
  const isScheduledToday = getEffectiveScheduleDays(habit).includes(getWeekdayKey(now));
  if (!isScheduledToday) {
    return { isScheduledToday, isAvailableToday: false, reason: "not-scheduled" };
  }

  const preferredMinutes = getTimeMinutes(habit.preferred_time);
  if (preferredMinutes !== undefined && getDateMinutes(now) > preferredMinutes) {
    return { isScheduledToday, isAvailableToday: false, reason: "time-passed" };
  }

  return { isScheduledToday, isAvailableToday: true };
}

export function getNextScheduledOccurrence(
  habit: Habit,
  now: Date
): ScheduledOccurrence | undefined {
  const scheduleDays = new Set(getEffectiveScheduleDays(habit));
  if (scheduleDays.size === 0) {
    return undefined;
  }

  const preferredMinutes = getTimeMinutes(habit.preferred_time);
  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const date = startOfLocalDay(now);
    date.setDate(date.getDate() + dayOffset);
    const weekday = getWeekdayKey(date);

    if (!scheduleDays.has(weekday)) {
      continue;
    }
    if (dayOffset === 0 && preferredMinutes !== undefined && getDateMinutes(now) > preferredMinutes) {
      continue;
    }

    return {
      date,
      weekday,
      time: habit.preferred_time
    };
  }

  return undefined;
}

export function formatNextScheduledOccurrence(occurrence: ScheduledOccurrence | undefined): string {
  if (!occurrence) {
    return "Следующее выполнение не запланировано";
  }

  return `Следующее выполнение: ${weekdayLabels[occurrence.weekday]}, ${formatPreferredTime(occurrence.time)}`;
}
