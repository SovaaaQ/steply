from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Habit, Prediction, Recommendation, User
from app.core.gamification_rules import getRecoveryTask
from app.services.analytics import calculate_habit_stats
from app.services.predictive import create_prediction


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
            "Недостаточно данных для точного прогноза",
            (
                f"По привычке «{habit.title}» пока мало отметок. "
                "Отмечайте выполнение несколько дней, и Steply точнее оценит риск пропуска "
                "по вашей регулярности, дням недели и истории активности."
            ),
            "normal",
        )

    if prediction.risk_level == "high":
        return (
            "recovery_mode",
            "Режим восстановления",
            (
                f"По привычке «{habit.title}» высокий риск пропуска. "
                "На прогноз повлияли недавние пропуски и давность последнего выполнения. "
                f"Сегодня выполните минимальную версию: {getRecoveryTask(habit)}"
            ),
            "high",
        )

    if prediction.risk_level == "medium":
        if recent_miss_rate >= 0.35:
            return (
                "reduce_difficulty",
                "Снизьте сложность",
                (
                    f"У привычки «{habit.title}» участились пропуски. "
                    "Steply учитывает историю за последние дни, поэтому сейчас лучше временно "
                    "уменьшить объем действия или выбрать более простую цель."
                ),
                "normal",
            )
        return (
            "soft_reminder",
            "Мягкое напоминание",
            (
                f"Для привычки «{habit.title}» есть средний риск пропуска. "
                "Прогноз основан на вашей регулярности и активности за последние дни. "
                "Запланируйте выполнение заранее и отметьте результат в приложении."
            ),
            "normal",
        )

    if current_streak >= 3:
        return (
            "motivation",
            "Серия укрепляется",
            (
                f"У привычки «{habit.title}» хорошая серия: {current_streak} подряд. "
                "Сохраните темп и выполните действие в привычное время."
            ),
            "low",
        )

    if days_since_last is not None and int(days_since_last) > 2:
        return (
            "restore_regular_activity",
            "Вернитесь к регулярности",
            (
                f"Привычка «{habit.title}» давно не выполнялась. "
                "Начните с короткого действия, чтобы восстановить регулярность без давления."
            ),
            "normal",
        )

    return (
        "keep_regular",
        "Поддерживайте регулярность",
        (
            f"Привычка «{habit.title}» находится в стабильном состоянии. "
            f"Текущий процент выполнения: {round(completion_rate * 100)}%. "
            "Продолжайте отмечать выполнение, чтобы аналитика оставалась точной."
        ),
        "low",
    )


def _upsert_recommendation(
    db: Session,
    user: User,
    habit: Habit,
    prediction: Prediction,
) -> Recommendation:
    rec_type, title, message, priority = _build_recommendation_text(habit, prediction)
    existing = db.scalar(
        select(Recommendation).where(
            Recommendation.user_id == user.id,
            Recommendation.habit_id == habit.id,
            Recommendation.type == rec_type,
            Recommendation.is_read.is_(False),
        )
    )
    if existing:
        existing.prediction_id = prediction.id
        existing.title = title
        existing.message = message
        existing.priority = priority
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


def generate_recommendations(db: Session, user: User) -> list[Recommendation]:
    habits = list(
        db.scalars(
            select(Habit)
            .where(Habit.user_id == user.id, Habit.is_active.is_(True))
            .order_by(Habit.created_at.desc())
        )
    )
    recommendations: list[Recommendation] = []
    for habit in habits:
        _ = calculate_habit_stats(db, habit)
        prediction = create_prediction(db, user, habit, date.today())
        recommendations.append(_upsert_recommendation(db, user, habit, prediction))
    return recommendations
