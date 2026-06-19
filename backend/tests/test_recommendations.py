from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.schemas import RecommendationRead
from app.services.ai_recommendations import _build_bothub_request, _normalize_ai_payload
from app.services.recommendations import (
    AFTER_COMPLETION_RECOMMENDATION_TYPE,
    EARLY_RECOVERY_RECOMMENDATION_TYPE,
    FIRST_STEP_RECOMMENDATION_TYPE,
    MISS_STREAK_RECOVERY_RECOMMENDATION_TYPE,
    ON_TRACK_SUPPORT_RECOMMENDATION_TYPE,
    RESET_PLAN_RECOMMENDATION_TYPE,
    RISK_IGNORED_RECOVERY_RECOMMENDATION_TYPE,
    RISK_RECOVERY_RECOMMENDATION_TYPE,
    STREAK_MAINTENANCE_RECOMMENDATION_TYPE,
    _build_recommendation_text,
    _normalize_recommendation_message,
    _select_current_recommendations,
)


def make_recommendation(
    recommendation_id: int,
    habit_id: int | None,
    created_at: datetime,
    *,
    is_read: bool = False,
    priority: str = "normal",
    rec_type: str = "keep_regular",
) -> SimpleNamespace:
    return SimpleNamespace(
        id=recommendation_id,
        habit_id=habit_id,
        type=rec_type,
        title="Совет",
        message="Короткий совет",
        priority=priority,
        is_read=is_read,
        created_at=created_at,
    )


def make_user() -> SimpleNamespace:
    return SimpleNamespace(pet_type="cat", pet_name="Типа")


def make_habit(
    title: str = "диплом",
    description: str | None = None,
    recovery_minutes: int = 10,
    recovery_task: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        title=title,
        description=description,
        recovery_task=recovery_task,
        recovery_minutes=recovery_minutes,
    )


def make_prediction(
    total_entries: int,
    *,
    risk_level: str = "low",
    **overrides: object,
) -> SimpleNamespace:
    features = {
        "total_entries": total_entries,
        "completed_count": 0,
        "missed_count": 0,
        "completed_last_7_days": 0,
        "missed_last_7_days": 0,
        "total_last_7_days": 0,
        "completion_rate_last_7": 0,
        "current_streak": 0,
        "consecutive_missed": 0,
        "recent_miss_rate": 0,
        "completion_rate": 0,
        "completed_today": False,
        "missed_today": False,
    }
    features.update(overrides)
    return SimpleNamespace(
        features=features,
        risk_level=risk_level,
    )


def assert_action_plan(message: str) -> None:
    assert message.startswith("Сегодня: ")
    assert " Минимум: " in message
    assert " Готово: " in message
    assert not message.endswith(".")
    today_text, tail = message.removeprefix("Сегодня: ").split(" Минимум: ", 1)
    minimum_text, done_text = tail.split(" Готово: ", 1)
    assert today_text[0].isupper()
    assert minimum_text[0].isupper()
    assert done_text[0].isupper()


def test_select_current_recommendations_keeps_latest_per_active_habit() -> None:
    now = datetime(2026, 6, 4, 8, 0, tzinfo=timezone.utc)
    recommendations = [
        make_recommendation(1, 10, now - timedelta(hours=3), priority="high"),
        make_recommendation(2, 10, now - timedelta(hours=1), is_read=True, priority="low"),
        make_recommendation(3, 20, now - timedelta(hours=2), priority="normal"),
        make_recommendation(4, 30, now, priority="high"),
    ]

    selected = _select_current_recommendations(recommendations, active_habit_ids={10, 20})

    assert [item.id for item in selected] == [3, 2]


def test_first_step_recommendation_is_used_for_first_habit_without_history() -> None:
    rec_type, title, message, priority = _build_recommendation_text(
        make_user(),
        make_habit(),
        make_prediction(total_entries=0),
        active_habit_count=1,
    )

    assert rec_type == FIRST_STEP_RECOMMENDATION_TYPE
    assert title == "Первый шаг"
    assert_action_plan(message)
    assert "самый маленький шаг" in message
    assert priority == "normal"


def test_first_step_recommendation_waits_for_configured_pet() -> None:
    rec_type, *_ = _build_recommendation_text(
        SimpleNamespace(pet_type=None, pet_name=None),
        make_habit(),
        make_prediction(total_entries=0),
        active_habit_count=1,
    )

    assert rec_type == "data_collection"


def test_first_step_recommendation_is_not_used_after_history_starts() -> None:
    rec_type, *_ = _build_recommendation_text(
        make_user(),
        make_habit(),
        make_prediction(total_entries=1),
        active_habit_count=1,
    )

    assert rec_type == "data_collection"


