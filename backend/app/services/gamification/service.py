from __future__ import annotations

from datetime import date
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.core.gamification_rules import calculatePetState
from app.models import User, UserGamificationProfile

from .achievements import sync_achievements
from .goals import sync_goals
from .metrics import collect_gamification_metrics
from .rewards import _has_configured_pet, get_or_create_profile, sync_profile_xp
from .summary import build_gamification_summary


def refresh_user_gamification(
    db: Session,
    user: User,
    *,
    award_milestones: bool = True,
    today: Optional[date] = None,
) -> dict[str, Any]:
    profile = get_or_create_profile(db, user)
    metrics_today = today or date.today()
    metrics = collect_gamification_metrics(db, user, today=metrics_today)
    can_award_milestones = award_milestones and _has_configured_pet(user)
    user.pet_state = calculatePetState(
        {
            "completed_last_7_days": metrics["completed_last_7_days"],
            "missed_last_7_days": metrics["missed_last_7_days"],
        }
    )
    profile.current_streak = int(metrics["current_streak"])
    profile.longest_streak = int(metrics["longest_streak"])
    profile.last_active_date = metrics["last_active_date"]
    profile.streak_status = str(metrics["streak_status"])

    sync_achievements(db, user, metrics, award_rewards=can_award_milestones)
    sync_goals(db, user, metrics, today=metrics_today, award_rewards=can_award_milestones)
    sync_profile_xp(db, user, profile)
    db.flush()
    return build_gamification_summary(db, user, profile, metrics, metrics_today)


def read_user_gamification_summary(
    db: Session,
    user: User,
    *,
    today: Optional[date] = None,
) -> dict[str, Any]:
    profile = db.get(UserGamificationProfile, user.id)
    if profile is None:
        profile = UserGamificationProfile(
            user_id=user.id,
            total_xp=user.experience_points,
            level=user.level,
        )
    metrics_today = today or date.today()
    metrics = collect_gamification_metrics(db, user, today=metrics_today)
    return build_gamification_summary(db, user, profile, metrics, metrics_today)
