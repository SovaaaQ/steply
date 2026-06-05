from __future__ import annotations

import json
import logging
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import date
from typing import Any, Optional

from app.core.config import get_settings
from app.models import Habit, Prediction, User


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AIRecommendationDraft:
    title: str
    message: str


MAX_TITLE_CHARS = 70
MAX_MESSAGE_CHARS = 520
MAX_MESSAGE_WORDS = 56


def _clean_text(value: str) -> str:
    without_dashes = value.replace("\u00a0", " ")
    for dash in ("—", "–", "−"):
        without_dashes = without_dashes.replace(dash, " ")
    return " ".join(without_dashes.split()).strip()


def _clip_text(value: str, max_length: int) -> str:
    text = _clean_text(value)
    if len(text) <= max_length:
        return text
    clipped = text[: max_length + 1]
    for separator in (". ", "! ", "? ", "; ", ", ", " "):
        position = clipped.rfind(separator)
        if position >= max_length * 0.55:
            clipped = clipped[:position]
            break
    return clipped.rstrip(" ,;:.!?")


def _clip_words(value: str, max_words: int) -> str:
    text = _clean_text(value)
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]).rstrip(" ,;:.!?")


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


def _compact_features(features: dict[str, Any]) -> dict[str, Any]:
    allowed_keys = {
        "total_entries",
        "completed_count",
        "missed_count",
        "completion_rate",
        "completed_last_7_days",
        "missed_last_7_days",
        "completion_rate_last_7",
        "total_last_7_days",
        "recent_miss_rate",
        "consecutive_missed",
        "current_streak",
        "longest_streak",
        "completed_today",
        "missed_today",
        "latest_entry_status",
        "weekday",
        "weekday_success_rate",
        "days_since_last_completion",
        "user_activity_score",
        "target_per_week",
        "difficulty",
        "history_confidence",
    }
    return {key: features[key] for key in allowed_keys if key in features}


def _normalize_ai_payload(payload: dict[str, Any]) -> Optional[AIRecommendationDraft]:
    title = _clip_text(str(payload.get("title") or ""), MAX_TITLE_CHARS)
    message = _strip_outer_quotes(_clip_text(
        _clip_words(str(payload.get("message") or ""), MAX_MESSAGE_WORDS),
        MAX_MESSAGE_CHARS,
    ))

    if not title or not message:
        return None

    return AIRecommendationDraft(title=title, message=message)


def _build_context(
    habit: Habit,
    prediction: Prediction,
    today: date,
    base_type: str,
    base_title: str,
    base_message: str,
    user: Optional[User] = None,
) -> dict[str, Any]:
    context: dict[str, Any] = {
        "today": today.isoformat(),
        "habit": {
            "title": habit.title,
            "description": habit.description,
            "frequency_type": habit.frequency_type,
            "target_per_week": habit.target_per_week,
            "difficulty": habit.difficulty,
            "preferred_time": habit.preferred_time.isoformat() if habit.preferred_time else None,
            "recovery_minutes": habit.recovery_minutes,
            "recovery_task": habit.recovery_task,
            "schedule_days": habit.schedule_days,
        },
        "risk": {
            "recommendation_type": base_type,
            "base_title": base_title,
            "base_message": base_message,
            "risk_level": prediction.risk_level,
            "miss_risk": prediction.miss_risk,
            "completion_probability": prediction.completion_probability,
            "features": _compact_features(prediction.features or {}),
        },
    }

    if user:
        context["user"] = {
            "pet_type": user.pet_type,
            "pet_name": user.pet_name,
        }

    return context