def test_first_step_recommendation_is_only_for_first_active_habit() -> None:
    rec_type, *_ = _build_recommendation_text(
        make_user(),
        make_habit(),
        make_prediction(total_entries=0),
        active_habit_count=2,
    )

    assert rec_type == "data_collection"


def test_early_recovery_wins_over_data_collection_when_history_has_miss() -> None:
    rec_type, title, message, priority = _build_recommendation_text(
        make_user(),
        make_habit(),
        make_prediction(
            total_entries=1,
            missed_count=1,
            missed_today=True,
            consecutive_missed=1,
        ),
        active_habit_count=2,
    )

    assert rec_type == EARLY_RECOVERY_RECOMMENDATION_TYPE
    assert title == "После первого пропуска"
    assert_action_plan(message)
    assert "первый разрыв" in message
    assert priority == "normal"


def test_miss_streak_recovery_is_used_for_three_consecutive_misses() -> None:
    rec_type, title, message, priority = _build_recommendation_text(
        make_user(),
        make_habit(),
        make_prediction(
            total_entries=3,
            missed_count=3,
            consecutive_missed=3,
            missed_last_7_days=3,
            total_last_7_days=3,
            recent_miss_rate=1,
        ),
        active_habit_count=2,
    )

    assert rec_type == MISS_STREAK_RECOVERY_RECOMMENDATION_TYPE
    assert title == "Разорвать пропуски"
    assert_action_plan(message)
    assert "серия пропусков" in message.lower()
    assert priority == "high"


def test_risk_ignored_recovery_changes_repeated_high_risk_advice() -> None:
    rec_type, title, message, priority = _build_recommendation_text(
        make_user(),
        make_habit(),
        make_prediction(
            total_entries=4,
            risk_level="high",
            missed_count=4,
            consecutive_missed=3,
            missed_last_7_days=4,
            total_last_7_days=4,
            recent_miss_rate=1,
        ),
        active_habit_count=2,
        previous_type=RISK_RECOVERY_RECOMMENDATION_TYPE,
    )

    assert rec_type == RISK_IGNORED_RECOVERY_RECOMMENDATION_TYPE
    assert title == "Пересоберите условия"
    assert_action_plan(message)
    assert "полную версию" in message
    assert priority == "high"


def test_reset_plan_is_used_for_long_pause_without_previous_risk_advice() -> None:
    rec_type, title, message, priority = _build_recommendation_text(
        make_user(),
        make_habit(),
        make_prediction(
            total_entries=5,
            missed_count=5,
            consecutive_missed=5,
            missed_last_7_days=5,
            total_last_7_days=5,
            completion_rate_last_7=0,
        ),
        active_habit_count=2,
    )

    assert rec_type == RESET_PLAN_RECOMMENDATION_TYPE
    assert title == "План перезапуска"
    assert_action_plan(message)
    assert "новый цикл" in message
    assert priority == "high"


def test_high_risk_without_miss_streak_uses_risk_recovery() -> None:
    rec_type, title, *_ = _build_recommendation_text(
        make_user(),
        make_habit(),
        make_prediction(
            total_entries=4,
            risk_level="high",
            completed_count=2,
            missed_count=1,
            consecutive_missed=0,
        ),
        active_habit_count=2,
    )

    assert rec_type == RISK_RECOVERY_RECOMMENDATION_TYPE
    assert title == "Снизить риск"


def test_recovery_messages_vary_by_context_for_same_habit() -> None:
    habit = make_habit("Диплом", "Писать диплом")
    scenarios = [
        make_prediction(
            total_entries=1,
            missed_count=1,
            missed_today=True,
            consecutive_missed=1,
        ),
        make_prediction(
            total_entries=4,
            risk_level="high",
            completed_count=2,
            missed_count=1,
            consecutive_missed=0,
        ),
        make_prediction(
            total_entries=3,
            missed_count=3,
            consecutive_missed=3,
            missed_last_7_days=3,
            total_last_7_days=3,
            recent_miss_rate=1,
        ),
    ]

    messages = [
        _build_recommendation_text(
            make_user(),
            habit,
            prediction,
            active_habit_count=2,
        )[2]
        for prediction in scenarios
    ]

    assert len(set(messages)) == len(messages)
    assert "первый разрыв" in messages[0]
    assert "до пропуска" in messages[1]
    assert "серия пропусков" in messages[2].lower()


