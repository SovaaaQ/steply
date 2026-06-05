from collections.abc import Iterable, Sequence
from datetime import date, datetime
import re
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.gamification_rules import getRecoveryTask
from app.core.time import utc_now, utc_start_of_day
from app.models import Habit, Prediction, Recommendation, User
from app.services.ai_recommendations import generate_ai_recommendation
from app.services.predictive import create_prediction


MAX_RECOMMENDATION_MESSAGE_WORDS = 48
_PRIORITY_WEIGHT = {"high": 3, "normal": 2, "low": 1}
_LIST_TAIL_PATTERN = re.compile(r"\b(?:Шаги|Действия)\s*:", re.IGNORECASE)
_NUMBERED_TAIL_PATTERN = re.compile(r"(?:^|\s)\d+[.)]\s+.*$", re.DOTALL)
FIRST_STEP_RECOMMENDATION_TYPE = "first_step"
AFTER_COMPLETION_RECOMMENDATION_TYPE = "after_completion"
ON_TRACK_SUPPORT_RECOMMENDATION_TYPE = "on_track_support"
STREAK_MAINTENANCE_RECOMMENDATION_TYPE = "streak_maintenance"
STREAK_SUPPORT_RECOMMENDATION_TYPE = "streak_support"
RISK_IGNORED_RECOVERY_RECOMMENDATION_TYPE = "risk_ignored_recovery"
RESET_PLAN_RECOMMENDATION_TYPE = "reset_plan"
MISS_STREAK_RECOVERY_RECOMMENDATION_TYPE = "miss_streak_recovery"
EARLY_RECOVERY_RECOMMENDATION_TYPE = "early_recovery"
RISK_RECOVERY_RECOMMENDATION_TYPE = "risk_recovery"
SOFT_RECOVERY_RECOMMENDATION_TYPE = "soft_recovery"
PLAN_AHEAD_RECOMMENDATION_TYPE = "plan_ahead"
DATA_COLLECTION_RECOMMENDATION_TYPE = "data_collection"
KEEP_REGULAR_RECOMMENDATION_TYPE = "keep_regular"

_AI_SCENARIO_TYPES = {
    FIRST_STEP_RECOMMENDATION_TYPE,
    AFTER_COMPLETION_RECOMMENDATION_TYPE,
    ON_TRACK_SUPPORT_RECOMMENDATION_TYPE,
    STREAK_MAINTENANCE_RECOMMENDATION_TYPE,
    STREAK_SUPPORT_RECOMMENDATION_TYPE,
    RISK_IGNORED_RECOVERY_RECOMMENDATION_TYPE,
    RESET_PLAN_RECOMMENDATION_TYPE,
    MISS_STREAK_RECOVERY_RECOMMENDATION_TYPE,
    EARLY_RECOVERY_RECOMMENDATION_TYPE,
    RISK_RECOVERY_RECOMMENDATION_TYPE,
    SOFT_RECOVERY_RECOMMENDATION_TYPE,
    PLAN_AHEAD_RECOMMENDATION_TYPE,
}

_RECOVERY_SCENARIO_TYPES = {
    RISK_IGNORED_RECOVERY_RECOMMENDATION_TYPE,
    RESET_PLAN_RECOMMENDATION_TYPE,
    MISS_STREAK_RECOVERY_RECOMMENDATION_TYPE,
    EARLY_RECOVERY_RECOMMENDATION_TYPE,
    RISK_RECOVERY_RECOMMENDATION_TYPE,
    SOFT_RECOVERY_RECOMMENDATION_TYPE,
    # Legacy recommendation types can still be present in existing rows.
    "recovery_mode",
    "reduce_difficulty",
    "soft_reminder",
    "restore_regular_activity",
}


def _day_start(today: date) -> datetime:
    return utc_start_of_day(today)


def _clean_text(value: str) -> str:
    return " ".join(value.split()).strip()


