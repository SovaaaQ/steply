from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_client_today, get_current_user
from app.db.session import get_db
from app.models import Habit, HabitEntry, Recommendation, User
from app.schemas import DashboardRead, PredictionRead
from app.services.analytics import (
    calculate_habit_stats_from_entries,
    calculate_user_activity_summary_from_entries,
    group_entries_by_habit,
)
from app.services.gamification import read_user_gamification_summary
from app.services.habit_schedule import get_next_scheduled_date
from app.services.predictive import calculate_risk_from_stats


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardRead)
def get_dashboard(
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
    current_user: User = Depends(get_current_user),
) -> DashboardRead:
    habits = list(
        db.scalars(
            select(Habit)
            .where(Habit.user_id == current_user.id)
            .order_by(Habit.is_active.desc(), Habit.created_at.desc())
        )
    )
    active_habits = [habit for habit in habits if habit.is_active]
    all_entries = list(
        db.scalars(
            select(HabitEntry)
            .where(HabitEntry.user_id == current_user.id)
            .order_by(HabitEntry.entry_date, HabitEntry.id)
        )
    )
    entries_by_habit = group_entries_by_habit(all_entries)
    summary = calculate_user_activity_summary_from_entries(
        current_user,
        habits,
        all_entries,
        client_today,
    )

    habit_stats = {
        habit.id: calculate_habit_stats_from_entries(
            habit,
            entries_by_habit.get(habit.id, []),
            client_today,
        )
        for habit in active_habits
    }
    predictions: dict[int, PredictionRead] = {}
    for habit in active_habits:
        entries = entries_by_habit.get(habit.id, [])
        completed_today = any(
            entry.entry_date == client_today
            and entry.status in {"completed", "recovery_completed"}
            for entry in entries
        )
        target_date = (
            get_next_scheduled_date(habit, client_today, 1)
            if completed_today
            else client_today
        ) or client_today
        risk = calculate_risk_from_stats(
            user=current_user,
            habit=habit,
            stats=habit_stats[habit.id],
            user_activity=summary,
            entries=entries,
            target_date=target_date,
        )
        predictions[habit.id] = PredictionRead(
            habit_id=habit.id,
            user_id=current_user.id,
            predicted_for=target_date,
            completion_probability=risk.completion_probability,
            miss_risk=risk.miss_risk,
            risk_level=risk.risk_level,
            features=risk.features,
        )

    active_habit_ids = {habit.id for habit in active_habits}
    habit_entries = {
        habit_id: entries
        for habit_id, entries in entries_by_habit.items()
        if habit_id in active_habit_ids
    }
    recommendations = list(
        db.scalars(
            select(Recommendation)
            .where(Recommendation.user_id == current_user.id)
            .order_by(Recommendation.is_read.asc(), Recommendation.created_at.desc())
        )
    )
    gamification = read_user_gamification_summary(db, current_user, today=client_today)

    return DashboardRead(
        user=current_user,
        habits=habits,
        summary=summary,
        habit_stats=habit_stats,
        habit_entries=habit_entries,
        predictions=predictions,
        recommendations=recommendations,
        gamification=gamification,
    )
