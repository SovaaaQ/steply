from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.gamification_rules import get_level_state
from app.models import RewardEvent, User, UserGamificationProfile


def get_or_create_profile(db: Session, user: User) -> UserGamificationProfile:
    profile = db.get(UserGamificationProfile, user.id)
    if profile is None:
        profile = UserGamificationProfile(user_id=user.id)
        db.add(profile)
        db.flush()

    existing_events = db.scalar(
        select(func.count(RewardEvent.id)).where(RewardEvent.user_id == user.id)
    )
    if not existing_events and user.experience_points > 0:
        db.add(
            RewardEvent(
                user_id=user.id,
                event_type="legacy_xp_import",
                event_key="legacy_xp_import",
                xp_amount=user.experience_points,
                description="Перенос ранее начисленного опыта",
                source_type="user",
                source_id=str(user.id),
                meta={"source": "legacy_user_fields"},
            )
        )
        db.flush()

    return profile


def award_xp_once(
    db: Session,
    user: User,
    *,
    event_type: str,
    event_key: str,
    xp_amount: int,
    description: str,
    source_type: Optional[str] = None,
    source_id: Optional[str] = None,
    meta: Optional[dict[str, Any]] = None,
) -> Optional[RewardEvent]:
    existing = db.scalar(
        select(RewardEvent).where(
            RewardEvent.user_id == user.id,
            RewardEvent.event_key == event_key,
        )
    )
    if existing is not None:
        return None

    event = RewardEvent(
        user_id=user.id,
        event_type=event_type,
        event_key=event_key,
        xp_amount=xp_amount,
        description=description,
        source_type=source_type,
        source_id=source_id,
        meta=meta or {},
    )
    db.add(event)
    db.flush()
    return event


def _has_configured_pet(user: User) -> bool:
    return bool(user.pet_type and user.pet_name)


def sync_profile_xp(db: Session, user: User, profile: UserGamificationProfile) -> None:
    total_xp = int(
        db.scalar(
            select(func.coalesce(func.sum(RewardEvent.xp_amount), 0)).where(
                RewardEvent.user_id == user.id
            )
        )
        or 0
    )
    total_xp = max(total_xp, 0)
    level_state = get_level_state(total_xp)
    profile.total_xp = total_xp
    profile.level = int(level_state["level"])
    user.experience_points = total_xp
    user.level = int(level_state["level"])


def reward_event_to_dict(event: RewardEvent) -> dict[str, Any]:
    return {
        "id": event.id,
        "event_type": event.event_type,
        "xp_amount": event.xp_amount,
        "description": event.description,
        "source_type": event.source_type,
        "source_id": event.source_id,
        "created_at": event.created_at,
        "meta": event.meta,
    }
