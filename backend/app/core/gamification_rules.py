from __future__ import annotations

from math import ceil
from typing import Any, Mapping


XP_REWARDS: dict[str, Any] = {
    "habit_completed": {
        "xp": 10,
        "description": "Выполнен шаг привычки",
    },
    "habit_recovery_completed": {
        "xp": 5,
        "description": "Выполнена минимальная версия привычки",
    },
    "recommendation_read": {
        "xp": 5,
        "description": "Изучена персональная рекомендация",
    },
}


LEVEL_THRESHOLDS = [
    {
        "level": 1,
        "min_xp": 0,
        "title": "Питомец привыкает",
        "milestone": "Создайте первую привычку и закройте первый шаг.",
    },
    {
        "level": 2,
        "min_xp": 100,
        "title": "Питомец оживился",
        "milestone": "Первые повторения уже видны в аналитике.",
    },
    {
        "level": 3,
        "min_xp": 250,
        "title": "Питомец держит темп",
        "milestone": "Регулярность начинает вытеснять случайность.",
    },
    {
        "level": 4,
        "min_xp": 500,
        "title": "Питомец увереннее",
        "milestone": "Привычки поддерживаются прогнозами и восстановлением.",
    },
    {
        "level": 5,
        "min_xp": 1000,
        "title": "Питомец в отличной форме",
        "milestone": "Фокус смещается с старта на устойчивость.",
    },
]


RECOVERY_FALLBACK_TASK = "Выполни минимальную версию привычки, чтобы сохранить регулярность."
COMPLETION_STATUSES = {"completed", "recovery_completed"}
DIFFICULTY_XP = {
    "easy": 5,
    "medium": 10,
    "hard": 15,
}


def _coerce_rate(value: Any) -> float:
    try:
        rate = float(value)
    except (TypeError, ValueError):
        return 0.0
    if rate > 1:
        rate = rate / 100
    return max(0.0, min(rate, 1.0))


def calculatePetState(userActivity: Mapping[str, Any] | float | int) -> str:
    if isinstance(userActivity, Mapping):
        if "completion_rate_last_7" in userActivity:
            rate = _coerce_rate(userActivity["completion_rate_last_7"])
        elif "completion_rate" in userActivity:
            rate = _coerce_rate(userActivity["completion_rate"])
        else:
            completed = int(userActivity.get("completed_last_7_days", 0) or 0)
            missed = int(userActivity.get("missed_last_7_days", 0) or 0)
            total = completed + missed
            if total == 0:
                return "neutral"
            rate = completed / total if total else 0.0
    else:
        rate = _coerce_rate(userActivity)

    if rate >= 0.70:
        return "happy"
    if rate >= 0.40:
        return "neutral"
    return "sad"


def calculatePetLevel(xp: int) -> int:
    safe_xp = max(int(xp or 0), 0)
    level = 1
    for threshold in LEVEL_THRESHOLDS:
        if safe_xp >= int(threshold["min_xp"]):
            level = int(threshold["level"])
    return level


def _get_base_xp_for_difficulty(difficulty: str | None) -> int:
    return DIFFICULTY_XP.get(str(difficulty or "medium"), DIFFICULTY_XP["medium"])


def getXPForCompletion(status: str, difficulty: str | None = "medium") -> int:
    base_xp = _get_base_xp_for_difficulty(difficulty)
    if status in {"completed", "completed_on_time"}:
        return base_xp
    if status == "recovery_completed":
        return max(5, ceil(base_xp * 0.5))
    return 0


def shouldActivateRecoveryMode(
    habitStats: Mapping[str, Any],
    predictedRisk: float | int | None = None,
) -> bool:
    risk = _coerce_rate(predictedRisk or 0)
    consecutive_missed = int(habitStats.get("consecutive_missed", 0) or 0)
    completion_rate = _coerce_rate(
        habitStats.get("completion_rate_last_7", habitStats.get("completion_rate", 0))
    )
    recent_total = habitStats.get("total_last_7_days")
    has_recent_activity = recent_total is None or int(recent_total or 0) > 0

    return (
        risk >= 0.70
        or consecutive_missed >= 2
        or (has_recent_activity and completion_rate < 0.40)
    )


