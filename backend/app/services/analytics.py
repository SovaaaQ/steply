from datetime import date, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Habit, HabitEntry, User
from app.schemas import HabitStats, UserActivitySummary
from app.core.gamification_rules import (
    COMPLETION_STATUSES,
    getRecoveryTask,
    shouldActivateRecoveryMode,
)


WEEKDAY_LABELS = {
    0: "Пн",
    1: "Вт",
    2: "Ср",
    3: "Чт",
    4: "Пт",
    5: "Сб",
    6: "Вс",
}


def _calculate_streaks(entries: list[HabitEntry]) -> tuple[int, int]:
    if not entries:
        return 0, 0

    sorted_entries = sorted(entries, key=lambda item: item.entry_date)
    longest = 0
    running = 0
    for entry in sorted_entries:
        if entry.status in COMPLETION_STATUSES:
            running += 1
            longest = max(longest, running)
        else:
            running = 0

    current = 0
    for entry in reversed(sorted_entries):
        if entry.status in COMPLETION_STATUSES:
            current += 1
        else:
            break
    return current, longest


def _calculate_consecutive_missed(entries: list[HabitEntry]) -> int:
    missed = 0
    for entry in reversed(sorted(entries, key=lambda item: item.entry_date)):
        if entry.status == "missed":
            missed += 1
            continue
        if entry.status in COMPLETION_STATUSES:
            break
    return missed


def get_entries_for_habit(db: Session, habit_id: int, user_id: int) -> list[HabitEntry]:
    return list(
        db.scalars(
            select(HabitEntry)
            .where(HabitEntry.habit_id == habit_id, HabitEntry.user_id == user_id)
            .order_by(HabitEntry.entry_date)
        )
    )


def calculate_habit_stats(
    db: Session,
    habit: Habit,
    today: Optional[date] = None,
) -> HabitStats:
    today = today or date.today()
    entries = get_entries_for_habit(db, habit.id, habit.user_id)
    completed_count = sum(1 for entry in entries if entry.status in COMPLETION_STATUSES)
    missed_count = sum(1 for entry in entries if entry.status == "missed")
    total_entries = len(entries)
    completion_rate = completed_count / total_entries if total_entries else 0.0
    recent_start = today - timedelta(days=6)
    recent_entries = [entry for entry in entries if entry.entry_date >= recent_start]
    completed_last_7_days = sum(
        1 for entry in recent_entries if entry.status in COMPLETION_STATUSES
    )
    missed_last_7_days = sum(1 for entry in recent_entries if entry.status == "missed")
    completion_rate_last_7 = (
        completed_last_7_days / len(recent_entries) if recent_entries else 0.0
    )
    consecutive_missed = _calculate_consecutive_missed(entries)
    current_streak, longest_streak = _calculate_streaks(entries)

    last_completed = next(
        (
            entry.entry_date
            for entry in reversed(entries)
            if entry.status in COMPLETION_STATUSES
        ),
        None,
    )
    days_since_last_completion = (
        (today - last_completed).days if last_completed is not None else None
    )

    weekday_success_rates: dict[str, float] = {}
    for weekday, label in WEEKDAY_LABELS.items():
        weekday_entries = [entry for entry in entries if entry.entry_date.weekday() == weekday]
        if not weekday_entries:
            weekday_success_rates[label] = 0.0
            continue
        completed = sum(1 for entry in weekday_entries if entry.status in COMPLETION_STATUSES)
        weekday_success_rates[label] = round(completed / len(weekday_entries), 3)

    recovery_stats = {
        "completion_rate_last_7": completion_rate_last_7,
        "total_last_7_days": len(recent_entries),
        "consecutive_missed": consecutive_missed,
    }

    return HabitStats(
        habit_id=habit.id,
        title=habit.title,
        total_entries=total_entries,
        completed_count=completed_count,
        missed_count=missed_count,
        completion_rate=round(completion_rate, 3),
        completed_last_7_days=completed_last_7_days,
        missed_last_7_days=missed_last_7_days,
        completion_rate_last_7=round(completion_rate_last_7, 3),
        consecutive_missed=consecutive_missed,
        recovery_mode=shouldActivateRecoveryMode(recovery_stats, 0),
        recovery_task=getRecoveryTask(habit),
        current_streak=current_streak,
        longest_streak=longest_streak,
        days_since_last_completion=days_since_last_completion,
        weekday_success_rates=weekday_success_rates,
    )


def calculate_user_activity_summary(
    db: Session,
    user: User,
    today: Optional[date] = None,
) -> UserActivitySummary:
    today = today or date.today()
    habits = list(db.scalars(select(Habit).where(Habit.user_id == user.id)))
    active_habits = [habit for habit in habits if habit.is_active]
    entries = list(db.scalars(select(HabitEntry).where(HabitEntry.user_id == user.id)))
    completed_count = sum(1 for entry in entries if entry.status in COMPLETION_STATUSES)
    missed_count = sum(1 for entry in entries if entry.status == "missed")
    entries_last_7_days = [
        entry for entry in entries if entry.entry_date >= today - timedelta(days=6)
    ]
    entries_last_30_days = [
        entry for entry in entries if entry.entry_date >= today - timedelta(days=29)
    ]
    completed_last_7_days = sum(
        1 for entry in entries_last_7_days if entry.status in COMPLETION_STATUSES
    )
    missed_last_7_days = sum(1 for entry in entries_last_7_days if entry.status == "missed")
    completed_last_30_days = sum(
        1 for entry in entries_last_30_days if entry.status in COMPLETION_STATUSES
    )
    missed_last_30_days = sum(
        1 for entry in entries_last_30_days if entry.status == "missed"
    )
    total_entries = len(entries)
    completion_rate = completed_count / total_entries if total_entries else 0.0

    habit_stats = [calculate_habit_stats(db, habit, today) for habit in active_habits]
    current_streak = max((stats.current_streak for stats in habit_stats), default=0)
    longest_streak = max((stats.longest_streak for stats in habit_stats), default=0)
    average_current_streak = (
        sum(stats.current_streak for stats in habit_stats) / len(habit_stats)
        if habit_stats
        else 0.0
    )
    active_ratio = len(active_habits) / len(habits) if habits else 0.0
    activity_score = min(
        100.0,
        100
        * (
            0.55 * completion_rate
            + 0.25 * min(average_current_streak / 7, 1)
            + 0.20 * active_ratio
        ),
    )

    return UserActivitySummary(
        user_id=user.id,
        total_habits=len(habits),
        active_habits=len(active_habits),
        total_entries=total_entries,
        completed_count=completed_count,
        missed_count=missed_count,
        completed_last_7_days=completed_last_7_days,
        missed_last_7_days=missed_last_7_days,
        completed_last_30_days=completed_last_30_days,
        missed_last_30_days=missed_last_30_days,
        completion_rate=round(completion_rate, 3),
        activity_score=round(activity_score, 1),
        current_streak=current_streak,
        longest_streak=longest_streak,
        average_current_streak=round(average_current_streak, 2),
        experience_points=user.experience_points,
        level=user.level,
        lives=user.lives,
        recovery_mode=missed_last_7_days >= 3
        or any(stats.recovery_mode for stats in habit_stats),
    )