def _system_instructions() -> str:
    return (
        "Ты генерируешь персональные советы для адаптивного веб-приложения Steply. "
        "Пиши по-русски, спокойно и конкретно. Учитывай название, описание, сложность, "
        "время и историю конкретной привычки. Не копируй базовый совет дословно и не "
        "возвращай один и тот же текст для разных привычек. Дай маленький, предметный "
        "шаг именно для этой привычки: что сделать, когда и как упростить при риске. "
        "Если recommendation_type равен first_step, не оценивай риск и не проси историю: "
        "дай стартовый совет для первого выполнения привычки сегодня. "
        "Если тип after_completion, on_track_support, streak_maintenance или streak_support, "
        "поддержи успешное выполнение и предложи, как закрепить ритм без повышения нагрузки. "
        "Если тип early_recovery, miss_streak_recovery, risk_recovery, soft_recovery, "
        "risk_ignored_recovery или reset_plan, не повторяй общие фразы про риск: предложи "
        "снижение барьера, перенос времени, микрошаг или перезапуск условий. "
        "Для risk_ignored_recovery и reset_plan признай, что прежний формат пока слишком тяжелый, "
        "но без обвинений и стыда. "
        "Если тип plan_ahead, помоги подготовить выполнение заранее до пропуска. "
        "Message должен быть практическим планом из трех коротких предложений строго в формате: "
        "'Сегодня: ... Минимум: ... Готово: ...'. "
        "В 'Сегодня' назови конкретное наблюдаемое действие, в 'Минимум' - облегченный вариант "
        "на случай нехватки сил или риска, в 'Готово' - понятный критерий завершения. "
        "title до 4 слов, message 28-52 слова. "
        "Не ставь точки в конце предложений и не используй длинные тире. "
        "Не используй нумерацию, '1)', '2)', маркированные списки, слово 'Шаги' и абстрактные "
        "формулировки вроде 'уберите барьер' без конкретизации. "
        "Не обещай медицинский эффект, не ставь "
        "диагнозы и не назначай лечение. Если привычка связана со здоровьем, зависимостью, "
        "курением, алкоголем, питанием или лекарствами, добавь мягкую фразу о том, что при "
        "выраженных симптомах или зависимости стоит обратиться к специалисту. Не добавляй эту "
        "фразу для обычных учебных, рабочих, бытовых или творческих привычек без явной темы "
        "здоровья. Не используй "
        "слово 'нейросеть'. Не ругай пользователя и не усиливай чувство вины."
    )


def _user_prompt(context: dict[str, Any]) -> str:
    return (
        "Сформируй совет на сегодня на основе контекста. Верни только JSON вида "
        '{"title":"...","message":"Сегодня: ... Минимум: ... Готово: ..."}. '
        "Никакого текста вне JSON. Не добавляй actions или другие поля. "
        "В message не ставь точки в конце сегментов. "
        f"Контекст: {json.dumps(context, ensure_ascii=False)}"
    )


def _build_bothub_request(context: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    return {
        "model": settings.bothub_model,
        "messages": [
            {"role": "system", "content": _system_instructions()},
            {"role": "user", "content": _user_prompt(context)},
        ],
        "temperature": 0.4,
        "max_tokens": 180,
    }


def _extract_json_object(value: str) -> dict[str, Any]:
    text = value.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise
        payload = json.loads(text[start : end + 1])

    if not isinstance(payload, dict):
        raise json.JSONDecodeError("Expected JSON object", text, 0)

    return payload


def generate_ai_recommendation(
    habit: Habit,
    prediction: Prediction,
    today: date,
    base_type: str,
    base_title: str,
    base_message: str,
    user: Optional[User] = None,
) -> Optional[AIRecommendationDraft]:
    settings = get_settings()
    provider = settings.ai_provider.lower()
    if not settings.ai_enabled:
        return None

    context = _build_context(
        habit=habit,
        prediction=prediction,
        today=today,
        base_type=base_type,
        base_title=base_title,
        base_message=base_message,
        user=user,
    )

    if provider != "bothub":
        return None

    return _generate_bothub_recommendation(context)


def _generate_bothub_recommendation(context: dict[str, Any]) -> Optional[AIRecommendationDraft]:
    settings = get_settings()
    api_key = settings.bothub_api_key.strip()
    if not api_key:
        return None

    request = urllib.request.Request(
        f"{settings.bothub_base_url.rstrip('/')}/chat/completions",
        data=json.dumps(_build_bothub_request(context)).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=settings.ai_request_timeout_seconds,
        ) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
        choices = response_payload.get("choices")
        if not isinstance(choices, list) or not choices:
            return None
        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            return None
        message = first_choice.get("message")
        if not isinstance(message, dict):
            return None
        response_text = str(message.get("content") or "").strip()
        if not response_text:
            return None
        return _normalize_ai_payload(_extract_json_object(response_text))
    except (
        json.JSONDecodeError,
        OSError,
        TimeoutError,
        urllib.error.URLError,
        urllib.error.HTTPError,
        socket.timeout,
    ):
        logger.warning("AI recommendation provider failed; using heuristic fallback", exc_info=True)
        return None
