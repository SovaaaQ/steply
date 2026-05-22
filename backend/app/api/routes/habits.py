from __future__ import annotations

from datetime import date
from typing import Any, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_client_today, get_current_user
from app.db.session import get_db
from app.models import Habit, HabitEntry, RewardEvent, User
from app.schemas import HabitCreate, HabitEntryCreate, HabitEntryRead, HabitRead, HabitUpdate
from app.services.gamification import refresh_user_gamification, sync_habit_entry_reward
from app.services.habit_schedule import is_habit_scheduled_on

router = APIRouter(prefix="/habits", tags=["habits"])


def _get_user_habit(db: Session, user: User, habit_id: int) -> Habit:
    habit = db.get(Habit, habit_id)
    if not habit or habit.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")
    return habit


def _has_configured_pet(user: User) -> bool:
    return bool(user.pet_type and user.pet_name)


WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _normalize_day_key(day: Any) -> Optional[str]:
    if isinstance(day, int) and 0 <= day <= 6:
        return WEEKDAY_KEYS[day]
    if isinstance(day, str):
        value = day.strip().lower()
        if value.isdigit():
            return _normalize_day_key(int(value))
        if value in WEEKDAY_KEYS:
            return value
    return None


def _normalize_schedule_days(payload: Union[HabitCreate, HabitUpdate]) -> Optional[list[str]]:
    schedule_days = getattr(payload, "schedule_days", None)
    frequency_type = getattr(payload, "frequency_type", None)
    if schedule_days:
        normalized = {_normalize_day_key(day) for day in schedule_days}
        return [day for day in WEEKDAY_KEYS if day in normalized]
    if frequency_type == "daily":
        return list(WEEKDAY_KEYS)
    return schedule_days


def _normalize_habit_for_response(habit: Habit) -> Habit:
    habit.schedule_days = _normalize_schedule_days(habit) or []
    return habit


def _build_entry_meta(
    habit: Habit,
    payload: HabitEntryCreate,
    previous_meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    meta = {**(previous_meta or {}), "source": "manual"}
    meta.pop("late_completion", None)
    if payload.client_time is not None:
        meta["client_time"] = payload.client_time.isoformat()
    if (
        payload.status in {"completed", "recovery_completed"}
        and habit.preferred_time is not None
        and payload.client_time is not None
        and payload.client_time > habit.preferred_time
    ):
        meta["late_completion"] = True
    return meta


@router.get("", response_model=list[HabitRead])
def list_habits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Habit]:
    habit_rows = db.scalars(
        select(Habit)
        .where(Habit.user_id == current_user.id)
        .order_by(Habit.is_active.desc(), Habit.created_at.desc())
    )
    return [
        _normalize_habit_for_response(habit)
        for habit in habit_rows
    ]


@router.post("", response_model=HabitRead, status_code=status.HTTP_201_CREATED)
def create_habit(
    payload: HabitCreate,
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> Habit:
    if not _has_configured_pet(current_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала выберите питомца",
        )

    data = payload.model_dump()
    data["schedule_days"] = _normalize_schedule_days(payload) or []
    habit = Habit(**data, user_id=current_user.id)
    db.add(habit)
    db.flush()
    refresh_user_gamification(db, current_user, today=client_today)
    db.commit()
    db.refresh(habit)
    return _normalize_habit_for_response(habit)


@router.get("/{habit_id}", response_model=HabitRead)
def get_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Habit:
    return _normalize_habit_for_response(_get_user_habit(db, current_user, habit_id))


@router.put("/{habit_id}", response_model=HabitRead)
def update_habit(
    habit_id: int,
    payload: HabitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Habit:
    habit = _get_user_habit(db, current_user, habit_id)
    updates = payload.model_dump(exclude_unset=True)
    if "schedule_days" in updates:
        updates["schedule_days"] = _normalize_schedule_days(payload) or []
    for field, value in updates.items():
        setattr(habit, field, value)
    db.commit()
    db.refresh(habit)
    return _normalize_habit_for_response(habit)


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> Response:
    habit = _get_user_habit(db, current_user, habit_id)
    habit_xp_events = db.scalars(
        select(RewardEvent).where(
            RewardEvent.user_id == current_user.id,
            RewardEvent.event_key.like(f"habit_xp:{habit.id}:%"),
        )
    )
    for event in habit_xp_events:
        db.delete(event)
    db.delete(habit)
    db.flush()
    refresh_user_gamification(db, current_user, today=client_today)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{habit_id}/entries", response_model=HabitEntryRead)
def upsert_habit_entry(
    habit_id: int,
    payload: HabitEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HabitEntry:
    habit = _get_user_habit(db, current_user, habit_id)
    entry_date = payload.entry_date
    if not is_habit_scheduled_on(habit, entry_date):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Привычка не запланирована на выбранную дату",
        )

    entry = db.scalar(
        select(HabitEntry).where(
            HabitEntry.habit_id == habit.id,
            HabitEntry.user_id == current_user.id,
            HabitEntry.entry_date == entry_date,
        )
    )
    if entry:
        entry.status = payload.status
        entry.note = payload.note
        entry.completion_value = payload.completion_value
        entry.meta = _build_entry_meta(habit, payload, entry.meta)
    else:
        entry = HabitEntry(
            habit_id=habit.id,
            user_id=current_user.id,
            entry_date=entry_date,
            status=payload.status,
            note=payload.note,
            completion_value=payload.completion_value,
            meta=_build_entry_meta(habit, payload),
        )
        db.add(entry)

    db.flush()
    sync_habit_entry_reward(db, current_user, habit, entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{habit_id}/entries", response_model=list[HabitEntryRead])
def list_habit_entries(
    habit_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[HabitEntry]:
    habit = _get_user_habit(db, current_user, habit_id)
    query = select(HabitEntry).where(
        HabitEntry.habit_id == habit.id,
        HabitEntry.user_id == current_user.id,
    )
    if date_from:
        query = query.where(HabitEntry.entry_date >= date_from)
    if date_to:
        query = query.where(HabitEntry.entry_date <= date_to)
    return list(db.scalars(query.order_by(HabitEntry.entry_date.desc())))