def _feature_int(features: dict, key: str, default: int = 0) -> int:
    try:
        return int(features.get(key) or default)
    except (TypeError, ValueError):
        return default


def _feature_float(features: dict, key: str, default: float = 0.0) -> float:
    try:
        return float(features.get(key) or default)
    except (TypeError, ValueError):
        return default


def _feature_bool(features: dict, key: str) -> bool:
    return bool(features.get(key))


def _lower_first(value: str) -> str:
    text = value.strip()
    if not text:
        return text
    return f"{text[0].lower()}{text[1:]}"


def _habit_text_field(habit: Habit, field: str) -> str:
    value = getattr(habit, field, "")
    return value if isinstance(value, str) else ""


def _habit_context_text(habit: Habit) -> str:
    return f"{_habit_text_field(habit, 'title')} {_habit_text_field(habit, 'description')}".lower()


def _has_custom_recovery_task(habit: Habit) -> bool:
    recovery_task = getattr(habit, "recovery_task", None)
    return isinstance(recovery_task, str) and bool(recovery_task.strip())


def _recovery_task_fragment(habit: Habit) -> str:
    if not _has_custom_recovery_task(habit):
        context = _habit_context_text(habit)
        if any(keyword in context for keyword in ("англий", "english", "слова", "язык")):
            return "повторите три слова или прочитайте один короткий диалог"
        if any(keyword in context for keyword in ("диплом", "курсов", "учеб", "проект")):
            return "откройте файл и поправьте один абзац или план из двух пунктов"
        if any(keyword in context for keyword in ("python", "пайтон", "код", "программ")):
            return "откройте редактор и решите одну маленькую задачу или прочитайте пример"
        if any(keyword in context for keyword in ("чтен", "книг")):
            return "прочитайте одну страницу или один короткий фрагмент"
        if any(keyword in context for keyword in ("спорт", "трен", "заряд")):
            return "сделайте две минуты разминки без полной тренировки"
        if any(keyword in context for keyword in ("курен", "сигар", "никотин")):
            return "сделайте паузу на пять минут и запишите, что запустило желание"
    return _lower_first(getRecoveryTask(habit).strip().rstrip(" ."))


def _ensure_sentence_end(value: str) -> str:
    text = value.rstrip(" ,;:")
    if not text:
        return text
    if text[-1] in ".!?":
        return text
    return f"{text}."


def _strip_list_tail(value: str) -> str:
    text = value.strip()
    marker = _LIST_TAIL_PATTERN.search(text)
    if marker:
        text = text[: marker.start()]
    text = _NUMBERED_TAIL_PATTERN.sub("", text)
    return text


def _strip_outer_quotes(value: str) -> str:
    text = value.strip()
    quote_pairs = {
        '"': '"',
        "'": "'",
        "«": "»",
        "“": "”",
        "„": "“",
    }
    while len(text) >= 2 and text[0] in quote_pairs and text[-1] == quote_pairs[text[0]]:
        text = text[1:-1].strip()
    return text


def _normalize_recommendation_message(value: str) -> str:
    text = _strip_outer_quotes(_clean_text(_strip_list_tail(value)))
    if not text:
        text = _strip_outer_quotes(_clean_text(value))

    words = text.split()
    if len(words) > MAX_RECOMMENDATION_MESSAGE_WORDS:
        text = " ".join(words[:MAX_RECOMMENDATION_MESSAGE_WORDS])

    return _ensure_sentence_end(text)


def _normalize_recommendation(recommendation: Recommendation) -> None:
    recommendation.title = _clean_text(recommendation.title)
    recommendation.message = _normalize_recommendation_message(recommendation.message)


def _created_timestamp(recommendation: Recommendation) -> float:
    return recommendation.created_at.timestamp() if recommendation.created_at else 0


def _recommendation_display_key(recommendation: Recommendation) -> tuple[bool, int, float, int]:
    return (
        bool(recommendation.is_read),
        -_PRIORITY_WEIGHT.get(recommendation.priority, 0),
        -_created_timestamp(recommendation),
        -(recommendation.id or 0),
    )


