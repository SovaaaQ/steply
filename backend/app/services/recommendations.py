from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Habit, Prediction, Recommendation, User
from app.core.config import get_settings
from app.core.gamification_rules import getRecoveryTask
from app.services.analytics import calculate_habit_stats
from app.services.ai_recommendations import generate_ai_recommendation
from app.services.predictive import create_prediction


def _day_start(today: date) -> datetime:
    return datetime.combine(today, time.min)


def _has_fresh_recommendation(recommendation: Recommendation, today: date) -> bool:
    return recommendation.created_at.date() == today


def _is_ai_worthwhile(rec_type: str, prediction: Prediction) -> bool:
    features = prediction.features or {}
    total_entries = int(features.get("total_entries") or 0)
    if total_entries < 3:
        return False

    consecutive_missed = int(features.get("consecutive_missed") or 0)
    recent_miss_rate = float(features.get("recent_miss_rate") or 0)
    return (
        prediction.risk_level in {"medium", "high"}
        or rec_type
        in {
            "recovery_mode",
            "reduce_difficulty",
            "soft_reminder",
            "restore_regular_activity",
        }
        or consecutive_missed > 0
        or recent_miss_rate >= 0.2
    )


def _daily_ai_budget_available(db: Session, user: User, today: date) -> bool:
    limit = max(0, get_settings().ai_daily_recommendation_limit)
    if limit == 0:
        return False

    created_today = list(
        db.scalars(
            select(Recommendation).where(
                Recommendation.user_id == user.id,
                Recommendation.created_at >= _day_start(today),
            )
        )
    )
    return len(created_today) < limit


def _build_recommendation_text(habit: Habit, prediction: Prediction) -> tuple[str, str, str, str]:
    features = prediction.features or {}
    total_entries = int(features.get("total_entries") or 0)
    current_streak = int(features.get("current_streak") or 0)
    days_since_last = features.get("days_since_last_completion")
    recent_miss_rate = float(features.get("recent_miss_rate") or 0)
    completion_rate = float(features.get("completion_rate") or 0)

    if total_entries < 3:
        return (
            "data_collection",
            "Пока рано считать риск",
            (
                f"По привычке «{habit.title}» пока мало отметок. "
                "Отмечайте ее несколько дней, и Steply точнее поймет ваш ритм."
            ),
            "normal",
        )

    if prediction.risk_level == "high":
        return (
            "recovery_mode",
            "Режим восстановления",
            (
                f"По привычке «{habit.title}» высокий риск пропуска. "
                "На это повлияли недавние пропуски и пауза после последнего выполнения. "
                f"Сегодня попробуйте минимум: {getRecoveryTask(habit)}"
            ),
            "high",
        )

    if prediction.risk_level == "medium":
        if recent_miss_rate >= 0.35:
            return (
                "reduce_difficulty",
                "Сделайте проще",
                (
                    f"У привычки «{habit.title}» участились пропуски. "
                    "Сейчас лучше временно уменьшить объем или выбрать цель попроще."
                ),
                "normal",
            )
        return (
            "soft_reminder",
            "Запланируйте заранее",
            (
                f"Для привычки «{habit.title}» есть средний риск пропуска. "
                "Выберите удобное время заранее и отметьте результат в приложении."
            ),
            "normal",
        )

    if current_streak >= 3:
        return (
            "motivation",
            "Серия укрепляется",
            (
                f"У привычки «{habit.title}» хорошая серия: {current_streak} подряд. "
                "Сохраните темп и сделайте шаг в привычное время."
            ),
            "low",
        )

    if days_since_last is not None and int(days_since_last) > 2:
        return (
            "restore_regular_activity",
            "Вернитесь к ритму",
            (
                f"Привычка «{habit.title}» давно не выполнялась. "
                "Начните с короткого шага, без попытки наверстать все сразу."
            ),
            "normal",
        )

    return (
        "keep_regular",
        "Ритм держится",
        (
            f"Привычка «{habit.title}» идет стабильно. "
            f"Выполнение сейчас: {round(completion_rate * 100)}%. "
            "Продолжайте отмечать ее, чтобы советы оставались точными."
        ),
        "low",
    )


def _upsert_recommendation(
    db: Session,
    user: User,
    habit: Habit,
    prediction: Prediction,
    today: date,
) -> Recommendation:
    rec_type, title, message, priority = _build_recommendation_text(habit, prediction)

    existing = db.scalar(
        select(Recommendation).where(
            Recommendation.user_id == user.id,
            Recommendation.habit_id == habit.id,
        ).order_by(Recommendation.created_at.desc())
    )

    if existing and _has_fresh_recommendation(existing, today):
        return existing

    should_use_ai = _is_ai_worthwhile(rec_type, prediction) and _daily_ai_budget_available(
        db,
        user,
        today,
    )
    if should_use_ai:
        ai_draft = generate_ai_recommendation(
            habit=habit,
            prediction=prediction,
            today=today,
            base_type=rec_type,
            base_title=title,
            base_message=message,
        )
        if ai_draft:
            title = ai_draft.title
            message = ai_draft.message

    if existing:
        existing.prediction_id = prediction.id
        existing.type = rec_type
        existing.title = title
        existing.message = message
        existing.priority = priority
        existing.is_read = False
        existing.created_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    recommendation = Recommendation(
        user_id=user.id,
        habit_id=habit.id,
        prediction_id=prediction.id,
        type=rec_type,
        title=title,
        message=message,
        priority=priority,
    )
    db.add(recommendation)
    db.commit()
    db.refresh(recommendation)
    return recommendation


def generate_recommendations(
    db: Session,
    user: User,
    today: Optional[date] = None,
) -> list[Recommendation]:
    today = today or date.today()
    habits = list(
        db.scalars(
            select(Habit)
            .where(Habit.user_id == user.id, Habit.is_active.is_(True))
            .order_by(Habit.created_at.desc())
        )
    )
    recommendations: list[Recommendation] = []
    for habit in habits:
        _ = calculate_habit_stats(db, habit, today)
        prediction = create_prediction(db, user, habit, today)
        recommendations.append(_upsert_recommendation(db, user, habit, prediction, today))
    return recommendations
