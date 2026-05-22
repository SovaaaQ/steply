import type { Habit, WeekdayKey } from "../types/habit";
import { formatLocalDate, formatPreferredTime } from "./formatDate";
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

export type HabitUnavailableReason = "not-scheduled" | "first-after-preferred-time";

export interface HabitScheduleAvailability {
  isScheduledToday: boolean;
  isAvailableToday: boolean;
  isPastPreferredTime: boolean;
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

function shouldDeferFirstOccurrence(habit: Habit, now: Date, hasEntries: boolean) {
  const preferredMinutes = getTimeMinutes(habit.preferred_time);

  return (
    !hasEntries &&
    preferredMinutes !== undefined &&
    habit.created_at.slice(0, 10) === formatLocalDate(now) &&
    getDateMinutes(now) > preferredMinutes
  );
}

export function getHabitScheduleAvailability(
  habit: Habit,
  now: Date,
  hasEntries = false
): HabitScheduleAvailability {
  const isScheduledToday = getEffectiveScheduleDays(habit).includes(getWeekdayKey(now));
  if (!isScheduledToday) {
    return {
      isScheduledToday,
      isAvailableToday: false,
      isPastPreferredTime: false,
      reason: "not-scheduled"
    };
  }

  const preferredMinutes = getTimeMinutes(habit.preferred_time);
  const isPastPreferredTime =
    preferredMinutes !== undefined && getDateMinutes(now) > preferredMinutes;

  if (shouldDeferFirstOccurrence(habit, now, hasEntries)) {
    return {
      isScheduledToday,
      isAvailableToday: false,
      isPastPreferredTime,
      reason: "first-after-preferred-time"
    };
  }

  return {
    isScheduledToday,
    isAvailableToday: true,
    isPastPreferredTime
  };
}

export function getNextScheduledOccurrence(
  habit: Habit,
  now: Date,
  startDayOffset = 0
): ScheduledOccurrence | undefined {
  const scheduleDays = new Set(getEffectiveScheduleDays(habit));
  if (scheduleDays.size === 0) {
    return undefined;
  }

  for (let dayOffset = startDayOffset; dayOffset <= startDayOffset + 7; dayOffset += 1) {
    const date = startOfLocalDay(now);
    date.setDate(date.getDate() + dayOffset);
    const weekday = getWeekdayKey(date);

    if (!scheduleDays.has(weekday)) {
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

function formatScheduledOccurrence(
  label: string,
  occurrence: ScheduledOccurrence | undefined
): string {
  if (!occurrence) {
    return `${label} не запланировано`;
  }

  const dateLabel = occurrence.date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long"
  });

  return `${label}: ${weekdayLabels[occurrence.weekday]}, ${dateLabel}, ${formatPreferredTime(occurrence.time)}`;
}

export function formatNextScheduledOccurrence(occurrence: ScheduledOccurrence | undefined): string {
  return formatScheduledOccurrence("Следующее выполнение", occurrence);
}

export function formatFirstScheduledOccurrence(occurrence: ScheduledOccurrence | undefined): string {
  return formatScheduledOccurrence("Первое выполнение", occurrence);
}