def _select_current_recommendations(
    candidates: Sequence[Recommendation],
    active_habit_ids: Iterable[int],
) -> list[Recommendation]:
    active_ids = set(active_habit_ids)
    latest_by_key: dict[tuple[str, int | str], Recommendation] = {}

    for recommendation in sorted(
        candidates,
        key=lambda item: (_created_timestamp(item), item.id or 0),
        reverse=True,
    ):
        if recommendation.habit_id is not None and recommendation.habit_id not in active_ids:
            continue

        key: tuple[str, int | str]
        if recommendation.habit_id is None:
            key = ("general", recommendation.type)
        else:
            key = ("habit", recommendation.habit_id)

        if key not in latest_by_key:
            latest_by_key[key] = recommendation

    selected = sorted(latest_by_key.values(), key=_recommendation_display_key)
    for recommendation in selected:
        _normalize_recommendation(recommendation)
    return selected


def list_current_recommendations(
    db: Session,
    user: User,
    active_habit_ids: Iterable[int] | None = None,
) -> list[Recommendation]:
    if active_habit_ids is None:
        active_habit_ids = db.scalars(
            select(Habit.id).where(Habit.user_id == user.id, Habit.is_active.is_(True))
        )

    candidates = list(
        db.scalars(
            select(Recommendation)
            .where(Recommendation.user_id == user.id)
            .order_by(Recommendation.created_at.desc())
        )
    )
    return _select_current_recommendations(candidates, active_habit_ids)


def _is_ai_worthwhile(rec_type: str, prediction: Prediction) -> bool:
    if rec_type in _AI_SCENARIO_TYPES:
        return True

    features = prediction.features or {}
    total_entries = _feature_int(features, "total_entries")
    if total_entries < 3:
        return False

    consecutive_missed = _feature_int(features, "consecutive_missed")
    recent_miss_rate = _feature_float(features, "recent_miss_rate")
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


def _has_configured_pet(user: User) -> bool:
    return bool(user.pet_type and user.pet_name)


def _should_create_first_step_recommendation(
    user: User,
    prediction: Prediction,
    active_habit_count: int,
) -> bool:
    features = prediction.features or {}
    total_entries = _feature_int(features, "total_entries")

    return (
        active_habit_count == 1
        and total_entries == 0
        and _has_configured_pet(user)
    )


def _build_first_step_recommendation_text(user: User, habit: Habit) -> tuple[str, str, str, str]:
    pet_name = _clean_text(user.pet_name or "")
    pet_hint = f", а {pet_name} получит первый повод радоваться" if pet_name else ""
    action = _recovery_task_fragment(habit)

    return (
        FIRST_STEP_RECOMMENDATION_TYPE,
        "Первый шаг",
        (
            f"Привычка «{habit.title}» создана. Сегодня сделайте самый маленький шаг: "
            f"{action}{pet_hint}. После первой отметки Steply начнет точнее "
            "подбирать советы."
        ),
        "normal",
    )


