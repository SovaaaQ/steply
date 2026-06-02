from __future__ import annotations

from datetime import timezone

from app.core.time import utc_now
from app.models import Habit, HabitEntry, Recommendation, User
from app.models.gamification import RewardEvent, UserGamificationProfile


def test_utc_now_returns_timezone_aware_utc_datetime() -> None:
    now = utc_now()

    assert now.tzinfo is not None
    assert now.utcoffset() == timezone.utc.utcoffset(now)


def test_timestamp_columns_are_timezone_aware() -> None:
    columns = [
        User.__table__.c.created_at,
        Habit.__table__.c.created_at,
        HabitEntry.__table__.c.created_at,
        Recommendation.__table__.c.created_at,
        UserGamificationProfile.__table__.c.updated_at,
        RewardEvent.__table__.c.created_at,
    ]

    assert all(column.type.timezone for column in columns)
