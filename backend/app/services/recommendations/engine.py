from __future__ import annotations

from collections.abc import Iterable, Sequence
from datetime import date, datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.time import utc_now, utc_start_of_day
from app.models import Habit, Prediction, Recommendation, User
from app.services.ai_recommendations import generate_ai_recommendation
from app.services.predictive import create_prediction

from .constants import _AI_SCENARIO_TYPES, _PRIORITY_WEIGHT
from .copy import (
    _build_recommendation_text,
    _feature_int,
    _feature_float,
    _normalize_recommendation,
    _normalize_recommendation_message,
)


def _day_start(today: date) -> datetime:
    return utc_start_of_day(today)


def _created_timestamp(recommendation: Recommendation) -> float:
    return recommendation.created_at.timestamp() if recommendation.created_at else 0


def _recommendation_display_key(recommendation: Recommendation) -> tuple[bool, int, float, int]:
    return (
        bool(recommendation.is_read),
        -_PRIORITY_WEIGHT.get(recommendation.priority, 0),
        -_created_timestamp(recommendation),
        -(recommendation.id or 0),
    )


def _select_current_recommendations(
    candidates: Sequence[Recommendation],
    active_habit_ids: Iterable[int],
) -> list[Recommendation]:
    active_ids = set(active_habit_ids)
    latest_by_key: dict[tuple[str, int | str], Recommendation] = {}

    for recommendation in sorted(
        candidates,
        key=lambda item: (_created_timestamp(item), item.id or 0),
        reverse=True,
    ):
        if recommendation.habit_id is not None and recommendation.habit_id not in active_ids:
            continue

        key: tuple[str, int | str]
        if recommendation.habit_id is None:
            key = ("general", recommendation.type)
        else:
            key = ("habit", recommendation.habit_id)

        if key not in latest_by_key:
            latest_by_key[key] = recommendation

    selected = sorted(latest_by_key.values(), key=_recommendation_display_key)
    for recommendation in selected:
        _normalize_recommendation(recommendation)
    return selected


def list_current_recommendations(
    db: Session,
    user: User,
    active_habit_ids: Iterable[int] | None = None,
) -> list[Recommendation]:
    if active_habit_ids is None:
        active_habit_ids = db.scalars(
            select(Habit.id).where(Habit.user_id == user.id, Habit.is_active.is_(True))
        )

    candidates = list(
        db.scalars(
            select(Recommendation)
            .where(Recommendation.user_id == user.id)
            .order_by(Recommendation.created_at.desc())
        )
    )
    return _select_current_recommendations(candidates, active_habit_ids)


def _is_ai_worthwhile(rec_type: str, prediction: Prediction) -> bool:
    if rec_type in _AI_SCENARIO_TYPES:
        return True

    features = prediction.features or {}
    total_entries = _feature_int(features, "total_entries")
    if total_entries < 3:
        return False

    consecutive_missed = _feature_int(features, "consecutive_missed")
    recent_miss_rate = _feature_float(features, "recent_miss_rate")
    return (
        prediction.risk_level in {"medium", "high"}
        or rec_type
        in {
            "recovery_mode",
            "reduce_difficulty",
            "soft_reminder",
            "restore_regular_activity",
        }
        or consecutive_missed > 0
        or recent_miss_rate >= 0.2
    )


def _daily_ai_budget_available(db: Session, user: User, today: date) -> bool:
    limit = max(0, get_settings().ai_daily_recommendation_limit)
    if limit == 0:
        return False

    created_today = list(
        db.scalars(
            select(Recommendation).where(
                Recommendation.user_id == user.id,
                Recommendation.created_at >= _day_start(today),
            )
        )
    )
    return len(created_today) < limit


def _upsert_recommendation(
    db: Session,
    user: User,
    habit: Habit,
    prediction: Prediction,
    today: date,
    active_habit_count: int,
    force_ai: bool,
) -> Recommendation:
    existing = db.scalar(
        select(Recommendation).where(
            Recommendation.user_id == user.id,
            Recommendation.habit_id == habit.id,
        ).order_by(Recommendation.created_at.desc())
    )
    rec_type, title, message, priority = _build_recommendation_text(
        user,
        habit,
        prediction,
        active_habit_count,
        previous_type=existing.type if existing else None,
    )
    message = _normalize_recommendation_message(message)
    ai_source = "not_requested"

    should_use_ai = force_ai or (
        _is_ai_worthwhile(rec_type, prediction)
        and _daily_ai_budget_available(
            db,
            user,
            today,
        )
    )
    if should_use_ai:
        ai_source = "heuristic"
        ai_draft = generate_ai_recommendation(
            habit=habit,
            prediction=prediction,
            today=today,
            base_type=rec_type,
            base_title=title,
            base_message=message,
            user=user,
            refresh_mode="manual_refresh" if force_ai else "auto",
            variation_seed=(
                f"{today.isoformat()}:{habit.id}:{utc_now().isoformat()}"
                if force_ai
                else None
            ),
        )
        if ai_draft:
            title = ai_draft.title
            message = _normalize_recommendation_message(ai_draft.message)
            ai_source = "bothub"

    if existing:
        existing.prediction_id = prediction.id
        existing.type = rec_type
        existing.title = title
        existing.message = message
        existing.priority = priority
        existing.is_read = False
        existing.created_at = utc_now()
        db.flush()
        db.refresh(existing)
        existing.ai_source = ai_source
        return existing

    recommendation = Recommendation(
        user_id=user.id,
        habit_id=habit.id,
        prediction_id=prediction.id,
        type=rec_type,
        title=title,
        message=message,
        priority=priority,
    )
    db.add(recommendation)
    db.flush()
    db.refresh(recommendation)
    recommendation.ai_source = ai_source
    return recommendation


def generate_recommendations(
    db: Session,
    user: User,
    today: Optional[date] = None,
    *,
    force_ai: bool = False,
) -> list[Recommendation]:
    today = today or date.today()
    habits = list(
        db.scalars(
            select(Habit)
            .where(Habit.user_id == user.id, Habit.is_active.is_(True))
            .order_by(Habit.created_at.desc())
        )
    )
    recommendations: list[Recommendation] = []
    for habit in habits:
        prediction = create_prediction(db, user, habit, today)
        recommendations.append(
            _upsert_recommendation(
                db,
                user,
                habit,
                prediction,
                today,
                len(habits),
                force_ai,
            )
        )
    return recommendations
