from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

WEEKDAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def _normalize_schedule_day(day: Any) -> Optional[str]:
    if isinstance(day, int) and 0 <= day <= 6:
        return WEEKDAY_KEYS[day]
    if isinstance(day, str):
        value = day.strip().lower()
        if value.isdigit():
            return _normalize_schedule_day(int(value))
        if value in WEEKDAY_KEYS:
            return value
    return None


def get_schedule_days(habit: Any) -> set[str]:
    days = {
        normalized
        for normalized in (_normalize_schedule_day(day) for day in (habit.schedule_days or []))
        if normalized is not None
    }
    if days:
        return days
    if getattr(habit, "frequency_type", None) == "daily":
        return set(WEEKDAY_KEYS)
    return set()


def is_habit_scheduled_on(habit: Any, target_date: date) -> bool:
    return WEEKDAY_KEYS[target_date.weekday()] in get_schedule_days(habit)


def get_next_scheduled_date(
    habit: Any,
    start_date: date,
    start_day_offset: int = 0,
) -> Optional[date]:
    schedule_days = get_schedule_days(habit)
    if not schedule_days:
        return None

    for day_offset in range(start_day_offset, start_day_offset + 8):
        target_date = start_date.fromordinal(start_date.toordinal() + day_offset)
        if WEEKDAY_KEYS[target_date.weekday()] in schedule_days:
            return target_date

    return None


def is_first_occurrence_deferred(habit: Any, now: datetime) -> bool:
    created_at = getattr(habit, "created_at", None)
    preferred_time = getattr(habit, "preferred_time", None)
    entries = getattr(habit, "entries", [])

    return bool(
        isinstance(created_at, datetime)
        and preferred_time is not None
        and created_at.date() == now.date()
        and now.time() > preferred_time
        and not entries
    )


def is_habit_available_at(habit: Any, now: datetime) -> bool:
    return is_habit_scheduled_on(habit, now.date()) and not is_first_occurrence_deferred(
        habit,
        now,
    )


def get_today_unavailability_detail(habit: Any, now: datetime) -> Optional[str]:
    if not is_habit_scheduled_on(habit, now.date()):
        return "Привычка не запланирована на сегодня"
    if is_first_occurrence_deferred(habit, now):
        return "Первый шаг перенесен на следующий запланированный день"
    return None