def getRecoveryTask(habit: Mapping[str, Any] | Any) -> str:
    recovery_task = (
        habit.get("recovery_task")
        if isinstance(habit, Mapping)
        else getattr(habit, "recovery_task", None)
    )
    if isinstance(recovery_task, str) and recovery_task.strip():
        return recovery_task.strip()
    return RECOVERY_FALLBACK_TASK


ACHIEVEMENT_DEFINITIONS = [
    {
        "id": "first_habit",
        "category": "starter",
        "title": "Первый маршрут",
        "description": "Создать первую привычку и включить персональный трекер.",
        "metric": "total_habits",
        "target": 1,
        "reward_xp": 25,
        "icon": "1",
        "sort_order": 10,
    },
    {
        "id": "first_completion",
        "category": "starter",
        "title": "Первый закрытый шаг",
        "description": "Отметить первое реальное выполнение привычки.",
        "metric": "completed_count",
        "target": 1,
        "reward_xp": 25,
        "icon": "OK",
        "sort_order": 20,
    },
    {
        "id": "route_day",
        "category": "consistency",
        "title": "День маршрута",
        "description": "Закрыть все привычки, запланированные на день.",
        "metric": "route_completion_days",
        "target": 1,
        "reward_xp": 35,
        "icon": "DAY",
        "sort_order": 30,
    },
    {
        "id": "streak_3",
        "category": "streak",
        "title": "Три дня ритма",
        "description": "Поддержать активность три дня подряд.",
        "metric": "longest_streak",
        "target": 3,
        "reward_xp": 35,
        "icon": "3",
        "sort_order": 40,
    },
    {
        "id": "streak_7",
        "category": "streak",
        "title": "Устойчивая неделя",
        "description": "Собрать семь активных дней подряд без токсичного давления.",
        "metric": "longest_streak",
        "target": 7,
        "reward_xp": 70,
        "icon": "7",
        "sort_order": 50,
    },
    {
        "id": "twenty_completions",
        "category": "milestone",
        "title": "Двадцать доказательств",
        "description": "Накопить 20 выполнений, чтобы аналитика стала надежнее.",
        "metric": "completed_count",
        "target": 20,
        "reward_xp": 80,
        "icon": "20",
        "sort_order": 60,
    },
    {
        "id": "recommendation_cycle",
        "category": "insight",
        "title": "Осознанный цикл",
        "description": "Прочитать рекомендацию и замкнуть петлю: данные → совет → действие.",
        "metric": "recommendations_read_count",
        "target": 1,
        "reward_xp": 30,
        "icon": "AI",
        "sort_order": 70,
    },
    {
        "id": "recovery_step",
        "category": "recovery",
        "title": "Возврат без наказания",
        "description": "После пропуска снова выполнить привычку и восстановить маршрут.",
        "metric": "recovered_after_miss",
        "target": 1,
        "reward_xp": 40,
        "icon": "UP",
        "sort_order": 80,
    },
]


