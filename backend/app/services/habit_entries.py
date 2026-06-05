from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.orm import Session

from app.core.gamification_rules import COMPLETION_STATUSES
from app.models import Habit, HabitEntry, User
from app.schemas import HabitEntryCreate
from app.services.habit_schedule import is_habit_scheduled_on


AUTO_MISSED_META = {"source": "auto", "auto_missed": True}


def normalize_created_rowcount(rowcount: int | None, pending_count: int) -> int:
    if rowcount is None or rowcount < 0:
        return pending_count
    return rowcount


def _is_deferred_creation_date(habit: Habit, target_date: date) -> bool:
    return bool(
        habit.created_at
        and habit.preferred_time is not None
        and habit.created_at.date() == target_date
        and habit.created_at.time() > habit.preferred_time
    )


def get_auto_missed_dates(
    habit: Habit,
    today: date,
    existing_dates: set[date],
) -> list[date]:
    end_date = today - timedelta(days=1)
    if habit.created_at is None or habit.created_at.date() > end_date:
        return []

    missed_dates: list[date] = []
    cursor = habit.created_at.date()
    while cursor <= end_date:
        if (
            cursor not in existing_dates
            and is_habit_scheduled_on(habit, cursor)
            and not _is_deferred_creation_date(habit, cursor)
        ):
            missed_dates.append(cursor)
        cursor += timedelta(days=1)
    return missed_dates


def ensure_auto_missed_entries(
    db: Session,
    user: User,
    today: date,
    *,
    habit: Optional[Habit] = None,
) -> int:
    habits = [habit] if habit is not None else list(
        db.scalars(
            select(Habit).where(
                Habit.user_id == user.id,
                Habit.is_active.is_(True),
            )
        )
    )
    end_date = today - timedelta(days=1)
    created_count = 0
    pending_entries: list[dict[str, object]] = []

    for current_habit in habits:
        if current_habit.user_id != user.id or not current_habit.is_active:
            continue
        if current_habit.created_at is None or current_habit.created_at.date() > end_date:
            continue

        start_date = current_habit.created_at.date()
        existing_dates = set(
            db.scalars(
                select(HabitEntry.entry_date).where(
                    HabitEntry.habit_id == current_habit.id,
                    HabitEntry.user_id == user.id,
                    HabitEntry.entry_date >= start_date,
                    HabitEntry.entry_date <= end_date,
                )
            )
        )

        for missed_date in get_auto_missed_dates(current_habit, today, existing_dates):
            pending_entries.append(
                {
                    "habit_id": current_habit.id,
                    "user_id": user.id,
                    "entry_date": missed_date,
                    "status": "missed",
                    "meta": dict(AUTO_MISSED_META),
                }
            )
            existing_dates.add(missed_date)

    if not pending_entries:
        return 0

    if db.get_bind().dialect.name == "postgresql":
        result = db.execute(
            postgres_insert(HabitEntry)
            .values(pending_entries)
            .on_conflict_do_nothing(constraint="uq_habit_entry_date")
        )
        created_count = normalize_created_rowcount(result.rowcount, len(pending_entries))
    else:
        for entry_data in pending_entries:
            db.add(HabitEntry(**entry_data))
        created_count = len(pending_entries)

    if pending_entries:
        db.flush()
    return created_count


def validate_entry_transition(
    *,
    existing: Optional[HabitEntry],
    payload: HabitEntryCreate,
    client_today: date,
) -> None:
    if payload.entry_date > client_today:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя отметить привычку за будущую дату",
        )

    if payload.status == "missed" and payload.entry_date >= client_today:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пропуск появится сам после конца дня",
        )

    if payload.status in COMPLETION_STATUSES and payload.entry_date < client_today:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Отметить выполнение можно только за сегодня",
        )

    if existing is None or existing.status == payload.status:
        return

    if existing.status in COMPLETION_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Сегодня уже учтено, пропуск недоступен",
        )

    if existing.status == "missed" and payload.status in COMPLETION_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Этот день уже отмечен как пропуск",
        )

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Этот день уже отмечен",
    )
