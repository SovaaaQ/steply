from __future__ import annotations

from datetime import datetime, time
from types import SimpleNamespace

from app.services.habit_schedule import (
    get_today_unavailability_detail,
    is_habit_available_at,
    is_habit_scheduled_on,
)


def make_habit(
    schedule_days: list[str],
    preferred_time: time | None = None,
    frequency_type: str = "custom",
    created_at: datetime | None = None,
    entries: list[object] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        schedule_days=schedule_days,
        preferred_time=preferred_time,
        frequency_type=frequency_type,
        created_at=created_at,
        entries=entries or [],
    )


def test_timed_daily_habit_stays_available_after_its_preferred_time() -> None:
    now = datetime(2026, 5, 22, 11, 30)
    habit = make_habit(["mon", "tue", "wed", "thu", "fri", "sat", "sun"], time(7, 40))

    assert is_habit_scheduled_on(habit, now.date())
    assert is_habit_available_at(habit, now)
    assert get_today_unavailability_detail(habit, now) is None


def test_habit_for_wednesday_and_thursday_is_not_available_on_friday() -> None:
    now = datetime(2026, 5, 22, 11, 30)
    habit = make_habit(["wed", "thu"])

    assert not is_habit_scheduled_on(habit, now.date())
    assert not is_habit_available_at(habit, now)
    assert get_today_unavailability_detail(habit, now) == "Привычка не запланирована на сегодня"


def test_habit_without_time_is_available_for_its_scheduled_day() -> None:
    now = datetime(2026, 5, 22, 23, 59)
    habit = make_habit(["fri"])

    assert is_habit_available_at(habit, now)


def test_daily_habit_without_stored_days_keeps_daily_fallback() -> None:
    now = datetime(2026, 5, 22, 11, 30)
    habit = make_habit([], frequency_type="daily")

    assert is_habit_available_at(habit, now)


def test_new_timed_habit_waits_for_next_scheduled_day_after_preferred_time() -> None:
    now = datetime(2026, 5, 22, 12, 0)
    habit = make_habit(
        ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        preferred_time=time(7, 40),
        created_at=datetime(2026, 5, 22, 11, 59),
    )

    assert not is_habit_available_at(habit, now)
    assert (
        get_today_unavailability_detail(habit, now)
        == "Первое выполнение перенесено на следующий запланированный день"
    )


def test_first_timed_habit_created_before_preferred_time_is_available() -> None:
    now = datetime(2026, 5, 22, 7, 20)
    habit = make_habit(
        ["fri"],
        preferred_time=time(7, 40),
        created_at=datetime(2026, 5, 22, 7, 10),
    )

    assert is_habit_available_at(habit, now)
