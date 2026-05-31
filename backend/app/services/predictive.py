from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional, Union

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Habit, HabitEntry, Prediction, User
from app.services.analytics import calculate_habit_stats, calculate_user_activity_summary


@dataclass(frozen=True)
class RiskCalculation:
    completion_probability: float
    miss_risk: float
    risk_level: str
    features: dict[str, Optional[Union[float, int, str]]]


def _clamp(value: float, lower: float = 0.05, upper: float = 0.95) -> float:
    return max(lower, min(upper, value))


def _risk_level(miss_risk: float) -> str:
    if miss_risk < 0.40:
        return "low"
    if miss_risk < 0.70:
        return "medium"
    return "high"


def _recent_miss_rate(entries: list[HabitEntry], limit: int = 14) -> float:
    recent_entries = sorted(entries, key=lambda item: item.entry_date)[-limit:]
    if not recent_entries:
        return 0.0
    missed = sum(1 for entry in recent_entries if entry.status == "missed")
    return missed / len(recent_entries)


def calculate_risk(
    db: Session,
    user: User,
    habit: Habit,
    target_date: Optional[date] = None,
) -> RiskCalculation:
    target_date = target_date or date.today()
    stats = calculate_habit_stats(db, habit, target_date)
    user_activity = calculate_user_activity_summary(db, user, target_date)
    entries = [entry for entry in habit.entries if entry.user_id == user.id]

    completion_rate = stats.completion_rate
    recent_miss_rate = _recent_miss_rate(entries)
    history_confidence = min(stats.total_entries / 14, 1.0)
    streak_factor = min(stats.current_streak / 10, 1.0)
    user_activity_score = user_activity.activity_score / 100

    weekday_key = {
        0: "Пн",
        1: "Вт",
        2: "Ср",
        3: "Чт",
        4: "Пт",
        5: "Сб",
        6: "Вс",
    }[target_date.weekday()]
    weekday_success_rate = stats.weekday_success_rates.get(weekday_key, 0.0)
    if weekday_success_rate == 0 and stats.total_entries > 0:
        weekday_success_rate = completion_rate

    days_since_last = stats.days_since_last_completion
    recency_penalty = min((days_since_last or 7) / 14, 1.0)
    difficulty_penalty = {"easy": 0.02, "medium": 0.06, "hard": 0.12}.get(
        habit.difficulty,
        0.06,
    )
    frequency_pressure = max(0.0, (habit.target_per_week - 5) / 10)

    formula_probability = (
        0.18
        + 0.30 * completion_rate
        + 0.14 * weekday_success_rate
        + 0.16 * user_activity_score
        + 0.14 * streak_factor
        + 0.08 * history_confidence
        - 0.18 * recent_miss_rate
        - 0.15 * recency_penalty
        - difficulty_penalty
        - frequency_pressure
    )
    cold_start_probability = 0.56 + 0.12 * user_activity_score - difficulty_penalty
    completion_probability = _clamp(
        history_confidence * formula_probability
        + (1 - history_confidence) * cold_start_probability
    )
    miss_risk = round(1 - completion_probability, 3)

    features: dict[str, Optional[Union[float, int, str]]] = {
        # Признаки сохранены явно, чтобы на защите можно было объяснить прогноз.
        "total_entries": stats.total_entries,
        "completed_count": stats.completed_count,
        "missed_count": stats.missed_count,
        "completion_rate": round(completion_rate, 3),
        "recent_miss_rate": round(recent_miss_rate, 3),
        "consecutive_missed": stats.consecutive_missed,
        "current_streak": stats.current_streak,
        "longest_streak": stats.longest_streak,
        "weekday": weekday_key,
        "weekday_success_rate": round(weekday_success_rate, 3),
        "days_since_last_completion": days_since_last,
        "user_activity_score": round(user_activity_score, 3),
        "target_per_week": habit.target_per_week,
        "difficulty": habit.difficulty,
        "history_confidence": round(history_confidence, 3),
    }
    return RiskCalculation(
        completion_probability=round(completion_probability, 3),
        miss_risk=miss_risk,
        risk_level=_risk_level(miss_risk),
        features=features,
    )


def create_prediction(
    db: Session,
    user: User,
    habit: Habit,
    target_date: Optional[date] = None,
) -> Prediction:
    target_date = target_date or date.today()
    calculation = calculate_risk(db, user, habit, target_date)
    prediction = db.scalar(
        select(Prediction).where(
            Prediction.habit_id == habit.id,
            Prediction.user_id == user.id,
            Prediction.predicted_for == target_date,
        )
    )
    if prediction:
        prediction.completion_probability = calculation.completion_probability
        prediction.miss_risk = calculation.miss_risk
        prediction.risk_level = calculation.risk_level
        prediction.features = calculation.features
        prediction.created_at = datetime.utcnow()
    else:
        prediction = Prediction(
            habit_id=habit.id,
            user_id=user.id,
            predicted_for=target_date,
            completion_probability=calculation.completion_probability,
            miss_risk=calculation.miss_risk,
            risk_level=calculation.risk_level,
            features=calculation.features,
            created_at=datetime.utcnow(),
        )
        db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction
