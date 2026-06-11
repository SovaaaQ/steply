from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.gamification_rules import XP_REWARDS, getRecoveryTask, getXPForCompletion
from app.models import Habit, HabitEntry, Recommendation, RewardEvent, User, XPHistory

from .rewards import _has_configured_pet, award_xp_once
from .service import refresh_user_gamification


def _set_recovery_metadata(entry: HabitEntry, habit: Habit) -> None:
    entry.meta = {
        **(entry.meta or {}),
        "recovery_task": getRecoveryTask(habit),
        "support_message": "Минимальная версия засчитана. Ритм можно продолжать.",
    }


def _sync_habit_reward_event(
    db: Session,
    user: User,
    habit: Habit,
    entry: HabitEntry,
    *,
    event_key: str,
    reason: str,
    description: str,
    xp_amount: int,
) -> None:
    meta = {
        "habit_id": habit.id,
        "habit_title": habit.title,
        "entry_date": entry.entry_date.isoformat(),
        "status": entry.status,
        "reason": reason,
    }
    event = db.scalar(
        select(RewardEvent).where(
            RewardEvent.user_id == user.id,
            RewardEvent.event_key == event_key,
        )
    )
    if event is None:
        award_xp_once(
            db,
            user,
            event_type=reason,
            event_key=event_key,
            xp_amount=xp_amount,
            description=description,
            source_type="habit_entry",
            source_id=str(entry.id),
            meta=meta,
        )
        return

    event.event_type = reason
    event.xp_amount = xp_amount
    event.description = description
    event.source_id = str(entry.id)
    event.meta = meta


def sync_habit_entry_reward(db: Session, user: User, habit: Habit, entry: HabitEntry) -> None:
    existing_history = db.scalar(
        select(XPHistory).where(
            XPHistory.user_id == user.id,
            XPHistory.habit_id == habit.id,
            XPHistory.entry_date == entry.entry_date,
        )
    )
    event_key = f"habit_xp:{habit.id}:{entry.entry_date.isoformat()}"

    if not _has_configured_pet(user):
        if existing_history is not None:
            db.delete(existing_history)
            existing_event = db.scalar(
                select(RewardEvent).where(
                    RewardEvent.user_id == user.id,
                    RewardEvent.event_key == event_key,
                )
            )
            if existing_event is not None:
                db.delete(existing_event)
        entry.xp_awarded = 0
        refresh_user_gamification(db, user, today=entry.entry_date)
        return

    xp_amount = getXPForCompletion(entry.status, habit.difficulty)

    if xp_amount <= 0:
        if existing_history is not None:
            db.delete(existing_history)
            existing_event = db.scalar(
                select(RewardEvent).where(
                    RewardEvent.user_id == user.id,
                    RewardEvent.event_key == event_key,
                )
            )
            if existing_event is not None:
                db.delete(existing_event)
        entry.xp_awarded = 0
        refresh_user_gamification(db, user, today=entry.entry_date)
        return

    reason = "recovery_completed" if entry.status == "recovery_completed" else "completed_on_time"
    description = (
        str(XP_REWARDS["habit_recovery_completed"]["description"])
        if reason == "recovery_completed"
        else str(XP_REWARDS["habit_completed"]["description"])
    )
    if existing_history is not None:
        existing_history.completion_id = entry.id
        existing_history.xp_amount = xp_amount
        existing_history.reason = reason
        entry.xp_awarded = xp_amount
        _sync_habit_reward_event(
            db,
            user,
            habit,
            entry,
            event_key=event_key,
            reason=reason,
            description=description,
            xp_amount=xp_amount,
        )
        if entry.status == "recovery_completed":
            _set_recovery_metadata(entry, habit)
        refresh_user_gamification(db, user, today=entry.entry_date)
        return

    history = XPHistory(
        user_id=user.id,
        habit_id=habit.id,
        completion_id=entry.id,
        entry_date=entry.entry_date,
        xp_amount=xp_amount,
        reason=reason,
    )
    db.add(history)
    entry.xp_awarded = xp_amount
    if entry.status == "recovery_completed":
        _set_recovery_metadata(entry, habit)
    _sync_habit_reward_event(
        db,
        user,
        habit,
        entry,
        event_key=event_key,
        reason=reason,
        description=description,
        xp_amount=xp_amount,
    )

    refresh_user_gamification(db, user, today=entry.entry_date)


def record_recommendation_read(
    db: Session,
    user: User,
    recommendation: Recommendation,
    today: Optional[date] = None,
) -> None:
    rule = XP_REWARDS["recommendation_read"]
    award_xp_once(
        db,
        user,
        event_type="recommendation_read",
        event_key=f"recommendation_read:{recommendation.id}",
        xp_amount=int(rule["xp"]),
        description=str(rule["description"]),
        source_type="recommendation",
        source_id=str(recommendation.id),
        meta={"recommendation_type": recommendation.type},
    )
    refresh_user_gamification(db, user, today=today)
