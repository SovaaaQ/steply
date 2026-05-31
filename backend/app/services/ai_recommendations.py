from __future__ import annotations

import json
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import date
from typing import Any, Optional

from app.core.config import get_settings
from app.models import Habit, Prediction


@dataclass(frozen=True)
class AIRecommendationDraft:
    title: str
    message: str


MAX_TITLE_CHARS = 70
MAX_MESSAGE_CHARS = 180


def _clean_text(value: str) -> str:
    return " ".join(value.split()).strip()


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
    return clipped.rstrip(" ,;:.!?") + "."


def _compact_features(features: dict[str, Any]) -> dict[str, Any]:
    allowed_keys = {
        "total_entries",
        "completed_count",
        "missed_count",
        "completion_rate",
        "recent_miss_rate",
        "consecutive_missed",
        "current_streak",
        "longest_streak",
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
    message = _clip_text(str(payload.get("message") or ""), MAX_MESSAGE_CHARS)

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
) -> dict[str, Any]:
    return {
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


def _system_instructions() -> str:
    return (
        "Ты генерируешь персональные советы для адаптивного веб-приложения Steply. "
        "Пиши по-русски, спокойно и конкретно. Учитывай название, описание, сложность, "
        "время и историю конкретной привычки. Не копируй базовый совет дословно и не "
        "возвращай один и тот же текст для разных привычек. Дай маленький, предметный "
        "шаг именно для этой привычки: что сделать, когда и как упростить при риске. "
        "Ответ должен звучать как короткая человеческая подсказка, не как список. "
        "title до 4 слов, message 1-2 коротких предложения до 170 символов. "
        "Не используй нумерацию, '1)', '2)', маркированные списки и слово 'Шаги'. "
        "Не обещай медицинский эффект, не ставь "
        "диагнозы и не назначай лечение. Если привычка связана со здоровьем, зависимостью, "
        "курением, алкоголем, питанием или лекарствами, добавь мягкую фразу о том, что при "
        "выраженных симптомах или зависимости стоит обратиться к специалисту. Не используй "
        "слово 'нейросеть'. Не ругай пользователя и не усиливай чувство вины."
    )


def _user_prompt(context: dict[str, Any]) -> str:
    return (
        "Сформируй совет на сегодня на основе контекста. Верни только JSON вида "
        '{"title":"...","message":"...","actions":[]}. '
        "Никакого текста вне JSON. Message должен быть мини-рассказом на 1-2 коротких предложения. "
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
        return None