QUEST_DEFINITIONS = [
    {
        "id": "onboarding_create_first_habit",
        "type": "onboarding",
        "tone": "onboarding",
        "title": "Соберите первый маршрут",
        "description": "Создайте одну привычку с понятной частотой и минимальным шагом.",
        "metric": "total_habits",
        "target": 1,
        "reward_xp": 20,
        "cta_label": "Создать привычку",
        "cta_section": "habits",
        "next_step": "Начните с действия на 5-10 минут, которое реально повторить завтра.",
        "sort_order": 10,
    },
    {
        "id": "onboarding_complete_first_step",
        "type": "onboarding",
        "tone": "onboarding",
        "title": "Закройте первый шаг",
        "description": "Отметьте первое выполнение, чтобы Steply построил начальный прогресс.",
        "metric": "completed_count",
        "target": 1,
        "reward_xp": 25,
        "cta_label": "Отметить выполнение",
        "cta_section": "dashboard",
        "next_step": "Откройте маршрут дня и закройте самый короткий шаг.",
        "sort_order": 20,
    },
    {
        "id": "onboarding_read_recommendation",
        "type": "onboarding",
        "tone": "onboarding",
        "title": "Разберите первый совет",
        "description": "Откройте рекомендацию, чтобы понять риск пропуска и следующий шаг.",
        "metric": "recommendations_read_count",
        "target": 1,
        "reward_xp": 15,
        "cta_label": "Открыть советы",
        "cta_section": "recommendations",
        "next_step": "Используйте совет как настройку маршрута, а не как оценку себя.",
        "sort_order": 30,
    },
    {
        "id": "daily_first_step",
        "type": "daily",
        "tone": "daily",
        "title": "Первый шаг дня",
        "description": "Закройте хотя бы одну привычку сегодня, чтобы сохранить связь с маршрутом.",
        "metric": "completed_today",
        "target": 1,
        "reward_xp": 10,
        "cta_label": "Закрыть шаг",
        "cta_section": "dashboard",
        "next_step": "Выберите самую легкую привычку из сегодняшнего списка.",
        "sort_order": 100,
    },
    {
        "id": "daily_route",
        "type": "daily",
        "tone": "daily",
        "title": "Маршрут дня",
        "description": "Закройте привычки, которые запланированы на сегодня.",
        "metric": "completed_scheduled_today",
        "target_metric": "scheduled_today",
        "target": 1,
        "reward_xp": 20,
        "cta_label": "Открыть день",
        "cta_section": "dashboard",
        "next_step": "Не компенсируйте объем: закрывайте по одному устойчивому шагу.",
        "sort_order": 110,
    },
    {
        "id": "weekly_five_steps",
        "type": "weekly",
        "tone": "weekly",
        "title": "Пять устойчивых шагов",
        "description": "Наберите пять выполнений за неделю на любых активных привычках.",
        "metric": "completed_current_week",
        "target": 5,
        "reward_xp": 40,
        "cta_label": "Продолжить неделю",
        "cta_section": "dashboard",
        "next_step": "Стабильность важнее идеальной серии: достаточно возвращаться.",
        "sort_order": 200,
    },
    {
        "id": "weekly_recommendation_cycle",
        "type": "weekly",
        "tone": "insight",
        "title": "Цикл обратной связи",
        "description": "Прочитайте одну рекомендацию за неделю и примените ее к маршруту.",
        "metric": "recommendations_read_current_week",
        "target": 1,
        "reward_xp": 15,
        "cta_label": "Посмотреть совет",
        "cta_section": "recommendations",
        "next_step": "Проверьте, какая привычка сейчас несет самый высокий риск.",
        "sort_order": 210,
    },
    {
        "id": "weekly_recovery_steps",
        "type": "weekly",
        "tone": "recovery",
        "title": "Неделя восстановления",
        "description": "После пропусков выполните два коротких шага без компенсации объема.",
        "metric": "completed_current_week",
        "target": 2,
        "reward_xp": 25,
        "cta_label": "Вернуться мягко",
        "cta_section": "dashboard",
        "next_step": "Выберите минимальную версию привычки, которую можно сделать сегодня.",
        "active_when": "recovery_mode",
        "sort_order": 220,
    },
]


def get_level_state(total_xp: int) -> dict[str, Any]:
    current = LEVEL_THRESHOLDS[0]
    next_level = None
    for index, threshold in enumerate(LEVEL_THRESHOLDS):
        if total_xp >= threshold["min_xp"]:
            current = threshold
            next_level = LEVEL_THRESHOLDS[index + 1] if index + 1 < len(LEVEL_THRESHOLDS) else None
        else:
            break

    current_min = int(current["min_xp"])
    current_level_xp = max(total_xp - current_min, 0)
    if next_level is None:
        next_level_value = int(current["level"])
        next_min = current_min
        progress_percent = 100.0
        xp_to_next = 0
    else:
        next_level_value = int(next_level["level"])
        next_min = int(next_level["min_xp"])
        span = max(next_min - current_min, 1)
        progress_percent = round(min(current_level_xp / span, 1) * 100, 1)
        xp_to_next = max(next_min - total_xp, 0)

    return {
        "level": calculatePetLevel(total_xp),
        "title": str(current["title"]),
        "milestone": str(current["milestone"]),
        "total_xp": total_xp,
        "current_level_xp": current_level_xp,
        "current_level_min_xp": current_min,
        "next_level": next_level_value,
        "next_level_xp": next_min,
        "xp_to_next_level": xp_to_next,
        "progress_percent": progress_percent,
    }