def test_default_recovery_minutes_do_not_make_same_five_minute_advice() -> None:
    habits = [
        (make_habit("Английский", "Повторить слова", recovery_minutes=5), "три знакомых слова"),
        (make_habit("Диплом", "Писать диплом", recovery_minutes=5), "один абзац"),
        (make_habit("Пайтон", "Решать задачи по Python", recovery_minutes=5), "пример кода"),
        (make_habit("Чтение", "Открыть книгу", recovery_minutes=5), "книгу на закладке"),
        (make_habit("Курение", "Отложить сигарету", recovery_minutes=5), "первую сигарету"),
    ]

    messages: list[str] = []
    for habit, expected_fragment in habits:
        rec_type, _, message, _ = _build_recommendation_text(
            make_user(),
            habit,
            make_prediction(
                total_entries=4,
                risk_level="high",
                completed_count=2,
                missed_count=1,
                consecutive_missed=0,
            ),
            active_habit_count=len(habits),
        )
        assert rec_type == RISK_RECOVERY_RECOMMENDATION_TYPE
        assert expected_fragment in message
        assert "5 минут" not in message
        messages.append(message)

    assert len(set(messages)) == len(habits)


def test_health_habit_uses_safe_contextual_micro_step() -> None:
    rec_type, title, message, priority = _build_recommendation_text(
        make_user(),
        make_habit("Здоровье", "Пить воду утром"),
        make_prediction(
            total_entries=4,
            risk_level="high",
            completed_count=2,
            missed_count=1,
            consecutive_missed=0,
        ),
        active_habit_count=2,
    )

    assert rec_type == RISK_RECOVERY_RECOMMENDATION_TYPE
    assert title == "Снизить риск"
    assert_action_plan(message)
    assert "стакан воды" in message
    assert "резкой нагрузки" not in message
    assert priority == "high"


def test_leisure_habit_uses_soft_rest_tone() -> None:
    rec_type, title, message, priority = _build_recommendation_text(
        make_user(),
        make_habit("Отдых", "Рисовать вечером"),
        make_prediction(total_entries=0),
        active_habit_count=2,
    )

    assert rec_type == "data_collection"
    assert title == "Пока рано считать риск"
    assert_action_plan(message)
    assert "набросок" in message
    assert "короткий отдых" in message
    assert priority == "normal"


def test_after_completion_advice_is_used_for_early_success() -> None:
    rec_type, title, message, priority = _build_recommendation_text(
        make_user(),
        make_habit(),
        make_prediction(
            total_entries=1,
            completed_count=1,
            completed_today=True,
            current_streak=1,
            completion_rate=1,
        ),
        active_habit_count=2,
    )

    assert rec_type == AFTER_COMPLETION_RECOMMENDATION_TYPE
    assert title == "После отметки"
    assert_action_plan(message)
    assert "видимую подсказку" in message
    assert priority == "normal"


def test_completed_sport_advice_prepares_next_repeat_without_second_workout() -> None:
    rec_type, title, message, priority = _build_recommendation_text(
        make_user(),
        make_habit("Спорт", "Прыгать со скакалкой"),
        make_prediction(
            total_entries=1,
            completed_count=1,
            completed_today=True,
            current_streak=1,
            completion_rate=1,
        ),
        active_habit_count=2,
    )

    assert rec_type == AFTER_COMPLETION_RECOMMENDATION_TYPE
    assert title == "После отметки"
    assert_action_plan(message)
    assert "положите скакалку" in message
    assert "не делайте второй подход" in message.lower()
    assert "выполните" not in message.lower()
    assert priority == "normal"


def test_on_track_support_is_used_after_regular_completion() -> None:
    rec_type, title, message, priority = _build_recommendation_text(
        make_user(),
        make_habit(),
        make_prediction(
            total_entries=4,
            completed_count=3,
            completed_today=True,
            current_streak=2,
            completion_rate=0.75,
            completed_last_7_days=3,
            missed_last_7_days=1,
            total_last_7_days=4,
            completion_rate_last_7=0.75,
        ),
        active_habit_count=2,
    )

    assert rec_type == ON_TRACK_SUPPORT_RECOMMENDATION_TYPE
    assert title == "Идет по плану"
    assert_action_plan(message)
    assert "следующего выполнения" in message
    assert priority == "low"


def test_streak_maintenance_is_used_when_everything_is_on_time() -> None:
    rec_type, title, message, priority = _build_recommendation_text(
        make_user(),
        make_habit(),
        make_prediction(
            total_entries=5,
            completed_count=5,
            completed_today=True,
            current_streak=5,
            completion_rate=1,
            completed_last_7_days=5,
            missed_last_7_days=0,
            total_last_7_days=5,
            completion_rate_last_7=1,
        ),
        active_habit_count=2,
    )

    assert rec_type == STREAK_MAINTENANCE_RECOMMENDATION_TYPE
    assert title == "Удержать серию"
    assert_action_plan(message)
    assert "следующему повтору" in message
    assert priority == "low"


def test_normalize_recommendation_message_removes_ai_step_tail() -> None:
    message = (
        "Сегодня откройте файл диплома и приведите в порядок один небольшой фрагмент. "
        "Этого достаточно, чтобы сохранить контакт с задачей. "
        "Шаги: поставьте таймер, выберите микрозадачу и запишите итог."
    )

    assert _normalize_recommendation_message(message) == (
        "Сегодня откройте файл диплома и приведите в порядок один небольшой фрагмент. "
        "Этого достаточно, чтобы сохранить контакт с задачей"
    )


