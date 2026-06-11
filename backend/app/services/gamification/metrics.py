from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.gamification_rules import COMPLETION_STATUSES, shouldActivateRecoveryMode
from app.core.time import utc_now, utc_start_of_day
from app.models import Habit, HabitEntry, Recommendation, RewardEvent, User
from app.services.habit_schedule import is_habit_available_at, is_habit_scheduled_on


def _habit_entries(entries: list[HabitEntry], habit_id: int) -> list[HabitEntry]:
    return [entry for entry in entries if entry.habit_id == habit_id]


def _habit_entry_count_last_7(entries: list[HabitEntry], habit_id: int, today: date) -> int:
    recent_start = today - timedelta(days=6)
    return sum(
        1
        for entry in entries
        if entry.habit_id == habit_id and entry.entry_date >= recent_start
    )


def _habit_completion_rate_last_7(entries: list[HabitEntry], habit_id: int, today: date) -> float:
    recent_start = today - timedelta(days=6)
    recent_entries = [
        entry
        for entry in entries
        if entry.habit_id == habit_id and entry.entry_date >= recent_start
    ]
    if not recent_entries:
        return 0.0
    completed = sum(1 for entry in recent_entries if entry.status in COMPLETION_STATUSES)
    return completed / len(recent_entries)


def _habit_consecutive_missed(entries: list[HabitEntry], habit_id: int) -> int:
    missed = 0
    for entry in reversed(sorted(_habit_entries(entries, habit_id), key=lambda item: item.entry_date)):
        if entry.status == "missed":
            missed += 1
            continue
        if entry.status in COMPLETION_STATUSES:
            break
    return missed


def calculate_streak_state(
    active_days: set[date],
    *,
    today: date,
    scheduled_today: int,
) -> tuple[int, int, str]:
    if not active_days:
        return 0, 0, "empty"

    sorted_days = sorted(active_days)
    longest = 1
    running = 1
    for index in range(1, len(sorted_days)):
        if sorted_days[index] == sorted_days[index - 1] + timedelta(days=1):
            running += 1
        else:
            running = 1
        longest = max(longest, running)

    yesterday = today - timedelta(days=1)
    anchor = today if today in active_days else yesterday if yesterday in active_days else None
    current = 0
    if anchor is not None:
        cursor = anchor
        while cursor in active_days:
            current += 1
            cursor -= timedelta(days=1)

    if today in active_days:
        had_older_activity = any(day < yesterday for day in active_days)
        status = "restored" if yesterday not in active_days and had_older_activity else "active"
    elif current > 0 and scheduled_today > 0:
        status = "at_risk"
    elif current > 0:
        status = "active"
    else:
        status = "at_risk" if scheduled_today > 0 else "empty"

    return current, longest, status


def collect_gamification_metrics(
    db: Session,
    user: User,
    today: Optional[date] = None,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    now = now or utc_now()
    today = today or now.date()
    schedule_now = now if now.date() == today else utc_start_of_day(today)
    week_start = today - timedelta(days=today.weekday())
    recent_start = today - timedelta(days=6)
    habits = list(db.scalars(select(Habit).where(Habit.user_id == user.id)))
    active_habits = [habit for habit in habits if habit.is_active]
    entries = list(
        db.scalars(
            select(HabitEntry)
            .where(HabitEntry.user_id == user.id)
            .order_by(HabitEntry.entry_date, HabitEntry.id)
        )
    )
    completed_entries = [entry for entry in entries if entry.status in COMPLETION_STATUSES]
    missed_entries = [entry for entry in entries if entry.status == "missed"]
    active_days = {entry.entry_date for entry in completed_entries}
    completed_today_ids = {
        entry.habit_id for entry in completed_entries if entry.entry_date == today
    }
    scheduled_today_ids = {
        habit.id
        for habit in active_habits
        if is_habit_available_at(habit, schedule_now)
        or (habit.id in completed_today_ids and is_habit_scheduled_on(habit, today))
    }
    current_streak, longest_streak, streak_status = calculate_streak_state(
        active_days,
        today=today,
        scheduled_today=len(scheduled_today_ids),
    )
    recommendations_read_current_week = int(
        db.scalar(
            select(func.count(RewardEvent.id)).where(
                RewardEvent.user_id == user.id,
                RewardEvent.event_type == "recommendation_read",
                RewardEvent.created_at >= utc_start_of_day(week_start),
            )
        )
        or 0
    )
    recommendations_read_count = int(
        db.scalar(
            select(func.count(Recommendation.id)).where(
                Recommendation.user_id == user.id,
                Recommendation.is_read.is_(True),
            )
        )
        or 0
    )
    missed_last_7_days = sum(1 for entry in missed_entries if entry.entry_date >= recent_start)
    entries_last_7_days = [entry for entry in entries if entry.entry_date >= recent_start]
    completed_last_7_days = sum(1 for entry in completed_entries if entry.entry_date >= recent_start)
    completed_current_week = sum(
        1 for entry in completed_entries if week_start <= entry.entry_date <= today
    )
    recovery_mode = missed_last_7_days >= 3 or any(
        shouldActivateRecoveryMode(
            {
                "completion_rate_last_7": _habit_completion_rate_last_7(entries, habit.id, today),
                "total_last_7_days": _habit_entry_count_last_7(entries, habit.id, today),
                "consecutive_missed": _habit_consecutive_missed(entries, habit.id),
            },
            0,
        )
        for habit in active_habits
    )

    seen_miss = False
    recovered_after_miss = 0
    for entry in entries:
        if entry.status == "missed":
            seen_miss = True
        elif entry.status in COMPLETION_STATUSES and seen_miss:
            recovered_after_miss = 1
            break

    return {
        "total_habits": len(habits),
        "active_habits": len(active_habits),
        "completed_count": len(completed_entries),
        "missed_count": len(missed_entries),
        "completed_today": len(completed_today_ids),
        "scheduled_today": len(scheduled_today_ids),
        "completed_scheduled_today": len(completed_today_ids & scheduled_today_ids),
        "completed_last_7_days": completed_last_7_days,
        "missed_last_7_days": missed_last_7_days,
        "total_last_7_days": len(entries_last_7_days),
        "completed_current_week": completed_current_week,
        "recommendations_read_count": recommendations_read_count,
        "recommendations_read_current_week": recommendations_read_current_week,
        "route_completion_days": int(
            bool(scheduled_today_ids) and scheduled_today_ids.issubset(completed_today_ids)
        ),
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "last_active_date": max(active_days) if active_days else None,
        "streak_status": streak_status,
        "recovered_after_miss": recovered_after_miss,
        "recovery_mode": recovery_mode,
    }
