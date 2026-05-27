import type { Habit, HabitEntry, WeekdayKey } from "../types/habit";
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

export type HabitPeriodState =
  | "not_due"
  | "available_to_complete"
  | "completed"
  | "missed"
  | "locked";

export interface HabitCurrentPeriodState {
  state: HabitPeriodState;
  availability: HabitScheduleAvailability;
  canComplete: boolean;
  canSkip: boolean;
  isAlreadyCounted: boolean;
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

function parseAsUTC(isoString: string): Date {
  // Backend stores naive UTC datetimes without 'Z'. Force UTC interpretation so that
  // getFullYear/getMonth/getDate return LOCAL calendar values, not UTC calendar values.
  const hasZone = isoString.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(isoString);
  return new Date(hasZone ? isoString : isoString + "Z");
}

function shouldDeferFirstOccurrence(habit: Habit, now: Date, hasEntries: boolean) {
  const preferredMinutes = getTimeMinutes(habit.preferred_time);
  if (hasEntries || preferredMinutes === undefined) return false;

  const createdLocalDate = formatLocalDate(parseAsUTC(habit.created_at));
  return createdLocalDate === formatLocalDate(now) && getDateMinutes(now) > preferredMinutes;
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

export function getHabitCurrentPeriodState(
  habit: Habit,
  now: Date,
  hasEntries: boolean,
  todayEntry?: HabitEntry
): HabitCurrentPeriodState {
  const availability = getHabitScheduleAvailability(habit, now, hasEntries);
  const isCompleted =
    todayEntry?.status === "completed" || todayEntry?.status === "recovery_completed";

  if (isCompleted) {
    return {
      state: "completed",
      availability,
      canComplete: false,
      canSkip: false,
      isAlreadyCounted: true
    };
  }

  if (todayEntry?.status === "missed") {
    return {
      state: "missed",
      availability,
      canComplete: false,
      canSkip: false,
      isAlreadyCounted: true
    };
  }

  if (!availability.isScheduledToday || !availability.isAvailableToday) {
    return {
      state: "not_due",
      availability,
      canComplete: false,
      canSkip: false,
      isAlreadyCounted: false
    };
  }

  return {
    state: "available_to_complete",
    availability,
    canComplete: true,
    canSkip: false,
    isAlreadyCounted: false
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
  return formatScheduledOccurrence("Следующий раз", occurrence);
}

export function formatFirstScheduledOccurrence(occurrence: ScheduledOccurrence | undefined): string {
  return formatScheduledOccurrence("Первый раз", occurrence);
}