def test_normalize_recommendation_message_caps_to_fifty_six_words() -> None:
    message = " ".join(f"слово{index}" for index in range(70))

    normalized = _normalize_recommendation_message(message)

    assert len(normalized.split()) == 56
    assert not normalized.endswith(".")


def test_normalize_recommendation_message_removes_outer_quotes() -> None:
    message = "«Сегодня откройте файл диплома и напишите один короткий абзац.»"

    assert _normalize_recommendation_message(message) == (
        "Сегодня откройте файл диплома и напишите один короткий абзац"
    )


def test_normalize_recommendation_message_repairs_awkward_sport_copy() -> None:
    message = (
        "Сегодня: Поставьте скакалку рядом с местом для вечера и после ужина сделайте "
        "короткую разминку Минимум: подержите снаряд в руках Готово: Снаряд лежит "
        "на видном месте"
    )

    normalized = _normalize_recommendation_message(
        message,
        make_habit("Спорт", "Прыгать со скакалкой"),
    )

    assert "местом для вечера" not in normalized
    assert "снаряд" not in normalized.lower()
    assert "на видное место на вечер" in normalized
    assert "скакалку" in normalized
    assert "Скакалка лежит" in normalized


def test_ai_payload_rejects_completed_today_repeat_action() -> None:
    context = {
        "habit": {"title": "Спорт", "description": "Прыгать со скакалкой"},
        "risk": {"features": {"completed_today": True}},
    }
    payload = {
        "title": "Спорт вечером",
        "message": (
            "Сегодня: Поставьте скакалку на видное место и после ужина сделайте "
            "короткую разминку Минимум: подержите скакалку в руках "
            "Готово: скакалка лежит на видном месте"
        ),
    }

    assert _normalize_ai_payload(payload, context) is None


def test_ai_payload_repairs_generic_equipment_word() -> None:
    context = {
        "habit": {"title": "Спорт", "description": "Прыгать со скакалкой"},
        "risk": {"features": {"completed_today": False}},
    }

    draft = _normalize_ai_payload(
        {
            "title": "Легкий старт",
            "message": (
                "Сегодня: Возьмите снаряд и сделайте десять спокойных прыжков "
                "Минимум: подержите снаряд в руках и сделайте один прыжок "
                "Готово: Снаряд лежит на месте, один подход отмечен"
            ),
        },
        context,
    )

    assert draft is not None
    assert "снаряд" not in draft.message.lower()
    assert "скакалку" in draft.message
    assert "Скакалка лежит" in draft.message


def test_ai_payload_rejects_unsafe_health_instruction() -> None:
    context = {
        "habit": {
            "title": "Здоровье",
            "description": "Принимать лекарство по назначению",
            "topic_hint": "health",
        },
        "risk": {"features": {"completed_today": False}},
    }

    assert _normalize_ai_payload(
        {
            "title": "Проверьте режим",
            "message": (
                "Сегодня: Измените дозировку лекарства по самочувствию "
                "Минимум: уменьшите дозу таблетки "
                "Готово: назначение изменено"
            ),
        },
        context,
    ) is None


def test_ai_payload_rejects_jumps_right_after_food_for_sport() -> None:
    context = {
        "habit": {
            "title": "Спорт",
            "description": "Прыгать со скакалкой",
            "topic_hint": "sport",
        },
        "risk": {"features": {"completed_today": False}},
    }

    assert _normalize_ai_payload(
        {
            "title": "Легкий старт",
            "message": (
                "Сегодня: Сразу после ужина сделайте минуту прыжков со скакалкой "
                "Минимум: сделайте один прыжок "
                "Готово: один подход отмечен"
            ),
        },
        context,
    ) is None


def test_manual_refresh_bothub_request_uses_more_variation() -> None:
    auto_request = _build_bothub_request({"request": {"mode": "auto"}})
    manual_request = _build_bothub_request(
        {"request": {"mode": "manual_refresh", "variation_seed": "demo-seed"}}
    )

    assert manual_request["temperature"] > auto_request["temperature"]
    assert "demo-seed" in manual_request["messages"][1]["content"]
    assert "manual_refresh" in manual_request["messages"][1]["content"]


def test_recommendation_read_exposes_ai_source_for_demo_status() -> None:
    recommendation = make_recommendation(
        1,
        10,
        datetime(2026, 6, 18, 12, 0, tzinfo=timezone.utc),
    )
    recommendation.user_id = 1
    recommendation.prediction_id = None
    recommendation.ai_source = "bothub"

    payload = RecommendationRead.model_validate(recommendation)

    assert payload.ai_source == "bothub"
