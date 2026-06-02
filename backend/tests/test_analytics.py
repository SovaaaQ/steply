from __future__ import annotations

from datetime import date
from types import SimpleNamespace

from app.services.analytics import calculate_user_activity_summary_from_entries


def make_habit(habit_id: int, is_active: bool = True) -> SimpleNamespace:
    return SimpleNamespace(
        id=habit_id,
        title=f"Habit {habit_id}",
        user_id=1,
        is_active=is_active,
        recovery_task=None,
    )


def make_entry(habit_id: int, entry_date: date, status: str) -> SimpleNamespace:
    return SimpleNamespace(
        habit_id=habit_id,
        user_id=1,
        entry_date=entry_date,
        status=status,
    )


def test_user_summary_uses_preloaded_entries_for_habit_stats() -> None:
    user = SimpleNamespace(id=1, experience_points=20, level=2, lives=5)
    habits = [make_habit(1), make_habit(2), make_habit(3, is_active=False)]
    entries = [
        make_entry(1, date(2026, 5, 20), "completed"),
        make_entry(1, date(2026, 5, 21), "completed"),
        make_entry(2, date(2026, 5, 21), "missed"),
        make_entry(3, date(2026, 5, 21), "completed"),
    ]

    summary = calculate_user_activity_summary_from_entries(
        user,
        habits,
        entries,
        today=date(2026, 5, 22),
    )

    assert summary.total_habits == 3
    assert summary.active_habits == 2
    assert summary.total_entries == 4
    assert summary.completed_count == 3
    assert summary.missed_count == 1
    assert summary.current_streak == 2
