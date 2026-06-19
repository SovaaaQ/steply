from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.gamification_rules import get_level_state
from app.models import RewardEvent, User, UserGamificationProfile

from .achievements import build_achievement_items
from .goals import build_goal_items
from .rewards import reward_event_to_dict


def build_pet_read(user: User, profile: UserGamificationProfile) -> dict[str, Any]:
    level_state = get_level_state(profile.total_xp)
    return {
        "pet_type": user.pet_type,
        "pet_name": user.pet_name,
        "pet_state": user.pet_state,
        "level": profile.level,
        "xp": profile.total_xp,
        "progress_percent": level_state["progress_percent"],
        "next_level": level_state["next_level"],
        "next_level_xp": level_state["next_level_xp"],
        "xp_to_next_level": level_state["xp_to_next_level"],
        "is_configured": bool(user.pet_type and user.pet_name),
    }


def build_streak_read(
    profile: UserGamificationProfile,
    metrics: dict[str, Any],
) -> dict[str, Any]:
    labels = {
        "empty": "Серия еще не началась",
        "active": "Серия активна",
        "at_risk": "Серия может прерваться",
        "restored": "Серия восстановлена",
    }
    next_steps = {
        "empty": "Создайте привычку и отметьте первый короткий шаг",
        "active": "Поддержите темп одним реальным действием сегодня или завтра",
        "at_risk": "Выберите минимальную версию привычки и вернитесь через короткий шаг",
        "restored": "Закрепите восстановление небольшим повторением в ближайший день",
    }
    return {
        "current": profile.current_streak,
        "best": profile.longest_streak,
        "status": profile.streak_status,
        "label": labels.get(profile.streak_status, labels["empty"]),
        "next_step": next_steps.get(profile.streak_status, next_steps["empty"]),
        "is_at_risk": profile.streak_status == "at_risk",
        "last_active_date": profile.last_active_date,
        "completed_today": metrics["completed_scheduled_today"],
        "scheduled_today": metrics["scheduled_today"],
    }


def choose_next_best_action(goals: list[dict[str, Any]], streak_status: str) -> dict[str, Any]:
    onboarding = next(
        (
            goal
            for goal in goals
            if goal["type"] == "onboarding" and goal["status"] != "completed"
        ),
        None,
    )
    if onboarding:
        return {
            "title": onboarding["title"],
            "description": onboarding["next_step"],
            "cta_label": onboarding["cta_label"],
            "cta_section": onboarding["cta_section"],
        }

    if streak_status == "at_risk":
        return {
            "title": "Вернуть серию",
            "description": "Отметьте один минимальный шаг без компенсации пропущенного объема",
            "cta_label": "Открыть день",
            "cta_section": "dashboard",
        }

    active_goal = next(
        (
            goal
            for goal in goals
            if goal["status"] not in {"completed", "empty"} and goal["type"] in {"daily", "weekly"}
        ),
        None,
    )
    if active_goal:
        return {
            "title": active_goal["title"],
            "description": active_goal["next_step"],
            "cta_label": active_goal["cta_label"],
            "cta_section": active_goal["cta_section"],
        }

    return {
        "title": "Маршрут держится",
        "description": "Следующий шаг появится после новых отметок или завтра",
        "cta_label": "Открыть привычки",
        "cta_section": "habits",
    }


def build_gamification_summary(
    db: Session,
    user: User,
    profile: UserGamificationProfile,
    metrics: dict[str, Any],
    today: date,
) -> dict[str, Any]:
    level_state = get_level_state(profile.total_xp)
    achievements = build_achievement_items(db, user)
    goals = build_goal_items(db, user, metrics, today)
    recent_events = list(
        db.scalars(
            select(RewardEvent)
            .where(RewardEvent.user_id == user.id)
            .order_by(RewardEvent.created_at.desc(), RewardEvent.id.desc())
            .limit(8)
        )
    )
    return {
        "profile": {
            **level_state,
            "current_streak": profile.current_streak,
            "longest_streak": profile.longest_streak,
            "last_active_date": profile.last_active_date,
            "streak_status": profile.streak_status,
        },
        "pet": build_pet_read(user, profile),
        "streak": build_streak_read(profile, metrics),
        "achievements": achievements,
        "goals": goals,
        "recent_events": [reward_event_to_dict(event) for event in recent_events],
        "next_best_action": choose_next_best_action(goals, profile.streak_status),
    }
