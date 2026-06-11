from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.time import utc_now
from app.models import Goal, User, UserGoalProgress

from .rewards import award_xp_once


def get_goal_period_key(goal_type: str, today: date) -> str:
    if goal_type == "onboarding":
        return "onboarding"
    if goal_type == "weekly":
        iso_year, iso_week, _ = today.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    return today.isoformat()


def sync_goals(
    db: Session,
    user: User,
    metrics: dict[str, Any],
    *,
    today: date,
    award_rewards: bool = True,
) -> None:
    goals = list(
        db.scalars(
            select(Goal)
            .where(Goal.is_active.is_(True))
            .order_by(Goal.sort_order)
        )
    )
    now = utc_now()
    for goal in goals:
        if goal.active_when == "recovery_mode" and not metrics["recovery_mode"]:
            continue

        period_key = get_goal_period_key(goal.type, today)
        target = int(metrics.get(goal.target_metric, goal.target) or goal.target)
        target = max(target, goal.target)
        progress = min(int(metrics.get(goal.metric, 0) or 0), target)
        is_empty = goal.id == "daily_route" and int(metrics["scheduled_today"]) == 0

        goal_progress = db.scalar(
            select(UserGoalProgress).where(
                UserGoalProgress.user_id == user.id,
                UserGoalProgress.goal_id == goal.id,
                UserGoalProgress.period_key == period_key,
            )
        )
        if goal_progress is None:
            goal_progress = UserGoalProgress(
                user_id=user.id,
                goal_id=goal.id,
                period_key=period_key,
                target=target,
            )
            db.add(goal_progress)

        goal_progress.target = target
        goal_progress.progress = max(goal_progress.progress or 0, progress)
        if (
            not is_empty
            and goal_progress.status != "completed"
            and progress >= target
        ):
            reward = (
                award_xp_once(
                    db,
                    user,
                    event_type="goal_completed",
                    event_key=f"goal:{goal.id}:{period_key}",
                    xp_amount=goal.reward_xp,
                    description=f"Цель: {goal.title}",
                    source_type="goal",
                    source_id=goal.id,
                    meta={"period_key": period_key, "type": goal.type},
                )
                if award_rewards
                else None
            )
            goal_progress.status = "completed"
            goal_progress.completed_at = now
            if reward is not None:
                goal_progress.reward_event_id = reward.id
        elif goal_progress.status != "completed":
            goal_progress.status = "empty" if is_empty else "active"


def build_goal_items(
    db: Session,
    user: User,
    metrics: dict[str, Any],
    today: date,
) -> list[dict[str, Any]]:
    goals = list(
        db.scalars(
            select(Goal)
            .where(Goal.is_active.is_(True))
            .order_by(Goal.sort_order)
        )
    )
    items: list[dict[str, Any]] = []
    for goal in goals:
        if goal.active_when == "recovery_mode" and not metrics["recovery_mode"]:
            continue

        period_key = get_goal_period_key(goal.type, today)
        target = int(metrics.get(goal.target_metric, goal.target) or goal.target)
        target = max(target, goal.target)
        fallback_progress = min(int(metrics.get(goal.metric, 0) or 0), target)
        progress = db.scalar(
            select(UserGoalProgress).where(
                UserGoalProgress.user_id == user.id,
                UserGoalProgress.goal_id == goal.id,
                UserGoalProgress.period_key == period_key,
            )
        )
        current = max(progress.progress, fallback_progress) if progress else fallback_progress
        status = progress.status if progress else "active"
        is_empty = goal.id == "daily_route" and int(metrics["scheduled_today"]) == 0
        if is_empty:
            status = "empty"
        items.append(
            {
                "id": goal.id,
                "type": goal.type,
                "tone": goal.tone,
                "title": goal.title,
                "description": goal.description,
                "progress": min(current, target),
                "target": target,
                "reward_xp": goal.reward_xp,
                "status": status,
                "period_key": period_key,
                "cta_label": goal.cta_label,
                "cta_section": goal.cta_section,
                "next_step": goal.next_step,
                "completed_at": progress.completed_at if progress else None,
                "empty": is_empty,
            }
        )
    return items