def _build_recommendation_text(
    user: User,
    habit: Habit,
    prediction: Prediction,
    active_habit_count: int,
    previous_type: str | None = None,
) -> tuple[str, str, str, str]:
    features = prediction.features or {}
    total_entries = _feature_int(features, "total_entries")
    missed_count = _feature_int(features, "missed_count")
    current_streak = _feature_int(features, "current_streak")
    consecutive_missed = _feature_int(features, "consecutive_missed")
    completed_last_7 = _feature_int(features, "completed_last_7_days")
    missed_last_7 = _feature_int(features, "missed_last_7_days")
    total_last_7 = _feature_int(
        features,
        "total_last_7_days",
        completed_last_7 + missed_last_7,
    )
    days_since_last = features.get("days_since_last_completion")
    recent_miss_rate = _feature_float(features, "recent_miss_rate")
    completion_rate = _feature_float(features, "completion_rate")
    completion_rate_last_7 = _feature_float(features, "completion_rate_last_7")
    completed_today = _feature_bool(features, "completed_today")
    missed_today = _feature_bool(features, "missed_today")
    recovery_task = _recovery_task_fragment(habit)
    is_on_track_period = (
        total_last_7 >= 3
        and missed_last_7 == 0
        and completion_rate_last_7 >= 0.8
    )
    previous_was_recovery = previous_type in _RECOVERY_SCENARIO_TYPES

    if _should_create_first_step_recommendation(user, prediction, active_habit_count):
        return _build_first_step_recommendation_text(user, habit)

    if completed_today:
        if current_streak >= 3 or is_on_track_period:
            series_text = (
                f"серия уже {current_streak} подряд"
                if current_streak >= 2
                else "последние отметки идут без пропусков"
            )
            return (
                STREAK_MAINTENANCE_RECOMMENDATION_TYPE,
                "Удержать серию",
                (
                    f"Привычка «{habit.title}» сегодня выполнена, {series_text}. "
                    "Чтобы завтра не начинать с нуля, "
                    "подготовьте самый простой вход заранее: место, файл, одежду или первый вопрос."
                ),
                "low",
            )

        if total_entries <= 2:
            return (
                AFTER_COMPLETION_RECOMMENDATION_TYPE,
                "После отметки",
                (
                    f"Вы уже отметили «{habit.title}» сегодня. Закрепите старт: "
                    "оставьте видимую подсказку для следующего выполнения и не повышайте нагрузку, "
                    "пока привычка не повторится несколько раз."
                ),
                "normal",
            )

        return (
            ON_TRACK_SUPPORT_RECOMMENDATION_TYPE,
            "Идет по плану",
            (
                f"Сегодня «{habit.title}» выполнена вовремя. Используйте этот момент: "
                "заранее уберите один лишний барьер для следующего раза, чтобы повторить действие "
                "без долгой подготовки."
            ),
            "low",
        )

    if (
        previous_was_recovery
        and consecutive_missed >= 3
        and (prediction.risk_level == "high" or recent_miss_rate >= 0.45)
    ):
        return (
            RISK_IGNORED_RECOVERY_RECOMMENDATION_TYPE,
            "Пересоберите условия",
            (
                f"У привычки «{habit.title}» пропуски продолжаются после риск-сигнала. "
                "Сегодня не возвращайтесь к полной версии: уменьшите цель до самого короткого шага "
                f"и сделайте только его: {recovery_task}."
            ),
            "high",
        )

    if consecutive_missed >= 5 or (
        total_last_7 >= 5 and missed_last_7 >= 4 and completion_rate_last_7 <= 0.2
    ):
        return (
            RESET_PLAN_RECOMMENDATION_TYPE,
            "План перезапуска",
            (
                f"У привычки «{habit.title}» накопилась длинная пауза. "
                "На сегодня снизьте формат до минимума, поменяйте время на более реальное "
                f"и отметьте только один шаг: {recovery_task}."
            ),
            "high",
        )

    if consecutive_missed >= 2:
        return (
            MISS_STREAK_RECOVERY_RECOMMENDATION_TYPE,
            "Вернуться мягко",
            (
                f"У привычки «{habit.title}» уже {consecutive_missed} пропуска подряд. "
                "Не пытайтесь наверстать весь объем. Сегодня сделайте только минимальный шаг: "
                f"{recovery_task}, и сохраните отметку как возвращение в ритм."
            ),
            "high" if consecutive_missed >= 3 else "normal",
        )

    if total_entries < 3 and (missed_count > 0 or missed_today):
        return (
            EARLY_RECOVERY_RECOMMENDATION_TYPE,
            "Раннее восстановление",
            (
                f"По привычке «{habit.title}» истории еще мало, но пропуск уже появился. "
                "Сегодня важнее не точный прогноз, а быстрый возврат: сделайте минимальный вариант "
                f"без компенсации пропуска: {recovery_task}."
            ),
            "normal",
        )

    if prediction.risk_level == "high":
        return (
            RISK_RECOVERY_RECOMMENDATION_TYPE,
            "Риск пропуска",
            (
                f"По привычке «{habit.title}» сегодня высокий риск пропуска. "
                "Сузьте задачу до самого простого действия и выполните его в ближайшее удобное окно: "
                f"{recovery_task}."
            ),
            "high",
        )

    if prediction.risk_level == "medium":
        if recent_miss_rate >= 0.25 or missed_last_7 > 0 or consecutive_missed == 1:
            return (
                SOFT_RECOVERY_RECOMMENDATION_TYPE,
                "Сделайте проще",
                (
                    f"У привычки «{habit.title}» появились недавние пропуски. "
                    "На сегодня уменьшите объем и заранее решите, где закончится минимальная версия, "
                    "чтобы отметка не зависела от идеального настроя."
                ),
                "normal",
            )
        return (
            PLAN_AHEAD_RECOMMENDATION_TYPE,
            "Запланируйте заранее",
            (
                f"Для привычки «{habit.title}» риск пока средний. "
                "Выберите конкретное время, подготовьте первый шаг и оставьте рядом то, что нужно "
                "для выполнения без лишнего поиска."
            ),
            "normal",
        )

    if total_entries < 3:
        return (
            DATA_COLLECTION_RECOMMENDATION_TYPE,
            "Пока рано считать риск",
            (
                f"По привычке «{habit.title}» пока мало отметок. "
                "Отмечайте ее несколько дней, и Steply точнее поймет ваш ритм."
            ),
            "normal",
        )

    if current_streak >= 3:
        return (
            STREAK_SUPPORT_RECOMMENDATION_TYPE,
            "Серия укрепляется",
            (
                f"У привычки «{habit.title}» хорошая серия: {current_streak} подряд. "
                "Сохраните темп без резкого усложнения: заранее подготовьте следующий повтор "
                "и оставьте цель такой же простой."
            ),
            "low",
        )

    if is_on_track_period:
        return (
            STREAK_MAINTENANCE_RECOMMENDATION_TYPE,
            "Ритм держится",
            (
                f"Привычка «{habit.title}» идет ровно: за последние отметки нет пропусков. "
                "Продолжайте в том же формате и заранее защитите ближайший сложный день "
                "минимальной версией."
            ),
            "low",
        )

    if days_since_last is not None and int(days_since_last) > 2:
        return (
            SOFT_RECOVERY_RECOMMENDATION_TYPE,
            "Вернитесь к ритму",
            (
                f"Привычка «{habit.title}» давно не выполнялась. "
                "Начните с короткого шага без попытки наверстать все сразу, а затем отметьте "
                "возвращение в приложении."
            ),
            "normal",
        )

    return (
        KEEP_REGULAR_RECOMMENDATION_TYPE,
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
    active_habit_count: int,
) -> Recommendation:
    existing = db.scalar(
        select(Recommendation).where(
            Recommendation.user_id == user.id,
            Recommendation.habit_id == habit.id,
        ).order_by(Recommendation.created_at.desc())
    )
    rec_type, title, message, priority = _build_recommendation_text(
        user,
        habit,
        prediction,
        active_habit_count,
        previous_type=existing.type if existing else None,
    )
    message = _normalize_recommendation_message(message)

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
            user=user,
        )
        if ai_draft:
            title = ai_draft.title
            message = _normalize_recommendation_message(ai_draft.message)

    if existing:
        existing.prediction_id = prediction.id
        existing.type = rec_type
        existing.title = title
        existing.message = message
        existing.priority = priority
        existing.is_read = False
        existing.created_at = utc_now()
        db.flush()
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
    db.flush()
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
        prediction = create_prediction(db, user, habit, today)
        recommendations.append(
            _upsert_recommendation(
                db,
                user,
                habit,
                prediction,
                today,
                len(habits),
            )
        )
    return recommendations
