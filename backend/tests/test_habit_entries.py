from __future__ import annotations

from datetime import date, datetime, time
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.schemas import HabitEntryCreate
from app.services.habit_entries import get_auto_missed_dates, validate_entry_transition


def make_habit(
    schedule_days: list[str],
    created_at: datetime,
    preferred_time: time | None = None,
    frequency_type: str = "custom",
) -> SimpleNamespace:
    return SimpleNamespace(
        schedule_days=schedule_days,
        created_at=created_at,
        preferred_time=preferred_time,
        frequency_type=frequency_type,
    )


def make_entry(status: str, entry_date: date = date(2026, 5, 22)) -> SimpleNamespace:
    return SimpleNamespace(status=status, entry_date=entry_date)


def make_payload(status: str, entry_date: date = date(2026, 5, 22)) -> HabitEntryCreate:
    return HabitEntryCreate(status=status, entry_date=entry_date)


def assert_conflict(callable_obj, detail: str) -> None:
    with pytest.raises(HTTPException) as exc_info:
        callable_obj()
    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == detail


def test_auto_missed_marks_only_elapsed_scheduled_days_without_entries() -> None:
    habit = make_habit(
        ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        datetime(2026, 5, 20, 8, 0),
        frequency_type="daily",
    )

    missed_dates = get_auto_missed_dates(
        habit,
        today=date(2026, 5, 23),
        existing_dates={date(2026, 5, 21)},
    )

    assert missed_dates == [date(2026, 5, 20), date(2026, 5, 22)]


def test_auto_missed_respects_weekday_schedule() -> None:
    habit = make_habit(["wed", "fri"], datetime(2026, 5, 18, 8, 0))

    missed_dates = get_auto_missed_dates(habit, today=date(2026, 5, 23), existing_dates=set())

    assert missed_dates == [date(2026, 5, 20), date(2026, 5, 22)]


def test_auto_missed_does_not_mark_habit_created_today() -> None:
    habit = make_habit(["sun"], datetime(2026, 5, 24, 8, 0))

    assert get_auto_missed_dates(habit, today=date(2026, 5, 24), existing_dates=set()) == []


def test_auto_missed_skips_deferred_first_occurrence() -> None:
    habit = make_habit(
        ["fri", "sat"],
        datetime(2026, 5, 22, 12, 0),
        preferred_time=time(7, 40),
    )

    missed_dates = get_auto_missed_dates(habit, today=date(2026, 5, 23), existing_dates=set())

    assert missed_dates == []


def test_completed_period_cannot_be_skipped() -> None:
    assert_conflict(
        lambda: validate_entry_transition(
            existing=make_entry("completed", date(2026, 5, 22)),
            payload=make_payload("missed", date(2026, 5, 22)),
            client_today=date(2026, 5, 23),
        ),
        "Сегодня шаг уже учтен, пропуск недоступен",
    )


def test_missed_period_cannot_be_completed() -> None:
    assert_conflict(
        lambda: validate_entry_transition(
            existing=make_entry("missed", date(2026, 5, 23)),
            payload=make_payload("completed", date(2026, 5, 23)),
            client_today=date(2026, 5, 23),
        ),
        "Период уже учтен как пропущенный",
    )


def test_skip_is_rejected_while_current_period_is_open() -> None:
    assert_conflict(
        lambda: validate_entry_transition(
            existing=None,
            payload=make_payload("missed", date(2026, 5, 23)),
            client_today=date(2026, 5, 23),
        ),
        "Пропуск считается автоматически после окончания запланированного дня",
    )


def test_repeated_completion_click_is_idempotent() -> None:
    validate_entry_transition(
        existing=make_entry("completed", date(2026, 5, 23)),
        payload=make_payload("completed", date(2026, 5, 23)),
        client_today=date(2026, 5, 23),
    )
