from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.gamification_rules import ACHIEVEMENT_DEFINITIONS, GOAL_DEFINITIONS
from app.models import Achievement, Goal


def seed_gamification_definitions(db: Session) -> None:
    for item in ACHIEVEMENT_DEFINITIONS:
        achievement = db.get(Achievement, item["id"])
        if achievement is None:
            achievement = Achievement(id=item["id"])
            db.add(achievement)
        for field, value in item.items():
            setattr(achievement, field, value)
        achievement.is_active = True

    for item in GOAL_DEFINITIONS:
        goal = db.get(Goal, item["id"])
        if goal is None:
            goal = Goal(id=item["id"])
            db.add(goal)
        for field, value in item.items():
            setattr(goal, field, value)
        goal.target_metric = item.get("target_metric")
        goal.active_when = item.get("active_when")
        goal.is_active = True

    db.commit()
