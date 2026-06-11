from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.time import utc_now
from app.models import Achievement, User, UserAchievement

from .rewards import award_xp_once


def sync_achievements(
    db: Session,
    user: User,
    metrics: dict[str, Any],
    *,
    award_rewards: bool = True,
) -> None:
    achievements = list(
        db.scalars(
            select(Achievement)
            .where(Achievement.is_active.is_(True))
            .order_by(Achievement.sort_order)
        )
    )
    now = utc_now()
    for achievement in achievements:
        progress = min(int(metrics.get(achievement.metric, 0) or 0), achievement.target)
        user_achievement = db.scalar(
            select(UserAchievement).where(
                UserAchievement.user_id == user.id,
                UserAchievement.achievement_id == achievement.id,
            )
        )
        if user_achievement is None:
            user_achievement = UserAchievement(
                user_id=user.id,
                achievement_id=achievement.id,
                target=achievement.target,
            )
            db.add(user_achievement)

        user_achievement.target = achievement.target
        user_achievement.progress = max(user_achievement.progress or 0, progress)
        if user_achievement.unlocked_at is None and progress >= achievement.target:
            reward = (
                award_xp_once(
                    db,
                    user,
                    event_type="achievement_unlocked",
                    event_key=f"achievement:{achievement.id}",
                    xp_amount=achievement.reward_xp,
                    description=f"Достижение: {achievement.title}",
                    source_type="achievement",
                    source_id=achievement.id,
                    meta={"category": achievement.category},
                )
                if award_rewards
                else None
            )
            user_achievement.unlocked_at = now
            if reward is not None:
                user_achievement.reward_event_id = reward.id


def build_achievement_items(db: Session, user: User) -> list[dict[str, Any]]:
    rows = db.execute(
        select(Achievement, UserAchievement)
        .join(
            UserAchievement,
            (UserAchievement.achievement_id == Achievement.id)
            & (UserAchievement.user_id == user.id),
            isouter=True,
        )
        .where(Achievement.is_active.is_(True))
        .order_by(Achievement.sort_order)
    ).all()
    items: list[dict[str, Any]] = []
    for achievement, progress in rows:
        current = progress.progress if progress else 0
        unlocked_at = progress.unlocked_at if progress else None
        items.append(
            {
                "id": achievement.id,
                "title": achievement.title,
                "description": achievement.description,
                "category": achievement.category,
                "icon": achievement.icon,
                "progress": min(current, achievement.target),
                "target": achievement.target,
                "reward_xp": achievement.reward_xp,
                "unlocked": unlocked_at is not None,
                "unlocked_at": unlocked_at,
            }
        )
    return items
