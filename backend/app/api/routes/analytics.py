from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_client_today, get_current_user
from app.db.session import get_db
from app.models import Habit, User
from app.schemas import HabitStats, PredictionRead, UserActivitySummary
from app.services.analytics import calculate_habit_stats, calculate_user_activity_summary
from app.services.predictive import calculate_risk

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _get_user_habit(db: Session, user: User, habit_id: int) -> Habit:
    habit = db.get(Habit, habit_id)
    if not habit or habit.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")
    return habit


@router.get("/summary", response_model=UserActivitySummary)
def get_summary(
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> UserActivitySummary:
    return calculate_user_activity_summary(db, current_user, client_today)


@router.get("/habits/{habit_id}", response_model=HabitStats)
def get_habit_analytics(
    habit_id: int,
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> HabitStats:
    habit = _get_user_habit(db, current_user, habit_id)
    return calculate_habit_stats(db, habit, client_today)


@router.get("/habits/{habit_id}/prediction", response_model=PredictionRead)
def get_habit_prediction(
    habit_id: int,
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> PredictionRead:
    habit = _get_user_habit(db, current_user, habit_id)
    prediction_date = target_date or client_today
    risk = calculate_risk(db, current_user, habit, prediction_date)
    return PredictionRead(
        habit_id=habit.id,
        user_id=current_user.id,
        predicted_for=prediction_date,
        completion_probability=risk.completion_probability,
        miss_risk=risk.miss_risk,
        risk_level=risk.risk_level,
        features=risk.features,
    )
